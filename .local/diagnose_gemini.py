import base64
import os
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from google import genai

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.vision.roi_suggester import GEMINI_ROI_RESPONSE_SCHEMA


load_dotenv()
model = os.getenv("GEMINI_ROI_MODEL", "gemini-3.7-flash")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
success, encoded = cv2.imencode(
    ".png",
    np.full((64, 64, 3), 255, dtype=np.uint8),
)
assert success

image_input = {
    "type": "image",
    "data": base64.b64encode(encoded.tobytes()).decode("ascii"),
    "mime_type": "image/png",
}

seat_group_schema = {
    "type": "object",
    "properties": {
        "seats": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"table_group": {"type": "integer"}},
                "required": ["table_group"],
            },
        }
    },
    "required": ["seats"],
}

polygon_schema = {
    "type": "object",
    "properties": {
        "seats": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "table_group": {"type": "integer"},
                    "polygon": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "x": {"type": "integer"},
                                "y": {"type": "integer"},
                            },
                            "required": ["x", "y"],
                        },
                    },
                },
                "required": ["table_group", "polygon"],
            },
        }
    },
    "required": ["seats"],
}

variants = [
    (
        "image_only",
        {
            "model": model,
            "input": [
                {"type": "text", "text": "Describe this image in one word."},
                image_input,
            ],
        },
    ),
    (
        "simple_json_schema",
        {
            "model": model,
            "input": [
                {"type": "text", "text": "Return a JSON object with count set to 0."},
                image_input,
            ],
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": {
                    "type": "object",
                    "properties": {"count": {"type": "integer"}},
                    "required": ["count"],
                },
            },
        },
    ),
    (
        "seat_group_schema",
        {
            "model": model,
            "input": [
                {"type": "text", "text": "Return an empty seats list."},
                image_input,
            ],
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": seat_group_schema,
            },
        },
    ),
    (
        "polygon_schema",
        {
            "model": model,
            "input": [
                {"type": "text", "text": "Return an empty seats list."},
                image_input,
            ],
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": polygon_schema,
            },
        },
    ),
    (
        "full_roi_schema",
        {
            "model": model,
            "input": [
                {"type": "text", "text": "Return empty seats and warnings lists."},
                image_input,
            ],
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": GEMINI_ROI_RESPONSE_SCHEMA,
            },
        },
    ),
]

for name, arguments in variants[-2:-1]:
    try:
        response = client.interactions.create(timeout=120.0, **arguments)
        print(name, "OK", response.output_text)
    except Exception as error:
        message = re.sub(r"AIza[0-9A-Za-z_-]+", "<API_KEY>", str(error))
        print(name, "ERROR", type(error).__name__, message)
