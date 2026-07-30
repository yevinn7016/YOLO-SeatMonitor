import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from backend.domain.models import Layout, SeatStatus, Settings
from backend.domain.service import SeatService
from backend.vision.camera import CameraWorker
from backend.vision.detector import load_model


MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "models/yolo26s.pt")
CAMERA_SOURCE = os.getenv("CAMERA_SOURCE", "0")

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
    }


@app.get("/api/layout", response_model=Layout)
def get_layout():
    return seat_service.get_layout()


@app.put("/api/layout", response_model=Layout)
def put_layout(layout: Layout):
    return seat_service.replace_layout(layout)


@app.get("/api/seats", response_model=list[SeatStatus])
def get_seats():
    return seat_service.get_statuses()


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
