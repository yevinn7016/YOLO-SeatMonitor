import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.sse import EventSourceResponse
from dotenv import load_dotenv
from starlette.concurrency import run_in_threadpool

from backend.domain.models import Layout, LayoutSuggestion, SeatStatus, Settings
from backend.domain.service import SeatService
from backend.vision.camera import CameraWorker
from backend.vision.detector import load_model
from backend.vision.roi_suggester import (
    DEFAULT_GEMINI_ROI_MODEL,
    MAX_ROI_IMAGE_BYTES,
    SUPPORTED_IMAGE_TYPES,
    InvalidRoiImageError,
    RoiSuggestionConfigurationError,
    RoiSuggestionProviderError,
    RoiSuggestionRateLimitError,
    suggest_layout_with_gemini,
)


load_dotenv()

MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "models/yolo26s.pt")
CAMERA_SOURCE = os.getenv("CAMERA_SOURCE", "0")
GEMINI_ROI_MODEL = os.getenv("GEMINI_ROI_MODEL", DEFAULT_GEMINI_ROI_MODEL)

seat_service = SeatService()
camera_worker: CameraWorker | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global camera_worker

    model = load_model(MODEL_PATH)
    camera_worker = CameraWorker(CAMERA_SOURCE, model, seat_service)
    camera_worker.start()

    yield

    camera_worker.stop()


app = FastAPI(
    title="도서관 좌석 관리 API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    layout = seat_service.get_layout()

    return {
        "status": "ok",
        "camera_connected": camera_worker.connected if camera_worker else False,
        "camera_error": camera_worker.error if camera_worker else None,
        "roi_configured": len(layout.seats) > 0,
        "seat_count": len(layout.seats),
        "roi_suggestion_available": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "roi_suggestion_model": GEMINI_ROI_MODEL,
    }


@app.get("/api/layout", response_model=Layout)
def get_layout():
    return seat_service.get_layout()


@app.put("/api/layout", response_model=Layout)
def put_layout(layout: Layout):
    return seat_service.replace_layout(layout)


@app.post("/api/layout/suggestions", response_model=LayoutSuggestion)
async def create_layout_suggestion(
    image: UploadFile = File(
        description="ROI 편집기에 표시할 카메라 캡처 이미지",
    ),
    additional_instructions: str | None = Form(
        default=None,
        max_length=500,
        description="재시도할 때 AI에 추가로 전달할 짧은 보정 지시",
    ),
):
    """AI 좌석 배치 후보를 만들며 layout.json에는 저장하지 않는다."""

    mime_type = image.content_type or ""

    if mime_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="JPEG, PNG, WebP 이미지만 사용할 수 있습니다.",
        )

    image_bytes = await image.read(MAX_ROI_IMAGE_BYTES + 1)
    await image.close()

    if len(image_bytes) > MAX_ROI_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="이미지 크기는 10MB 이하여야 합니다.")

    try:
        return await run_in_threadpool(
            suggest_layout_with_gemini,
            image_bytes,
            mime_type,
            os.getenv("GEMINI_API_KEY", "").strip(),
            GEMINI_ROI_MODEL,
            additional_instructions,
        )
    except InvalidRoiImageError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RoiSuggestionConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except RoiSuggestionRateLimitError as error:
        raise HTTPException(
            status_code=429,
            detail=str(error),
            headers={"Retry-After": "60"},
        ) from error
    except RoiSuggestionProviderError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/api/seats", response_model=list[SeatStatus])
def get_seats():
    return seat_service.get_statuses()


@app.post("/api/seats/reset", response_model=list[SeatStatus])
def reset_all_seat_timers():
    return seat_service.reset_all_timers()


@app.post("/api/seats/{seat_id}/reset", response_model=SeatStatus)
def reset_seat_timer(seat_id: str):
    try:
        return seat_service.reset_seat_timer(seat_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="존재하지 않는 좌석입니다.")


@app.get("/api/seats/stream", response_class=EventSourceResponse)
def stream_seats():
    for statuses in seat_service.status_events():
        yield [status.model_dump(mode="json") for status in statuses]


@app.get("/api/settings", response_model=Settings)
def get_settings():
    return seat_service.get_settings()


@app.put("/api/settings", response_model=Settings)
def put_settings(settings: Settings):
    return seat_service.replace_settings(settings)


@app.get("/api/camera/frame.jpg", response_class=Response)
def get_camera_frame():
    if camera_worker is None:
        raise HTTPException(status_code=503, detail="카메라 worker가 시작되지 않았습니다.")

    image = camera_worker.get_latest_jpeg()

    if image is None:
        raise HTTPException(status_code=503, detail="카메라 프레임이 아직 준비되지 않았습니다.")

    return Response(
        content=image,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )
