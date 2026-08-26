import time
from collections.abc import Iterator
from datetime import UTC, datetime
from queue import Empty, Full, Queue
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

    # 저장된 좌석 배치와 운영 설정을 불러와 초기 상태를 만든다.
    def __init__(self) -> None:
        self._layout = load_layout()
        self._statuses: list[SeatStatus] = self._empty_statuses(self._layout)
        self._settings = load_settings()
        self._person_detected_since: dict[str, float] = {}
        self._away_started_at: dict[str, float] = {}
        self._away_started_wall_at: dict[str, datetime] = {}
        self._subscribers: set[Queue[list[SeatStatus]]] = set() #큐 하나가 구독자 한명
        self._lock = Lock()

    # 현재 좌석 배치의 복사본을 반환한다.
    def get_layout(self) -> Layout:
        with self._lock:
            return self._layout.model_copy(deep=True)

    # 새 좌석 배치를 저장하고 좌석 상태 기록을 초기화한다.
    def replace_layout(self, layout: Layout) -> Layout:
        save_layout(layout)

        return self.activate_layout(layout)

    # 저장 파일을 건드리지 않고 현재 실행에서 사용할 좌석 배치만 교체한다.
    def activate_layout(self, layout: Layout) -> Layout:
        with self._lock:
            self._layout = layout.model_copy(deep=True)
            self._statuses = self._empty_statuses(layout)
            self._person_detected_since = {}
            self._away_started_at = {}
            self._away_started_wall_at = {}
            self._notify_subscribers_locked()
            return self._layout.model_copy(deep=True)

    # 현재 좌석 상태 목록의 복사본을 반환한다.
    def get_statuses(self) -> list[SeatStatus]:
        with self._lock:
            return [status.model_copy(deep=True) for status in self._statuses]

    # 현재 운영 설정의 복사본을 반환한다.
    def get_settings(self) -> Settings:
        with self._lock:
            return self._settings.model_copy(deep=True)

    # 새 운영 설정을 저장하고 메모리의 설정값을 갱신한다.
    def replace_settings(self, settings: Settings) -> Settings:
        save_settings(settings)

        with self._lock:
            self._settings = settings
            return self._settings.model_copy(deep=True)

    # 최신 감지 결과를 상태 전환 규칙에 따라 좌석 상태로 갱신한다.
    def update_statuses(self, statuses: list[SeatStatus]) -> None:
        with self._lock:
            previous_by_id = {status.seat_id: status for status in self._statuses}
            now = time.monotonic()
            wall_now = datetime.now(UTC)
            next_statuses = [
                self._transition_status(
                    status,
                    previous_by_id.get(status.seat_id),
                    now,
                    wall_now,
                )
                for status in statuses
            ]
            status_changed = any(
                previous_by_id.get(status.seat_id) is None
                or previous_by_id[status.seat_id].status != status.status
                for status in next_statuses
            )
            self._statuses = next_statuses

            if status_changed:
                self._notify_subscribers_locked()

    # 특정 좌석의 자리 비움/노쇼 판정 타이머를 초기화한다.
    def reset_seat_timer(self, seat_id: str) -> SeatStatus:
        with self._lock:
            index = next(
                (i for i, status in enumerate(self._statuses) if status.seat_id == seat_id),
                None,
            )
            if index is None:
                raise KeyError(seat_id)

            now = time.monotonic()
            wall_now = datetime.now(UTC)
            should_notify = self._statuses[index].status in {"away", "noshow"}
            reset_status = self._reset_timer_locked(self._statuses[index], now, wall_now)
            self._statuses[index] = reset_status
            if should_notify:
                self._notify_subscribers_locked()
            return reset_status.model_copy(deep=True)

    # 모든 좌석의 자리 비움/노쇼 판정 타이머를 한꺼번에 초기화한다.
    def reset_all_timers(self) -> list[SeatStatus]:
        with self._lock:
            now = time.monotonic()
            wall_now = datetime.now(UTC)
            should_notify = any(
                status.status in {"away", "noshow"}
                for status in self._statuses
            )
            self._statuses = [
                self._reset_timer_locked(status, now, wall_now)
                for status in self._statuses
            ]
            if should_notify:
                self._notify_subscribers_locked()
            return self._copy_statuses_locked()

    # SSE 연결 하나가 사용할 변경 알림 큐를 등록한다.
    def subscribe(self) -> Queue[list[SeatStatus]]:
        subscriber: Queue[list[SeatStatus]] = Queue(maxsize=1)
        with self._lock:
            self._subscribers.add(subscriber)
            subscriber.put_nowait(self._copy_statuses_locked())
        return subscriber

    # SSE 연결이 끝나면 해당 알림 큐를 제거한다.
    def unsubscribe(self, subscriber: Queue[list[SeatStatus]]) -> None:
        with self._lock:
            self._subscribers.discard(subscriber)

    # 연결 직후 현재 상태를 한 번 보내고, 이후 실제 변경이 있을 때만 새 상태를 보낸다.
    def status_events(self) -> Iterator[list[SeatStatus]]:
        subscriber = self.subscribe()
        try:
            while True:
                try:
                    yield subscriber.get(timeout=1)
                except Empty:
                    continue
        finally:
            self.unsubscribe(subscriber)

    # 감지 결과와 이전 상태를 비교해 한 좌석의 다음 상태를 결정한다.
    def _transition_status(
        self,
        instant_status: SeatStatus,
        previous_status: SeatStatus | None,
        now: float,
        wall_now: datetime,
    ) -> SeatStatus:
        seat_id = instant_status.seat_id
        previous_value = previous_status.status if previous_status else "empty"

        if instant_status.status == "occupied":
            # 이미 점유 중인 좌석은 사람 감지가 이어지는 동안 점유 상태를 유지한다.
            if previous_value == "occupied":
                self._person_detected_since.pop(seat_id, None)
                self._away_started_at.pop(seat_id, None)
                self._away_started_wall_at.pop(seat_id, None)
                status = "occupied"
            else:
                # 처음 감지된 사람은 4초 동안 계속 보여야 점유로 확정한다.
                detected_since = self._person_detected_since.setdefault(seat_id, now)
                if now - detected_since >= OCCUPIED_CONFIRMATION_SECONDS:
                    # 연속 감지가 확인되면 자리 비움 시간을 지우고 점유로 바꾼다.
                    self._person_detected_since.pop(seat_id, None)
                    self._away_started_at.pop(seat_id, None)
                    self._away_started_wall_at.pop(seat_id, None)
                    status = "occupied"
                else:
                    # 지나가는 사람일 수 있으므로 이전 상태를 그대로 유지한다.
                    status = previous_value
        else:
            # 사람이 사라지면 점유 확인을 위한 연속 감지 시간을 취소한다.
            self._person_detected_since.pop(seat_id, None)

            if instant_status.status == "belongings_only":
                # 소지품만 있으면 처음 자리 비움 시각부터 경과 시간을 잰다.
                away_since = self._away_started_at.setdefault(seat_id, now)
                self._away_started_wall_at.setdefault(seat_id, wall_now)
                if now - away_since >= self._settings.noshow_threshold_seconds:
                    # 설정한 기준 시간을 넘기면 노쇼 상태로 바꾼다.
                    status = "noshow"
                else:
                    status = "away"
            else:
                # 사람과 소지품이 모두 없으면 자리 비움 기록을 지우고 빈자리로 바꾼다.
                self._away_started_at.pop(seat_id, None)
                self._away_started_wall_at.pop(seat_id, None)
                status = "empty"

        status_changed = previous_status is None or previous_value != status
        updated_at = (
            wall_now
            if status_changed
            else previous_status.updated_at
        )

        if status in {"away", "noshow"}:
            away_since_value = self._away_started_wall_at.get(seat_id)
            if away_since_value is None and previous_status is not None:
                away_since_value = previous_status.away_since
        else:
            away_since_value = None

        return SeatStatus(
            seat_id=seat_id,
            status=status,
            detections=instant_status.detections,
            updated_at=updated_at,
            away_since=away_since_value,
        )

    # 한 좌석의 현재 상태에 맞춰 관련 타이머만 초기화한다.
    def _reset_timer_locked(
        self,
        current: SeatStatus,
        now: float,
        wall_now: datetime,
    ) -> SeatStatus:
        seat_id = current.seat_id

        if current.status in {"away", "noshow"}:
            self._away_started_at[seat_id] = now
            self._away_started_wall_at[seat_id] = wall_now
            next_status = "away"
            updated_at = wall_now if current.status == "noshow" else current.updated_at
            away_since = wall_now
        else:
            self._away_started_at.pop(seat_id, None)
            self._away_started_wall_at.pop(seat_id, None)
            next_status = current.status
            updated_at = current.updated_at
            away_since = None

        return SeatStatus(
            seat_id=seat_id,
            status=next_status,
            detections=current.detections,
            updated_at=updated_at,
            away_since=away_since,
        )

    # 잠금을 이미 가진 상태에서 현재 좌석 목록의 복사본을 만든다.
    def _copy_statuses_locked(self) -> list[SeatStatus]:
        return [status.model_copy(deep=True) for status in self._statuses]

    # 느린 클라이언트에는 오래된 알림을 버리고 가장 최신 상태만 남긴다.
    def _notify_subscribers_locked(self) -> None:
        snapshot = self._copy_statuses_locked()
        for subscriber in self._subscribers:
            try:
                subscriber.put_nowait(snapshot)
            except Full:
                try:
                    subscriber.get_nowait()
                except Empty:
                    pass
                subscriber.put_nowait(snapshot)

    # 배치에 있는 모든 좌석을 빈자리 상태로 초기화한다.
    @staticmethod
    def _empty_statuses(layout: Layout) -> list[SeatStatus]:
        return [
            SeatStatus(seat_id=seat.seat_id, status="empty")
            for seat in layout.seats
        ]
