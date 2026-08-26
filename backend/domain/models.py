from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(UTC)


class Point(BaseModel):
    """카메라 화면 안의 0~1 정규화 좌표."""

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class SeatRoi(BaseModel):
    seat_id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    polygon: list[Point] = Field(min_length=3)


class Layout(BaseModel):
    version: int = 1  # 레이아웃 데이터 형식 변경을 대비한 버전 번호.
    seats: list[SeatRoi] = Field(default_factory=list)


class LayoutSuggestion(BaseModel):
    """AI가 생성했지만 아직 저장되지 않은 좌석 배치 후보."""

    suggestion_id: str
    provider: Literal["gemini"] = "gemini"
    model: str
    generated_at: datetime = Field(default_factory=utc_now)
    image_width: int = Field(gt=0)
    image_height: int = Field(gt=0)
    is_saved: bool = False
    layout: Layout
    warnings: list[str] = Field(default_factory=list)


class SeatStatus(BaseModel):
    seat_id: str
    status: str
    detections: list[dict] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=utc_now)
    away_since: datetime | None = None


class Settings(BaseModel):
    noshow_threshold_seconds: int = Field(default=600, ge=1)


class DemoModeResponse(BaseModel):
    mode: Literal["camera", "demo"]
    status: str


class DemoVideoInfo(BaseModel):
    video_id: str
    filename: str
    status: Literal["uploaded"] = "uploaded"
    duration_seconds: float = Field(ge=0)
    fps: float = Field(gt=0)
    total_frames: int = Field(ge=0)


class DemoStartRequest(BaseModel):
    video_id: str = Field(min_length=1)


class DemoStatus(BaseModel):
    mode: Literal["camera", "demo"]
    video_id: str | None = None
    filename: str | None = None
    status: Literal[
        "idle",
        "uploaded",
        "playing",
        "completed",
        "stopped",
        "error",
    ]
    current_frame: int = Field(default=0, ge=0)
    total_frames: int = Field(default=0, ge=0)
    current_seconds: float = Field(default=0, ge=0)
    duration_seconds: float = Field(default=0, ge=0)
    progress: float = Field(default=0, ge=0, le=100)
    error: str | None = None
