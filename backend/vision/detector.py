from pathlib import Path

from ultralytics import YOLO

from backend.domain.models import SeatRoi, SeatStatus

PERSON_CLASSES = {"person"}
BELONGING_CLASSES = {"backpack", "handbag", "suitcase", "book", "laptop"}
YOLO_MIN_CONFIDENCE = 0.25
PERSON_MIN_CONFIDENCE = 0.35
BELONGING_MIN_CONFIDENCE = 0.25


# 지정한 경로에서 YOLO 모델을 불러온다.
def load_model(model_path: str):
    path = Path(model_path)

    if not path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    return YOLO(str(path))


# YOLO 원본 결과를 객체별 정보 목록으로 정리한다.
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


# 카메라 프레임에서 신뢰도 기준 이상의 객체를 탐지한다.
def detect_frame(model, frame, confidence: float = YOLO_MIN_CONFIDENCE) -> list[dict]:
    """OpenCV의 NumPy frame을 바로 YOLO에 전달한다."""

    results = model(frame, conf=confidence, verbose=False)
    return format_yolo_results(results)


# 감지 사각형의 중심 좌표를 계산한다.
def get_box_center(box: list[float]) -> tuple[float, float]:
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


# 점이 좌석 ROI 다각형 내부에 있는지 레이캐스팅으로 확인한다.
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


# 감지된 객체를 중심점 위치에 따라 각 좌석에 배정한다.
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


# 좌석에서 감지된 객체를 바탕으로 즉시 상태를 판단한다.
def decide_instant_status(detections: list[dict]) -> str:
    has_person = any(
        detection["class_name"] in PERSON_CLASSES
        and float(detection.get("confidence", 1.0)) >= PERSON_MIN_CONFIDENCE
        for detection in detections
    )
    has_belongings = any(
        detection["class_name"] in BELONGING_CLASSES
        and float(detection.get("confidence", 1.0)) >= BELONGING_MIN_CONFIDENCE
        for detection in detections
    )

    if has_person:
        return "occupied"

    if has_belongings:
        return "belongings_only"

    return "empty"


# 좌석별 감지 결과를 좌석 상태 목록으로 변환한다.
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


# 프레임 감지부터 좌석별 상태 생성까지 전체 분석을 수행한다.
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
