import time
from threading import Lock, Thread

import cv2

from backend.domain.service import SeatService
from backend.vision.detector import analyze_frame


def parse_camera_source(source: str) -> int | str:
    return int(source) if source.isdigit() else source


class CameraWorker:
    """카메라 프레임을 계속 읽고 2초마다 현재 ROI를 분석한다."""

    def __init__(
        self,
        source: str,
        model,
        seat_service: SeatService,
        inference_interval: float = 2.0,
    ) -> None:
        self.source = source
        self.model = model
        self.seat_service = seat_service
        self.inference_interval = inference_interval
        self.running = False
        self.connected = False
        self.error: str | None = None
        self._thread: Thread | None = None
        self._capture = None
        self._latest_frame = None
        self._frame_lock = Lock()

    def start(self) -> None:
        if self.running:
            return

        self.running = True
        self._thread = Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self.running = False

        if self._thread is not None:
            self._thread.join(timeout=3)
            self._thread = None

        if self._capture is not None:
            self._capture.release()
            self._capture = None

        self.connected = False

    def get_latest_jpeg(self) -> bytes | None:
        with self._frame_lock:
            if self._latest_frame is None:
                return None
            frame = self._latest_frame.copy()

        success, encoded = cv2.imencode(".jpg", frame)
        return encoded.tobytes() if success else None

    def _run(self) -> None:
        self._capture = cv2.VideoCapture(parse_camera_source(self.source))

        if not self._capture.isOpened():
            self.error = f"카메라를 열 수 없습니다: {self.source}"
            self.running = False
            return

        self.connected = True
        self.error = None
        last_inference_at = 0.0

        while self.running:
            success, frame = self._capture.read()

            if not success:
                self.error = "카메라 프레임을 읽지 못했습니다."
                time.sleep(0.1)
                continue

            with self._frame_lock:
                self._latest_frame = frame

            now = time.monotonic()
            if now - last_inference_at < self.inference_interval:
                continue

            last_inference_at = now
            layout = self.seat_service.get_layout()

            if not layout.seats:
                continue

            try:
                statuses = analyze_frame(self.model, frame, layout.seats)
                self.seat_service.update_statuses(statuses)
                self.error = None
            except Exception as error:
                self.error = f"YOLO 분석 실패: {error}"

        self._capture.release()
        self._capture = None
        self.connected = False
