import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

from backend.domain.models import Layout, Point, SeatRoi, SeatStatus
from backend.domain.service import SeatService
from backend.vision.demo_video import DemoVideoManager, DemoVideoStateError


def make_test_video(path: Path, fps: float = 10.0, frame_count: int = 6) -> None:
    writer = cv2.VideoWriter(
        str(path),
        cv2.VideoWriter_fourcc(*"MJPG"),
        fps,
        (96, 64),
    )
    if not writer.isOpened():
        raise RuntimeError("테스트 영상을 만들 수 없습니다.")
    try:
        for index in range(frame_count):
            frame = np.full((64, 96, 3), index * 30, dtype=np.uint8)
            writer.write(frame)
    finally:
        writer.release()


def one_seat_layout() -> Layout:
    return Layout(seats=[SeatRoi(
        seat_id="T01-A-01",
        label="T01-A-01",
        polygon=[
            Point(x=0, y=0),
            Point(x=1, y=0),
            Point(x=1, y=1),
            Point(x=0, y=1),
        ],
    )])


class DemoVideoManagerTest(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.video_path = Path(self.temp_directory.name) / "demo.avi"
        make_test_video(self.video_path)
        self.service = SeatService()
        self.service.activate_layout(one_seat_layout())
        self.manager = DemoVideoManager(
            object(),
            self.service,
            inference_interval=0.05,
        )

    def tearDown(self):
        self.manager.shutdown()
        self.temp_directory.cleanup()

    def test_uploaded_video_is_streamed_and_actually_analyzed(self):
        self.manager.enter()
        info = self.manager.register_video(
            self.video_path,
            "demo-test",
            "demo.avi",
        )

        self.assertEqual(info.video_id, "demo-test")
        self.assertGreater(info.duration_seconds, 0)
        self.assertGreater(len(self.manager.preview()), 100)

        stream = self.manager.mjpeg_stream()
        first_part = next(stream)
        self.assertIn(b"Content-Type: image/jpeg", first_part)

        with patch(
            "backend.vision.demo_video.analyze_frame",
            return_value=[SeatStatus(seat_id="T01-A-01", status="empty")],
        ) as analyze:
            self.manager.start("demo-test")
            deadline = time.monotonic() + 3
            while (
                self.manager.status().status == "playing"
                and time.monotonic() < deadline
            ):
                time.sleep(0.02)

        status = self.manager.status()
        self.assertEqual(status.status, "completed")
        self.assertEqual(status.progress, 100)
        self.assertGreater(analyze.call_count, 0)

    def test_start_requires_roi(self):
        self.manager.enter()
        self.manager.register_video(self.video_path, "demo-test", "demo.avi")
        self.service.activate_layout(Layout())

        with self.assertRaises(DemoVideoStateError):
            self.manager.start("demo-test")

    def test_exit_removes_uploaded_video(self):
        self.manager.enter()
        self.manager.register_video(self.video_path, "demo-test", "demo.avi")

        self.manager.exit()

        self.assertEqual(self.manager.mode, "camera")
        self.assertFalse(self.video_path.exists())


if __name__ == "__main__":
    unittest.main()
