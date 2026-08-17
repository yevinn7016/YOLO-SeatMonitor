import unittest
from io import BytesIO
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

from backend.api.main import app
from backend.domain.models import Layout, LayoutSuggestion, Point, SeatRoi
from backend.vision.roi_suggester import RoiSuggestionRateLimitError


def make_jpeg() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (320, 180), "white").save(buffer, format="JPEG")
    return buffer.getvalue()


class LayoutSuggestionApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    @patch("backend.api.main.suggest_layout_with_gemini")
    def test_returns_unsaved_layout_candidate(self, suggest):
        suggest.return_value = LayoutSuggestion(
            suggestion_id="test-suggestion",
            model="test-model",
            image_width=320,
            image_height=180,
            layout=Layout(seats=[SeatRoi(
                seat_id="T01-A-01",
                label="T01-A-01",
                polygon=[
                    Point(x=0.1, y=0.1),
                    Point(x=0.2, y=0.1),
                    Point(x=0.2, y=0.3),
                    Point(x=0.1, y=0.3),
                ],
            )]),
        )

        response = self.client.post(
            "/api/layout/suggestions",
            files={"image": ("frame.jpg", make_jpeg(), "image/jpeg")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["is_saved"])
        self.assertEqual(response.json()["layout"]["seats"][0]["seat_id"], "T01-A-01")

    def test_rejects_unsupported_content_type(self):
        response = self.client.post(
            "/api/layout/suggestions",
            files={"image": ("frame.txt", b"not-an-image", "text/plain")},
        )

        self.assertEqual(response.status_code, 415)

    @patch("backend.api.main.suggest_layout_with_gemini")
    def test_returns_retryable_status_when_gemini_limit_is_exceeded(self, suggest):
        suggest.side_effect = RoiSuggestionRateLimitError("잠시 후 다시 시도해 주세요.")

        response = self.client.post(
            "/api/layout/suggestions",
            files={"image": ("frame.jpg", make_jpeg(), "image/jpeg")},
        )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["Retry-After"], "60")


if __name__ == "__main__":
    unittest.main()
