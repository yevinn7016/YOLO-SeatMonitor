from threading import Event, Lock, Thread

import cv2

from backend.domain.service import SeatService
from backend.vision.detector import analyze_frame


CAMERA_RECONNECT_DELAY_SECONDS = 1.0
MAX_CONSECUTIVE_READ_FAILURES = 3


def parse_camera_source(source: str) -> int | str:
    if source.isdigit():
        return int(source)
    return source


class CameraWorker:
    """수집 스레드는 최신 프레임을 저장하고, 분석 스레드는 복사본을 분석한다.

    분석 사이에는 기본 1초를 기다린다. 실제 간격에는 추론 시간도 포함된다.
    최종 좌석 상태와 타이머는 전달받은 SeatService가 관리한다.
    """

    def __init__(
        self,
        source: str,
        model,
        seat_service: SeatService,
        inference_interval: float = 1.0,
        inference_lock=None,
    ) -> None:
        self.source = source
        self.model = model
        self.seat_service = seat_service
        self.inference_interval = inference_interval
        self._inference_lock = inference_lock or Lock()
        self.running = False
        self._connected = False
        self._camera_error: str | None = None
        self._inference_error: str | None = None
        self._capture_thread: Thread | None = None
        self._inference_thread: Thread | None = None
        self._stop_event = Event()
        self._capture = None
        self._latest_frame = None
        self._frame_lock = Lock()
        self._capture_lock = Lock()
        self._state_lock = Lock()

    @property
    def connected(self) -> bool:
        with self._state_lock:
            return self._connected

    @property
    def error(self) -> str | None:
        with self._state_lock:
            if self._camera_error:
                return self._camera_error
            return self._inference_error

    def start(self) -> None:
        if self.running:
            return

        self.running = True
        self._stop_event.clear()
        # target에는 실행 결과가 아니라 함수를 전달한다. 실행은 start()가 한다.
        self._capture_thread = Thread(
            target=self._run_capture,
            name="camera-capture",
            daemon=True,
        )
        self._inference_thread = Thread(
            target=self._run_inference,
            name="camera-inference",
            daemon=True,
        )
        self._capture_thread.start()
        self._inference_thread.start()

    def stop(self) -> None:
        self.running = False
        self._stop_event.set()

        # read()가 장치 응답을 기다리는 중이라도 종료될 수 있게 캡처를 먼저 해제한다.
        self._release_current_capture()

        if self._capture_thread is not None:
            # join은 종료를 기다릴 뿐, 시간 초과 시 스레드를 강제로 종료하지 않는다.
            self._capture_thread.join(timeout=3)
            self._capture_thread = None

        if self._inference_thread is not None:
            self._inference_thread.join(timeout=3)
            self._inference_thread = None

        self._set_camera_state(connected=False, error=None)

    def get_latest_jpeg(self) -> bytes | None:
        frame = self._get_latest_frame()

        if frame is None:
            return None

        success, encoded = cv2.imencode(".jpg", frame)
        if not success:
            return None
        return encoded.tobytes()

    # 카메라 프레임은 YOLO 추론과 별개로 계속 수집한다.
    def _run_capture(self) -> None:
        # 바깥 반복은 연결·재연결, 안쪽 반복은 연결된 장치에서 프레임 읽기이다.
        while self.running:
            capture = cv2.VideoCapture(parse_camera_source(self.source))
            self._set_current_capture(capture)

            if not capture.isOpened():
                self._set_camera_state(
                    connected=False,
                    error=f"카메라를 열 수 없습니다: {self.source}",
                )
                self._discard_latest_frame()
                self._release_capture(capture)
                if self._stop_event.wait(CAMERA_RECONNECT_DELAY_SECONDS):
                    break
                continue

            consecutive_failures = 0

            while self.running:
                success, frame = capture.read()

                if not success:
                    consecutive_failures += 1
                    self._set_camera_state(
                        connected=False,
                        error="카메라 프레임을 읽지 못했습니다. 재연결을 시도합니다.",
                    )

                    if consecutive_failures >= MAX_CONSECUTIVE_READ_FAILURES:
                        self._discard_latest_frame()
                        break

                    if self._stop_event.wait(0.1):
                        break
                    continue

                consecutive_failures = 0
                self._set_camera_state(connected=True, error=None)

                with self._frame_lock:
                    self._latest_frame = frame

            self._release_capture(capture)

            if self.running and self._stop_event.wait(CAMERA_RECONNECT_DELAY_SECONDS):
                break

        self._release_current_capture()
        self._set_camera_state(connected=False, error=None)

    # 지정한 시간만큼 대기한 뒤 최신 프레임의 복사본을 분석한다.
    def _run_inference(self) -> None:
        while True:
            stop_requested = self._stop_event.wait(self.inference_interval)
            if stop_requested:
                return

            frame = self._get_latest_frame()

            if frame is None:
                continue

            layout = self.seat_service.get_layout()

            if not layout.seats:
                continue

            try:
                with self._inference_lock:
                    instant_statuses = analyze_frame(self.model, frame, layout.seats)
                # 분석 중 종료 요청이 왔다면 이전 모드의 결과를 반영하지 않는다.
                if self._stop_event.is_set():
                    return
                self.seat_service.update_statuses(instant_statuses)
                self._set_inference_error(None)
            except Exception as error:
                self._set_inference_error(f"YOLO 분석 실패: {error}")

    def _get_latest_frame(self):
        with self._frame_lock:
            if self._latest_frame is None:
                return None
            return self._latest_frame.copy()

    def _discard_latest_frame(self) -> None:
        with self._frame_lock:
            self._latest_frame = None

    def _set_current_capture(self, capture) -> None:
        with self._capture_lock:
            self._capture = capture

    def _release_capture(self, capture) -> None:
        with self._capture_lock:
            if self._capture is capture:
                self._capture = None
        capture.release()

    def _release_current_capture(self) -> None:
        with self._capture_lock:
            capture = self._capture
            self._capture = None

        if capture is not None:
            capture.release()

    def _set_camera_state(self, connected: bool, error: str | None) -> None:
        with self._state_lock:
            self._connected = connected
            self._camera_error = error

    def _set_inference_error(self, error: str | None) -> None:
        with self._state_lock:
            self._inference_error = error
