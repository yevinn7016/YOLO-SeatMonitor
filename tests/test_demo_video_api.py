import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import backend.api.main as main
from backend.domain.models import Layout
from backend.vision.demo_video import DemoVideoManager
from test_demo_video import make_test_video, one_seat_layout


class FakeCameraWorker:
    def __init__(self) -> None:
        self.stop_calls = 0
        self.start_calls = 0

    def stop(self) -> None:
        self.stop_calls += 1

    def start(self) -> None:
        self.start_calls += 1


class DemoVideoApiTest(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp_directory.name)
        self.source_video = self.directory / "source.avi"
        make_test_video(self.source_video)

        self.original_manager = main.demo_manager
        self.original_camera = main.camera_worker
        self.original_video_directory = main.DEMO_VIDEO_DIRECTORY
        self.original_layout = main.seat_service.get_layout()

        self.camera = FakeCameraWorker()
        main.camera_worker = self.camera
        main.demo_manager = DemoVideoManager(
            object(),
            main.seat_service,
            inference_interval=0.05,
        )
        main.DEMO_VIDEO_DIRECTORY = self.directory / "uploads"
        self.client = TestClient(main.app)

        self.load_demo_patch = patch(
            "backend.api.main.load_demo_layout",
            return_value=Layout(),
        )
        self.load_camera_patch = patch(
            "backend.api.main.load_layout",
            return_value=self.original_layout,
        )
        self.save_demo_patch = patch("backend.api.main.save_demo_layout")
        self.load_demo_patch.start()
        self.load_camera_patch.start()
        self.save_demo_patch.start()

    def tearDown(self):
        self.client.close()
        if main.demo_manager is not None:
            main.demo_manager.shutdown()
        main.seat_service.activate_layout(self.original_layout)
        main.demo_manager = self.original_manager
        main.camera_worker = self.original_camera
        main.DEMO_VIDEO_DIRECTORY = self.original_video_directory
        self.save_demo_patch.stop()
        self.load_camera_patch.stop()
        self.load_demo_patch.stop()
        self.temp_directory.cleanup()

    def test_demo_page_flow_switches_camera_and_accepts_video_layout(self):
        enter = self.client.post("/api/demo/enter")
        self.assertEqual(enter.status_code, 200)
        self.assertEqual(enter.json()["mode"], "demo")
        self.assertEqual(self.camera.stop_calls, 1)

        with self.source_video.open("rb") as video:
            upload = self.client.post(
                "/api/demo/video",
                files={"video": ("source.avi", video, "video/x-msvideo")},
            )
        self.assertEqual(upload.status_code, 200)
        video_id = upload.json()["video_id"]

        preview = self.client.get("/api/demo/preview.jpg")
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.headers["content-type"], "image/jpeg")

        layout = self.client.put(
            "/api/demo/layout",
            json=one_seat_layout().model_dump(mode="json"),
        )
        self.assertEqual(layout.status_code, 200)

        with patch(
            "backend.vision.demo_video.analyze_frame",
            return_value=[],
        ):
            start = self.client.post(
                "/api/demo/start",
                json={"video_id": video_id},
            )
            self.assertEqual(start.status_code, 200)
            self.assertEqual(start.json()["status"], "playing")
            self.client.post("/api/demo/stop")

        exit_response = self.client.post("/api/demo/exit")
        self.assertEqual(exit_response.status_code, 200)
        self.assertEqual(exit_response.json()["mode"], "camera")
        self.assertEqual(self.camera.start_calls, 1)

    def test_upload_requires_demo_mode(self):
        with self.source_video.open("rb") as video:
            response = self.client.post(
                "/api/demo/video",
                files={"video": ("source.avi", video, "video/x-msvideo")},
            )

        self.assertEqual(response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
