import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import cv2
import numpy as np

from backend.vision.roi_suggester import (
    InvalidRoiImageError,
    RoiSuggestionProviderError,
    _GeminiRoiResponse,
    build_layout_suggestion,
    inspect_image,
    suggest_layout_with_gemini,
)


class RoiSuggesterTest(unittest.TestCase):
    @patch("google.genai.Client")
    def test_gemini_response_is_converted_to_layout(self, client_class):
        success, encoded = cv2.imencode(
            ".jpg",
            np.full((180, 320, 3), 255, dtype=np.uint8),
        )
        self.assertTrue(success)
        client_class.return_value.interactions.create.return_value = SimpleNamespace(
            output_text=json.dumps({
                "seats": [{
                    "table_group": 1,
                    "polygon": [
                        {"x": 100, "y": 100},
                        {"x": 300, "y": 100},
                        {"x": 300, "y": 400},
                        {"x": 100, "y": 400},
                    ],
                }],
                "warnings": [],
            })
        )

        suggestion = suggest_layout_with_gemini(
            encoded.tobytes(),
            "image/jpeg",
            "test-api-key",
            "test-model",
        )

        self.assertEqual(suggestion.image_width, 320)
        self.assertEqual(suggestion.layout.seats[0].seat_id, "T01-A-01")
        call = client_class.return_value.interactions.create.call_args.kwargs
        self.assertEqual(call["model"], "test-model")
        self.assertEqual(call["input"][1]["mime_type"], "image/jpeg")
        self.assertEqual(call["response_format"]["mime_type"], "application/json")

    def test_candidates_are_normalized_and_grouped(self):
        payload = _GeminiRoiResponse.model_validate({
            "seats": [
                {
                    "table_group": 20,
                    "polygon": [
                        {"x": 600, "y": 100},
                        {"x": 700, "y": 100},
                        {"x": 700, "y": 300},
                        {"x": 600, "y": 300},
                    ],
                },
                {
                    "table_group": 10,
                    "polygon": [
                        {"x": 100, "y": 100},
                        {"x": 200, "y": 100},
                        {"x": 200, "y": 300},
                        {"x": 100, "y": 300},
                    ],
                },
            ]
        })

        suggestion = build_layout_suggestion(payload, "test-model", 1280, 720)

        self.assertEqual(
            [seat.seat_id for seat in suggestion.layout.seats],
            ["T01-A-01", "T02-A-01"],
        )
        self.assertEqual(suggestion.layout.seats[0].polygon[0].x, 0.1)
        self.assertFalse(suggestion.is_saved)

    def test_too_small_candidates_are_removed_with_warning(self):
        payload = _GeminiRoiResponse.model_validate({
            "seats": [
                {
                    "table_group": 1,
                    "polygon": [
                        {"x": 100, "y": 100},
                        {"x": 101, "y": 100},
                        {"x": 101, "y": 101},
                        {"x": 100, "y": 101},
                    ],
                }
            ]
        })

        with self.assertRaises(RoiSuggestionProviderError):
            build_layout_suggestion(payload, "test-model", 1280, 720)

    def test_invalid_image_is_rejected(self):
        with self.assertRaises(InvalidRoiImageError):
            inspect_image(b"not-an-image", "image/jpeg")


if __name__ == "__main__":
    unittest.main()
