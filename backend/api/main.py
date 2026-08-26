import os
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.sse import EventSourceResponse
from dotenv import load_dotenv
from starlette.concurrency import run_in_threadpool

from backend.domain.models import (
    DemoModeResponse,
    DemoStartRequest,
    DemoStatus,
    DemoVideoInfo,
    Layout,
    LayoutSuggestion,
    SeatStatus,
    Settings,
)
from backend.domain.service import SeatService
from backend.repositories.json_repository import (
    load_demo_layout,
    load_layout,
    save_demo_layout,
)
from backend.vision.camera import CameraWorker
from backend.vision.demo_video import (
    DemoVideoManager,
    DemoVideoStateError,
    InvalidDemoVideoError,
)
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
DEMO_VIDEO_DIRECTORY = Path(os.getenv("DEMO_VIDEO_DIRECTORY", "data/demo"))
MAX_DEMO_VIDEO_BYTES = int(os.getenv("MAX_DEMO_VIDEO_BYTES", 500 * 1024 * 1024))
SUPPORTED_DEMO_VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}

seat_service = SeatService()
camera_worker: CameraWorker | None = None
demo_manager: DemoVideoManager | None = None
source_mode_lock = Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global camera_worker, demo_manager

    model = load_model(MODEL_PATH)
    inference_lock = Lock()
    camera_worker = CameraWorker(
        CAMERA_SOURCE,
        model,
        seat_service,
        inference_lock=inference_lock,
    )
    demo_manager = DemoVideoManager(model, seat_service, inference_lock)
    camera_worker.start()

    yield

    demo_manager.shutdown()
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
    active_source = demo_manager.mode if demo_manager else "camera"
    demo_status = demo_manager.status().status if demo_manager else "idle"

    return {
        "status": "ok",
        "active_source": active_source,
        "camera_connected": camera_worker.connected if camera_worker else False,
        "camera_error": camera_worker.error if camera_worker else None,
        "demo_status": demo_status,
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
    if demo_manager is not None and demo_manager.mode == "demo":
        raise HTTPException(
            status_code=409,
            detail="시연 모드에서는 /api/demo/layout에 ROI를 저장해야 합니다.",
        )
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


def require_demo_manager() -> DemoVideoManager:
    if demo_manager is None:
        raise HTTPException(status_code=503, detail="시연 영상 관리자가 시작되지 않았습니다.")
    return demo_manager


def require_demo_mode() -> DemoVideoManager:
    manager = require_demo_manager()
    if manager.mode != "demo":
        raise HTTPException(status_code=409, detail="먼저 시연 모드로 진입해야 합니다.")
    return manager


@app.post("/api/demo/enter", response_model=DemoModeResponse)
def enter_demo_mode():
    manager = require_demo_manager()
    demo_layout = load_demo_layout()
    with source_mode_lock:
        if manager.mode != "demo":
            if camera_worker is not None:
                camera_worker.stop()
            seat_service.activate_layout(demo_layout)
            manager.enter()
    return DemoModeResponse(mode="demo", status=manager.status().status)


@app.post("/api/demo/video", response_model=DemoVideoInfo)
async def upload_demo_video(video: UploadFile = File(description="시연용 영상 파일")):
    manager = require_demo_mode()
    filename = video.filename or "demo-video"
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_DEMO_VIDEO_SUFFIXES:
        await video.close()
        raise HTTPException(
            status_code=415,
            detail="MP4, MOV, AVI, MKV, WebM 영상만 업로드할 수 있습니다.",
        )

    video_id = f"demo-{uuid4().hex}"
    DEMO_VIDEO_DIRECTORY.mkdir(parents=True, exist_ok=True)
    destination = DEMO_VIDEO_DIRECTORY / f"{video_id}{suffix}"
    written = 0

    try:
        with destination.open("wb") as output:
            while chunk := await video.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_DEMO_VIDEO_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="시연 영상 크기 제한을 초과했습니다.",
                    )
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await video.close()

    try:
        return await run_in_threadpool(
            manager.register_video,
            destination,
            video_id,
            filename,
        )
    except InvalidDemoVideoError as error:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(error)) from error
    except DemoVideoStateError as error:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.get("/api/demo/preview.jpg", response_class=Response)
def get_demo_preview():
    manager = require_demo_mode()
    try:
        image = manager.preview()
    except DemoVideoStateError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return Response(
        content=image,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/demo/layout", response_model=Layout)
def get_demo_layout():
    return load_demo_layout()


@app.put("/api/demo/layout", response_model=Layout)
def put_demo_layout(layout: Layout):
    require_demo_mode()
    save_demo_layout(layout)
    return seat_service.activate_layout(layout)


@app.post("/api/demo/start", response_model=DemoStatus)
def start_demo_video(request: DemoStartRequest):
    manager = require_demo_mode()
    seat_service.activate_layout(seat_service.get_layout())
    try:
        return manager.start(request.video_id)
    except DemoVideoStateError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.post("/api/demo/stop", response_model=DemoStatus)
def stop_demo_video():
    manager = require_demo_mode()
    return manager.stop()


@app.get("/api/demo/status", response_model=DemoStatus)
def get_demo_status():
    return require_demo_manager().status()


@app.get("/api/demo/stream", response_class=StreamingResponse)
def stream_demo_video():
    manager = require_demo_mode()
    return StreamingResponse(
        manager.mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/demo/exit", response_model=DemoModeResponse)
def exit_demo_mode():
    manager = require_demo_manager()
    camera_layout = load_layout()
    with source_mode_lock:
        manager.exit()
        seat_service.activate_layout(camera_layout)
        if camera_worker is not None:
            camera_worker.start()
    return DemoModeResponse(mode="camera", status="running")


@app.get("/api/camera/frame.jpg", response_class=Response)
def get_camera_frame():
    if camera_worker is None:
        raise HTTPException(status_code=503, detail="카메라 worker가 시작되지 않았습니다.")
    if demo_manager is not None and demo_manager.mode == "demo":
        raise HTTPException(status_code=409, detail="현재 시연 영상 모드입니다.")

    image = camera_worker.get_latest_jpeg()

    if image is None:
        raise HTTPException(status_code=503, detail="카메라 프레임이 아직 준비되지 않았습니다.")

    return Response(
        content=image,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )
