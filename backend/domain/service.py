import time
from threading import Lock

from backend.domain.models import Layout, SeatStatus, Settings
from backend.repositories.json_repository import (
    load_layout,
    load_settings,
    save_layout,
    save_settings,
)


OCCUPIED_CONFIRMATION_SECONDS = 4


class SeatService:
    """API와 카메라 worker가 함께 사용하는 현재 ROI와 좌석 상태."""

    def __init__(self) -> None:
        self._layout = load_layout()
        self._statuses: list[SeatStatus] = self._empty_statuses(self._layout)
        self._settings = load_settings()
        self._person_detected_since: dict[str, float] = {}
        self._away_started_at: dict[str, float] = {}
        self._lock = Lock()

    def get_layout(self) -> Layout:
        with self._lock:
            return self._layout.model_copy(deep=True)

    def replace_layout(self, layout: Layout) -> Layout:
        save_layout(layout)

        with self._lock:
            self._layout = layout
            self._statuses = self._empty_statuses(layout)
            self._person_detected_since = {}
            self._away_started_at = {}
            return self._layout.model_copy(deep=True)

    def get_statuses(self) -> list[SeatStatus]:
        with self._lock:
            return [status.model_copy(deep=True) for status in self._statuses]

    def get_settings(self) -> Settings:
        with self._lock:
            return self._settings.model_copy(deep=True)

    def replace_settings(self, settings: Settings) -> Settings:
        save_settings(settings)

        with self._lock:
            self._settings = settings
            return self._settings.model_copy(deep=True)

    def update_statuses(self, statuses: list[SeatStatus]) -> None:
        with self._lock:
            previous_by_id = {status.seat_id: status for status in self._statuses}
            now = time.monotonic()
            self._statuses = [
                self._transition_status(status, previous_by_id.get(status.seat_id), now)
                for status in statuses
            ]

    def _transition_status(
        self,
        instant_status: SeatStatus,
        previous_status: SeatStatus | None,
        now: float,
    ) -> SeatStatus:
        seat_id = instant_status.seat_id
        previous_value = previous_status.status if previous_status else "empty"

        if instant_status.status == "occupied":
            if previous_value == "occupied":
                self._person_detected_since.pop(seat_id, None)
                self._away_started_at.pop(seat_id, None)
                status = "occupied"
            else:
                detected_since = self._person_detected_since.setdefault(seat_id, now)
                if now - detected_since >= OCCUPIED_CONFIRMATION_SECONDS:
                    self._person_detected_since.pop(seat_id, None)
                    self._away_started_at.pop(seat_id, None)
                    status = "occupied"
                else:
                    status = previous_value
        else:
            self._person_detected_since.pop(seat_id, None)

            if instant_status.status == "belongings_only":
                away_since = self._away_started_at.setdefault(seat_id, now)
                if now - away_since >= self._settings.noshow_threshold_seconds:
                    status = "noshow"
                else:
                    status = "away"
            else:
                self._away_started_at.pop(seat_id, None)
                status = "empty"

        return SeatStatus(
            seat_id=seat_id,
            status=status,
            detections=instant_status.detections,
        )

    @staticmethod
    def _empty_statuses(layout: Layout) -> list[SeatStatus]:
        return [
            SeatStatus(seat_id=seat.seat_id, status="empty")
            for seat in layout.seats
        ]
