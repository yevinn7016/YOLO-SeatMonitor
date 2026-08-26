import math
import time
from collections.abc import Iterator
from pathlib import Path
from threading import Condition, Event, Lock, Thread

import cv2

from backend.domain.models import DemoStatus, DemoVideoInfo
from backend.domain.service import SeatService
from backend.vision.detector import analyze_frame


class DemoVideoError(Exception):
    pass


class InvalidDemoVideoError(DemoVideoError):
    pass


class DemoVideoStateError(DemoVideoError):
    pass


def inspect_demo_video(
    path: Path,
    video_id: str,
    filename: str,
) -> tuple[DemoVideoInfo, bytes]:
    """업로드 영상을 열어 메타데이터와 ROI 편집용 첫 프레임을 만든다."""

    capture = cv2.VideoCapture(str(path))
    try:
        if not capture.isOpened():
            raise InvalidDemoVideoError("OpenCV에서 영상을 열 수 없습니다.")

        fps = float(capture.get(cv2.CAP_PROP_FPS))
        if not math.isfinite(fps) or fps <= 0:
            fps = 30.0

        total_frames = max(0, int(capture.get(cv2.CAP_PROP_FRAME_COUNT)))
        success, first_frame = capture.read()
        if not success or first_frame is None:
            raise InvalidDemoVideoError("영상의 첫 프레임을 읽을 수 없습니다.")

        encoded, jpeg = cv2.imencode(".jpg", first_frame)
        if not encoded:
            raise InvalidDemoVideoError("영상 미리보기를 만들 수 없습니다.")

        info = DemoVideoInfo(
            video_id=video_id,
            filename=filename,
            duration_seconds=(total_frames / fps if total_frames else 0),
            fps=fps,
            total_frames=total_frames,
        )
        return info, jpeg.tobytes()
    finally:
        capture.release()


class DemoVideoWorker:
    """업로드 영상을 원래 속도로 재생하고 최신 프레임을 별도로 분석한다."""

    def __init__(
        self,
        path: Path,
        info: DemoVideoInfo,
        model,
        seat_service: SeatService,
        frame_callback,
        inference_interval: float = 2.0,
        inference_lock=None,
    ) -> None:
        self.path = path
        self.info = info
        self.model = model
        self.seat_service = seat_service
        self.frame_callback = frame_callback
        self.inference_interval = inference_interval
        self._inference_lock = inference_lock or Lock()
        self._stop_event = Event()
        self._playback_finished = Event()
        self._playback_thread: Thread | None = None
        self._inference_thread: Thread | None = None
        self._frame_lock = Lock()
        self._state_lock = Lock()
        self._latest_frame = None
        self._status = "uploaded"
        self._current_frame = 0
        self._error: str | None = None

    def start(self) -> None:
        with self._state_lock:
            if self._status == "playing":
                return
            self._status = "playing"
            self._current_frame = 0
            self._error = None

        self._stop_event.clear()
        self._playback_finished.clear()
        self._playback_thread = Thread(
            target=self._run_playback,
            name="demo-video-playback",
            daemon=True,
        )
        self._inference_thread = Thread(
            target=self._run_inference,
            name="demo-video-inference",
            daemon=True,
        )
        self._playback_thread.start()
        self._inference_thread.start()

    def stop(self) -> None:
        with self._state_lock:
            if self._status == "playing":
                self._status = "stopped"

        self._stop_event.set()

        if self._playback_thread is not None:
            self._playback_thread.join(timeout=3)
            self._playback_thread = None
        if self._inference_thread is not None:
            self._inference_thread.join(timeout=3)
            self._inference_thread = None

    def snapshot(self, mode: str = "demo") -> DemoStatus:
        with self._state_lock:
            status = self._status
            current_frame = self._current_frame
            error = self._error

        total_frames = self.info.total_frames
        progress = (
            min(100.0, current_frame / total_frames * 100)
            if total_frames
            else 0.0
        )
        current_seconds = min(
            self.info.duration_seconds,
            current_frame / self.info.fps,
        )
        if status == "completed":
            progress = 100.0
            current_seconds = self.info.duration_seconds

        return DemoStatus(
            mode=mode,
            video_id=self.info.video_id,
            filename=self.info.filename,
            status=status,
            current_frame=current_frame,
            total_frames=total_frames,
            current_seconds=current_seconds,
            duration_seconds=self.info.duration_seconds,
            progress=progress,
            error=error,
        )

    def _run_playback(self) -> None:
        capture = cv2.VideoCapture(str(self.path))
        started_at = time.monotonic()
        frame_index = 0

        try:
            if not capture.isOpened():
                self._fail("업로드 영상을 다시 열 수 없습니다.")
                return

            while not self._stop_event.is_set():
                success, frame = capture.read()
                if not success or frame is None:
                    break

                target_time = started_at + frame_index / self.info.fps
                wait_seconds = target_time - time.monotonic()
                if wait_seconds > 0 and self._stop_event.wait(wait_seconds):
                    break

                with self._frame_lock:
                    self._latest_frame = frame

                encoded, jpeg = cv2.imencode(".jpg", frame)
                if not encoded:
                    self._fail("영상 프레임을 JPEG로 변환하지 못했습니다.")
                    return

                frame_index += 1
                with self._state_lock:
                    self._current_frame = frame_index
                self.frame_callback(jpeg.tobytes())

            with self._state_lock:
                if self._status == "playing":
                    self._status = "completed"
        except Exception as error:
            self._fail(f"영상 재생 실패: {error}")
        finally:
            capture.release()
            self._playback_finished.set()

    def _run_inference(self) -> None:
        next_inference_at = time.monotonic()

        while not self._stop_event.is_set():
            wait_seconds = max(0.0, next_inference_at - time.monotonic())
            if self._stop_event.wait(wait_seconds):
                return

            frame = self._get_latest_frame()
            if frame is not None:
                try:
                    layout = self.seat_service.get_layout()
                    if layout.seats:
                        with self._inference_lock:
                            statuses = analyze_frame(self.model, frame, layout.seats)
                        if self._stop_event.is_set():
                            return
                        self.seat_service.update_statuses(statuses)
                except Exception as error:
                    self._fail(f"YOLO 영상 분석 실패: {error}")
                    return

            if self._playback_finished.is_set():
                return
            next_inference_at += self.inference_interval

    def _get_latest_frame(self):
        with self._frame_lock:
            if self._latest_frame is None:
                return None
            return self._latest_frame.copy()

    def _fail(self, message: str) -> None:
        with self._state_lock:
            self._status = "error"
            self._error = message
        self._stop_event.set()


