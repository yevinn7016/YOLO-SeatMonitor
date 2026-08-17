import base64
import logging
from collections import defaultdict
from uuid import uuid4

import cv2
import numpy as np
from pydantic import BaseModel, Field, ValidationError

from backend.domain.models import Layout, LayoutSuggestion, Point, SeatRoi


DEFAULT_GEMINI_ROI_MODEL = "gemini-3.7-flash"
SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_ROI_IMAGE_BYTES = 10 * 1024 * 1024
MIN_NORMALIZED_POLYGON_AREA = 0.0001
GEMINI_REQUEST_TIMEOUT_SECONDS = 120.0

logger = logging.getLogger(__name__)

ROI_SUGGESTION_PROMPT = """
Analyze this fixed-camera image of a library, classroom, or study area.

Return one candidate occupancy ROI for every individual seat that can be used by
an object-detection based seat monitor.

Important rules:
- Do NOT trace only the visible chair boundary.
- Each ROI is the operational area where the center of a seated person's detection
  box is expected to appear.
- Include the corresponding desk/workspace portion where that person's laptop,
  book, or bag is expected, but avoid neighboring seats and shared aisles.
- Infer the area even when it includes empty space above or in front of a chair.
- Use at least three polygon points and choose as many vertices as needed to
  represent the operational seat area. Do not force every ROI into a quadrilateral.
- Keep each polygon as simple as possible and return its points clockwise.
- Keep different seat ROIs from overlapping as much as possible.
- Group seats belonging to the same physical table with the same positive
  table_group integer. The integer itself is only a grouping hint.
- Return polygon points clockwise using x/y coordinates normalized to 0..1000
  relative to the original image (x: left to right, y: top to bottom).
- Return every visible seat once. Do not return table-only or aisle regions.
""".strip()

# Interactions API가 일부 JSON Schema 제약 조합을 거부하므로 요청 스키마는
# 최소 구조만 제공하고 좌표 범위와 배열 길이는 아래 Pydantic 모델로 검증한다.
GEMINI_ROI_RESPONSE_SCHEMA = {
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
        },
    },
    "required": ["seats"],
}


class RoiSuggestionError(RuntimeError):
    """ROI 후보 생성 과정의 기본 오류."""


class RoiSuggestionConfigurationError(RoiSuggestionError):
    """API 키나 라이브러리 설정이 준비되지 않은 경우."""


class RoiSuggestionProviderError(RoiSuggestionError):
    """Gemini 호출 또는 응답 처리에 실패한 경우."""


class RoiSuggestionRateLimitError(RoiSuggestionProviderError):
    """Gemini 요청 한도를 초과한 경우."""


class InvalidRoiImageError(RoiSuggestionError):
    """업로드된 파일이 지원되는 이미지가 아닌 경우."""


class _GeminiPoint(BaseModel):
    x: int = Field(
        ge=0,
        le=1000,
        description="Horizontal coordinate normalized to 0..1000.",
    )
    y: int = Field(
        ge=0,
        le=1000,
        description="Vertical coordinate normalized to 0..1000.",
    )


class _GeminiSeatCandidate(BaseModel):
    table_group: int = Field(
        ge=1,
        description="Grouping hint shared by seats at the same physical table.",
    )
    polygon: list[_GeminiPoint] = Field(
        min_length=3,
        description="Clockwise corners of the operational seat ROI.",
    )


class _GeminiRoiResponse(BaseModel):
    seats: list[_GeminiSeatCandidate] = Field(
        default_factory=list,
        max_length=100,
        description="Every visible individual seat exactly once.",
    )
    warnings: list[str] = Field(
        default_factory=list,
        max_length=20,
        description="Uncertainty, occlusion, or possibly missed seats.",
    )


def inspect_image(image_bytes: bytes, mime_type: str) -> tuple[int, int]:
    if mime_type not in SUPPORTED_IMAGE_TYPES:
        raise InvalidRoiImageError("JPEG, PNG, WebP 이미지만 사용할 수 있습니다.")

    if not image_bytes:
        raise InvalidRoiImageError("업로드된 이미지가 비어 있습니다.")

    if len(image_bytes) > MAX_ROI_IMAGE_BYTES:
        raise InvalidRoiImageError("이미지 크기는 10MB 이하여야 합니다.")

    encoded = np.frombuffer(image_bytes, dtype=np.uint8)
    decoded = cv2.imdecode(encoded, cv2.IMREAD_COLOR)

    if decoded is None:
        raise InvalidRoiImageError("올바른 이미지 파일이 아닙니다.")

    height, width = decoded.shape[:2]
    return width, height


def _polygon_area(points: list[Point]) -> float:
    area = 0.0

    for index, point in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        area += point.x * next_point.y - next_point.x * point.y

    return abs(area) / 2.0


