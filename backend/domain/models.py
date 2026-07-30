from pydantic import BaseModel, Field


class Point(BaseModel):
    """카메라 화면 안의 0~1 정규화 좌표."""

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class SeatRoi(BaseModel):
    seat_id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    polygon: list[Point] = Field(min_length=4, max_length=4)


class Layout(BaseModel):
    version: int = 1  # 레이아웃 데이터 형식 변경을 대비한 버전 번호.
    seats: list[SeatRoi] = Field(default_factory=list)


class SeatStatus(BaseModel):
    seat_id: str
    status: str
    detections: list[dict] = Field(default_factory=list)


class Settings(BaseModel):
    noshow_threshold_seconds: int = Field(default=600, ge=1)