class DemoVideoManager:
    """시연 영상과 MJPEG 구독자를 관리하는 실행 중 메모리 상태."""

    def __init__(
        self,
        model,
        seat_service: SeatService,
        inference_lock=None,
        inference_interval: float = 2.0,
    ) -> None:
        self.model = model
        self.seat_service = seat_service
        self._inference_lock = inference_lock or Lock()
        self._inference_interval = inference_interval
        self._lock = Lock()
        self._frame_condition = Condition()
        self._mode = "camera"
        self._status = "idle"
        self._path: Path | None = None
        self._info: DemoVideoInfo | None = None
        self._worker: DemoVideoWorker | None = None
        self._preview_jpeg: bytes | None = None
        self._latest_jpeg: bytes | None = None
        self._frame_sequence = 0

    @property
    def mode(self) -> str:
        with self._lock:
            return self._mode

    def enter(self) -> DemoStatus:
        with self._lock:
            self._mode = "demo"
            self._status = "uploaded" if self._info else "idle"
        self._notify_streams()
        return self.status()

    def register_video(
        self,
        path: Path,
        video_id: str,
        filename: str,
    ) -> DemoVideoInfo:
        if self.mode != "demo":
            raise DemoVideoStateError("먼저 시연 모드로 진입해야 합니다.")

        info, preview = inspect_demo_video(path, video_id, filename)
        self.stop()

        with self._lock:
            previous_path = self._path
            self._path = path
            self._info = info
            self._worker = None
            self._status = "uploaded"
            self._preview_jpeg = preview

        if previous_path is not None and previous_path != path:
            previous_path.unlink(missing_ok=True)

        self._publish_frame(preview)
        return info

    def preview(self) -> bytes:
        with self._lock:
            if self._preview_jpeg is None:
                raise DemoVideoStateError("먼저 시연 영상을 업로드해야 합니다.")
            return self._preview_jpeg

    def start(self, video_id: str) -> DemoStatus:
        if self.mode != "demo":
            raise DemoVideoStateError("먼저 시연 모드로 진입해야 합니다.")
        if not self.seat_service.get_layout().seats:
            raise DemoVideoStateError("영상 분석 전에 시연용 ROI를 설정해야 합니다.")

        self.stop()
        with self._lock:
            if self._path is None or self._info is None:
                raise DemoVideoStateError("먼저 시연 영상을 업로드해야 합니다.")
            if self._info.video_id != video_id:
                raise DemoVideoStateError("업로드된 영상 ID와 일치하지 않습니다.")

            worker = DemoVideoWorker(
                self._path,
                self._info,
                self.model,
                self.seat_service,
                self._publish_frame,
                inference_interval=self._inference_interval,
                inference_lock=self._inference_lock,
            )
            self._worker = worker
            self._status = "playing"

        worker.start()
        return worker.snapshot()

    def stop(self) -> DemoStatus:
        with self._lock:
            worker = self._worker
        if worker is not None:
            worker.stop()
            with self._lock:
                self._status = worker.snapshot().status
        return self.status()

    def exit(self) -> None:
        self.stop()
        with self._lock:
            path = self._path
            self._mode = "camera"
            self._status = "idle"
            self._path = None
            self._info = None
            self._worker = None
            self._preview_jpeg = None
        if path is not None:
            path.unlink(missing_ok=True)
        with self._frame_condition:
            self._latest_jpeg = None
            self._frame_sequence += 1
            self._frame_condition.notify_all()

    def status(self) -> DemoStatus:
        with self._lock:
            mode = self._mode
            status = self._status
            info = self._info
            worker = self._worker

        if worker is not None:
            return worker.snapshot(mode)
        if info is None:
            return DemoStatus(mode=mode, status="idle")
        return DemoStatus(
            mode=mode,
            video_id=info.video_id,
            filename=info.filename,
            status=status,
            total_frames=info.total_frames,
            duration_seconds=info.duration_seconds,
        )

    def mjpeg_stream(self) -> Iterator[bytes]:
        last_sequence = -1
        while True:
            with self._frame_condition:
                self._frame_condition.wait_for(
                    lambda: self._frame_sequence != last_sequence,
                    timeout=15,
                )
                if self.mode != "demo":
                    return
                jpeg = self._latest_jpeg
                sequence = self._frame_sequence

            if jpeg is None or sequence == last_sequence:
                continue
            last_sequence = sequence
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + jpeg
                + b"\r\n"
            )

    def shutdown(self) -> None:
        self.exit()

    def _publish_frame(self, jpeg: bytes) -> None:
        with self._frame_condition:
            self._latest_jpeg = jpeg
            self._frame_sequence += 1
            self._frame_condition.notify_all()

    def _notify_streams(self) -> None:
        with self._frame_condition:
            self._frame_sequence += 1
            self._frame_condition.notify_all()