def _polygon_center(candidate: _GeminiSeatCandidate) -> tuple[float, float]:
    x = sum(point.x for point in candidate.polygon) / len(candidate.polygon)
    y = sum(point.y for point in candidate.polygon) / len(candidate.polygon)
    return x, y


def _candidate_to_points(candidate: _GeminiSeatCandidate) -> list[Point]:
    return [
        Point(x=point.x / 1000.0, y=point.y / 1000.0)
        for point in candidate.polygon
    ]


def build_layout_suggestion(
    payload: _GeminiRoiResponse,
    model: str,
    image_width: int,
    image_height: int,
) -> LayoutSuggestion:
    grouped_candidates: dict[int, list[_GeminiSeatCandidate]] = defaultdict(list)
    warnings = list(payload.warnings)

    for index, candidate in enumerate(payload.seats, start=1):
        points = _candidate_to_points(candidate)

        if _polygon_area(points) < MIN_NORMALIZED_POLYGON_AREA:
            warnings.append(f"너무 작은 {index}번 좌석 후보를 제외했습니다.")
            continue

        grouped_candidates[candidate.table_group].append(candidate)

    def group_center(group: list[_GeminiSeatCandidate]) -> tuple[float, float]:
        centers = [_polygon_center(candidate) for candidate in group]
        center_x = sum(center[0] for center in centers) / len(centers)
        center_y = sum(center[1] for center in centers) / len(centers)
        return center_y, center_x

    ordered_groups = sorted(grouped_candidates.values(), key=group_center)
    seats: list[SeatRoi] = []

    for table_index, candidates in enumerate(ordered_groups, start=1):
        ordered_seats = sorted(
            candidates,
            key=lambda candidate: (
                _polygon_center(candidate)[1],
                _polygon_center(candidate)[0],
            ),
        )

        for seat_index, candidate in enumerate(ordered_seats, start=1):
            seat_id = f"T{table_index:02d}-A-{seat_index:02d}"
            seats.append(SeatRoi(
                seat_id=seat_id,
                label=seat_id,
                polygon=_candidate_to_points(candidate),
            ))

    if not seats:
        logger.warning("Gemini ROI 응답에 유효한 좌석 후보가 없습니다.")
        raise RoiSuggestionProviderError(
            "AI가 유효한 좌석 영역을 찾지 못했습니다. 다른 사진으로 다시 시도해 주세요."
        )

    return LayoutSuggestion(
        suggestion_id=str(uuid4()),
        model=model,
        image_width=image_width,
        image_height=image_height,
        layout=Layout(seats=seats),
        warnings=warnings,
    )


def suggest_layout_with_gemini(
    image_bytes: bytes,
    mime_type: str,
    api_key: str,
    model: str = DEFAULT_GEMINI_ROI_MODEL,
    additional_instructions: str | None = None,
) -> LayoutSuggestion:
    if not api_key:
        raise RoiSuggestionConfigurationError(
            "GEMINI_API_KEY 환경변수가 설정되지 않았습니다."
        )

    image_width, image_height = inspect_image(image_bytes, mime_type)
    prompt = ROI_SUGGESTION_PROMPT

    if additional_instructions:
        prompt += f"\n\nAdditional operator instructions:\n{additional_instructions.strip()}"

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        interaction = client.interactions.create(
            model=model,
            input=[
                {"type": "text", "text": prompt},
                {
                    "type": "image",
                    "data": base64.b64encode(image_bytes).decode("ascii"),
                    "mime_type": mime_type,
                },
            ],
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": GEMINI_ROI_RESPONSE_SCHEMA,
            },
            generation_config={"thinking_level": "medium"},
            timeout=GEMINI_REQUEST_TIMEOUT_SECONDS,
        )
        payload = _GeminiRoiResponse.model_validate_json(interaction.output_text)
    except ImportError as error:
        raise RoiSuggestionConfigurationError(
            "google-genai 패키지가 설치되지 않았습니다."
        ) from error
    except ValidationError as error:
        logger.error("Gemini ROI 응답 검증 실패: %s", error)
        raise RoiSuggestionProviderError(
            "AI 응답의 좌석 좌표 형식이 올바르지 않습니다. 다시 시도해 주세요."
        ) from error
    except RoiSuggestionError:
        raise
    except Exception as error:
        safe_message = str(error).replace(api_key, "<API_KEY>")
        logger.error(
            "Gemini ROI 요청 실패 [%s]: %s",
            type(error).__name__,
            safe_message,
        )
        status_code = getattr(error, "status_code", None)

        if status_code == 429 or type(error).__name__ == "RateLimitError":
            raise RoiSuggestionRateLimitError(
                "Gemini 요청 한도를 초과했습니다. 약 1분 후 다시 시도해 주세요."
            ) from error

        raise RoiSuggestionProviderError(
            "Gemini 좌석 분석에 실패했습니다. 잠시 후 다시 시도해 주세요."
        ) from error

    return build_layout_suggestion(
        payload=payload,
        model=model,
        image_width=image_width,
        image_height=image_height,
    )
