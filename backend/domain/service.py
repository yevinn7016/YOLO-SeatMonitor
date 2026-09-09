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


OCCUPIED_CONFIRMATION_SECONDS = 2
EMPTY_CONFIRMATION_SECONDS = 3


class SeatService:
    """API와 카메라 worker가 함께 사용하는 현재 ROI와 좌석 상태."""

    # 저장된 좌석 배치와 운영 설정을 불러와 초기 상태를 만든다.
    def __init__(self) -> None:
        self._layout = load_layout()
        self._statuses: list[SeatStatus] = self._empty_statuses(self._layout)
        self._settings = load_settings()
        self._person_detected_since: dict[str, float] = {}
        self._empty_detected_since: dict[str, float] = {}
        self._away_started_at: dict[str, float] = {}
        self._away_started_wall_at: dict[str, datetime] = {}
        self._subscribers: set[Queue[list[SeatStatus]]] = set() #큐 하나가 구독자 한명
        self._lock = Lock()

    # 현재 좌석 배치의 복사본을 반환한다.
    def get_layout(self) -> Layout:
        with self._lock:
            return self._layout.model_copy(deep=True) #원본 객체 변경 방지를 위해 copy, 내부 객체 원본 전달 방지를 위해 deep=true

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
            self._empty_detected_since = {}
            self._away_started_at = {}
            self._away_started_wall_at = {}
            self._notify_subscribers_locked()
            return self._layout.model_copy(deep=True)

    # 현재 좌석 상태 목록의 복사본을 반환한다.
    def get_statuses(self) -> list[SeatStatus]:
        with self._lock:
            return self._copy_statuses_locked()

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
            previous_by_id = {}
            for previous_status in self._statuses:
                previous_by_id[previous_status.seat_id] = previous_status

            # 같은 분석 회차의 모든 좌석에 동일한 시각을 적용한다.
            now = time.monotonic()
            wall_now = datetime.now(UTC)
            next_statuses = []
            status_changed = False

            for instant_status in statuses:
                previous_status = previous_by_id.get(instant_status.seat_id)
                next_status = self._transition_status(
                    instant_status,
                    previous_status,
                    now,
                    wall_now,
                )
                next_statuses.append(next_status)

                if previous_status is None:
                    status_changed = True
                elif previous_status.status != next_status.status:
                    status_changed = True
            # 상태 문자열이 같아도 detections 같은 세부 정보는 바뀔 수 있어 항상 갱신한다.
            self._statuses = next_statuses
            if status_changed:
                self._notify_subscribers_locked()

    # 특정 좌석의 자리 비움/노쇼 판정 타이머를 초기화한다.
    def reset_seat_timer(self, seat_id: str) -> SeatStatus:
        with self._lock:
            index = None
            for current_index, seat_status in enumerate(self._statuses):
                if seat_status.seat_id == seat_id:
                    index = current_index
                    break
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
            should_notify = False
            reset_statuses = []
            for current_status in self._statuses:
                if current_status.status in {"away", "noshow"}:
                    should_notify = True

                reset_status = self._reset_timer_locked(current_status, now, wall_now)
                reset_statuses.append(reset_status)

            self._statuses = reset_statuses
            if should_notify:
                self._notify_subscribers_locked()
            return self._copy_statuses_locked()

    # SSE 연결 하나가 사용할 변경 알림 큐를 등록한다.
    def subscribe(self) -> Queue[list[SeatStatus]]: # 큐에는 전체 좌석 목록 한 뭉탱이가 들어감
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
    # TODO: timeout 뒤에 종료 여부를 확인하지 않고 재대기한다.
    # 추후 비동기 SSE로 개선하여 연결 종료와 구독 해제를 연동한다.
    def status_events(self) -> Iterator[list[SeatStatus]]:
        subscriber = self.subscribe()
        try: # sse 연결 중 실행
            while True:
                try:
                    statuses = subscriber.get(timeout=1)
                    yield statuses
                except Empty:
                    continue
        finally: # 제너레이터가 종료될 때 구독 큐를 정리한다.
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
        if previous_status is None:
            previous_value = "empty"
        else:
            previous_value = previous_status.status

        # now는 경과시간 계산용, wall_now는 응답에 기록할 실제 UTC 시각이다.

        if instant_status.status == "occupied":
            self._empty_detected_since.pop(seat_id, None)

            # 이미 점유 중인 좌석은 사람 감지가 이어지는 동안 점유 상태를 유지한다.
            if previous_value == "occupied":
                self._person_detected_since.pop(seat_id, None)
                self._away_started_at.pop(seat_id, None)
                self._away_started_wall_at.pop(seat_id, None)
                status = "occupied"
            else:
                # 처음 감지된 사람은 2초 동안 계속 보여야 점유로 확정한다.
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
                self._empty_detected_since.pop(seat_id, None)
                # 소지품만 있으면 처음 자리 비움 시각부터 경과 시간을 잰다.
                away_since = self._away_started_at.setdefault(seat_id, now)
                self._away_started_wall_at.setdefault(seat_id, wall_now)
                if now - away_since >= self._settings.noshow_threshold_seconds:
                    # 설정한 기준 시간을 넘기면 노쇼 상태로 바꾼다.
                    status = "noshow"
                else:
                    status = "away"
            else:
                # 한 번의 미탐으로 상태가 흔들리지 않도록 3초간 이전 상태를 유지한다.
                if previous_value != "empty":
                    empty_since = self._empty_detected_since.setdefault(seat_id, now)
                    if now - empty_since < EMPTY_CONFIRMATION_SECONDS:
                        status = previous_value
                    else:
                        self._empty_detected_since.pop(seat_id, None)
                        self._away_started_at.pop(seat_id, None)
                        self._away_started_wall_at.pop(seat_id, None)
                        status = "empty"
                else:
                    self._empty_detected_since.pop(seat_id, None)
                    self._away_started_at.pop(seat_id, None)
                    self._away_started_wall_at.pop(seat_id, None)
                    status = "empty"

        status_changed = previous_status is None or previous_value != status
        if status_changed:
            updated_at = wall_now
        else:
            updated_at = previous_status.updated_at

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
        self._empty_detected_since.pop(seat_id, None)

        if current.status in {"away", "noshow"}:
            self._away_started_at[seat_id] = now
            self._away_started_wall_at[seat_id] = wall_now
            next_status = "away"
            if current.status == "noshow":
                updated_at = wall_now  # noshow에서 away로 실제 상태가 바뀐다.
            else:
                updated_at = current.updated_at  # away일 경우 상태값은 그대로이다.
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
    def _notify_subscribers_locked(self) -> None: # Queue는 생산자와 소비자가 서로 다른 속도로 동작할 수 있게 분리한다.
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
                #Full 상태에서 get_nowait 실행 후 Empty에러가 날 수 있는 이유
                #1. 최신 상태를 넣으려고 함
                #2. Queue가 가득 차서 Full 발생
                #3. 그 순간 프론트 전송 작업이 기존 상태를 꺼냄
                #4. get_nowait()을 실행했더니 이미 Queue가 비어 있음
                #5. Empty 발생

    # 배치에 있는 모든 좌석을 빈자리 상태로 초기화한다.
    @staticmethod
    def _empty_statuses(layout: Layout) -> list[SeatStatus]:
        return [
            SeatStatus(seat_id=seat.seat_id, status="empty")
            for seat in layout.seats
        ]
