from pathlib import Path

from ultralytics import YOLO

from backend.domain.models import SeatRoi, SeatStatus

PERSON_CLASSES = {"person"}
BELONGING_CLASSES = {"backpack", "handbag", "suitcase", "book", "laptop"}

def load_model(model_path: str):
    path = Path(model_path)

    if not path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    return YOLO(str(path))

def format_yolo_results(results) -> list[dict]:
    detections = []
    result = results[0]

    for box in result.boxes:
        class_id = int(box.cls[0])
        class_name = result.names[class_id]
        confidence = float(box.conf[0])
        xyxy = box.xyxy[0].tolist()

        detections.append({
            "class_id": class_id,
            "class_name": class_name,
            "confidence": confidence,
            "box": xyxy,
        })

    return detections


def detect_frame(model, frame, confidence: float = 0.35) -> list[dict]:
    """OpenCV의 NumPy frame을 바로 YOLO에 전달한다."""

    results = model(frame, conf=confidence, verbose=False)
    return format_yolo_results(results)


def get_box_center(box: list[float]) -> tuple[float, float]:
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def is_point_in_polygon(point: tuple[float, float], seat: SeatRoi) -> bool:
    """ray casting 방식으로 정규화 중심점이 ROI 내부인지 확인한다."""

    x, y = point
    polygon = seat.polygon
    inside = False
    previous = polygon[-1]

    for current in polygon:
        crosses_y = (current.y > y) != (previous.y > y)
        if crosses_y:
            boundary_x = (
                (previous.x - current.x)
                * (y - current.y)
                / (previous.y - current.y)
                + current.x
            )
            if x < boundary_x:
                inside = not inside

        previous = current

    return inside


def assign_detections_to_seats(
    detections: list[dict],
    seats: list[SeatRoi],
    frame_width: int,
    frame_height: int,
) -> list[dict]:
    seat_results = []

    for seat in seats:
        seat_detections = []

        for detection in detections:
            center_x, center_y = get_box_center(detection["box"])
            normalized_center = (
                center_x / frame_width,
                center_y / frame_height,
            )

            if is_point_in_polygon(normalized_center, seat):
                seat_detections.append(detection)

        seat_results.append({
            "seat_id": seat.seat_id,
            "detections": seat_detections,
        })

    return seat_results

def decide_instant_status(detections: list[dict]) -> str:
    class_names = set()

    for detection in detections:
        class_names.add(detection["class_name"])

    has_person = bool(class_names & PERSON_CLASSES)
    has_belongings = bool(class_names & BELONGING_CLASSES)

    if has_person:
        return "occupied"

    if has_belongings:
        return "belongings_only"

    return "empty"

def build_seat_statuses(seat_results: list[dict]) -> list[SeatStatus]:
    statuses = []

    for seat_result in seat_results:
        instant_status = decide_instant_status(seat_result["detections"])
        statuses.append(SeatStatus(
            seat_id=seat_result["seat_id"],
            status=instant_status,
            detections=seat_result["detections"],
        ))

    return statuses


def analyze_frame(model, frame, seats: list[SeatRoi]) -> list[SeatStatus]:
    detections = detect_frame(model, frame)
    frame_height, frame_width = frame.shape[:2]
    seat_results = assign_detections_to_seats(
        detections,
        seats,
        frame_width,
        frame_height,
    )
    return build_seat_statuses(seat_results)
