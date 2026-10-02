from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient
from httpx2 import Response

from vacation_window_planner.annual_workflow import AnnualWorkflow
from vacation_window_planner.api import create_app
from vacation_window_planner.domain.annual import AnnualPolicy
from vacation_window_planner.domain.calendar import CalendarProvider, FakeCalendarProvider
from vacation_window_planner.domain.contracts import HolidayCalendar
from vacation_window_planner.repositories.sessions import AnonymousSessionState

NOW = datetime(2026, 9, 26, tzinfo=UTC)
SESSION = AnonymousSessionState(
    id=UUID(int=1),
    balance_days=18,
    allowed_negative_days=0,
    country_code="IL",
    weekend_days=frozenset({4, 5}),
    created_at=NOW,
    expires_at=NOW + timedelta(days=30),
)
REQUEST = {"year": 2027, "slots": [{"slot_id": "short", "min_days": 3, "max_days": 3}]}


class MemorySnapshots:
    def __init__(self) -> None:
        self.runs: list[dict[str, object]] = []

    def save_completed(self, **values: object) -> None:
        self.runs.append(values)


def api(
    session: AnonymousSessionState = SESSION,
    provider: CalendarProvider | None = None,
    policy: AnnualPolicy | None = None,
) -> tuple[TestClient, MemorySnapshots]:
    store = MemorySnapshots()
    workflow = AnnualWorkflow(
        calendar_provider=provider or FakeCalendarProvider(),
        policy=policy or AnnualPolicy(),
        clock=lambda: NOW,
        snapshot_writer=store,
    )
    app = create_app(
        database_probe=lambda: True,
        clock=lambda: NOW,
        session_lookup=lambda token, now: session if token == "valid" else None,
        annual_service=workflow.plan,
    )
    return TestClient(app), store


def test_invalid_annual_requests_have_field_errors_and_cannot_create_snapshots() -> None:
    client, store = api()
    for body in [
        {**REQUEST, "year": True},
        {**REQUEST, "balance_days": 99},
        {**REQUEST, "year": 2025},
    ]:
        response = client.post(
            "/annual-plans", json=body, headers={"Authorization": "Bearer valid"}
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "INVALID_ANNUAL_PLAN"
        assert response.json()["error"]["fields"]
    assert store.runs == []


def test_provider_failure_is_retryable_and_does_not_fabricate_a_run() -> None:
    from vacation_window_planner.domain.calendar import CalendarResolutionUnavailable

    class UnavailableCalendar:
        def resolve(
            self,
            country_code: str,
            start_date: date,
            end_date: date,
            weekend_override: frozenset[int] | None = None,
        ) -> HolidayCalendar:
            raise CalendarResolutionUnavailable("private provider detail")

    client, store = api(provider=UnavailableCalendar())
    response = client.post("/annual-plans", json=REQUEST, headers={"Authorization": "Bearer valid"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CALENDAR_UNAVAILABLE"
    assert "private" not in response.text
    assert store.runs == []


def test_failed_persistence_cannot_return_a_successful_plan() -> None:
    from vacation_window_planner.repositories.annual_plans import AnnualPersistenceError

    class FailedSnapshots:
        def save_completed(self, **values: object) -> None:
            raise AnnualPersistenceError("private database detail")

    workflow = AnnualWorkflow(
        calendar_provider=FakeCalendarProvider(),
        policy=AnnualPolicy(),
        clock=lambda: NOW,
        snapshot_writer=FailedSnapshots(),
    )
    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda *_: SESSION,
            annual_service=workflow.plan,
        )
    )
    response = client.post("/annual-plans", json=REQUEST, headers={"Authorization": "Bearer valid"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PERSISTENCE_ERROR"
    assert "private" not in response.text


def test_third_active_calculation_is_busy_and_permits_are_released() -> None:
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier, Event, Lock

    entered = Barrier(3)
    release = Event()
    guard = Lock()

    class BlockingCalendar(FakeCalendarProvider):
        calls = 0

        def resolve(
            self,
            country_code: str,
            start_date: date,
            end_date: date,
            weekend_override: frozenset[int] | None = None,
        ) -> HolidayCalendar:
            with guard:
                self.calls += 1
                call = self.calls
            if call <= 2:
                entered.wait(timeout=5)
                assert release.wait(timeout=5)
            return super().resolve(country_code, start_date, end_date, weekend_override)

    client, store = api(provider=BlockingCalendar())

    def submit() -> Response:
        return client.post("/annual-plans", json=REQUEST, headers={"Authorization": "Bearer valid"})

    with ThreadPoolExecutor(max_workers=2) as executor:
        pending = [executor.submit(submit) for _ in range(2)]
        try:
            entered.wait(timeout=5)
            excess = submit()
            assert excess.status_code == 503
            assert excess.json()["error"]["code"] == "ANNUAL_PLANNER_BUSY"
        finally:
            release.set()
        assert [future.result().status_code for future in pending] == [200, 200]
    assert submit().status_code == 200
    assert len(store.runs) == 3


def test_session_and_allowance_rules_preserve_the_structured_input() -> None:
    for headers in [{}, {"Authorization": "Bearer expired"}]:
        client, store = api()
        assert client.post("/annual-plans", json=REQUEST, headers=headers).status_code == 401
        assert store.runs == []
    for changes, field in [
        ({"allowed_negative_days": 1}, "context.allowed_negative_days"),
        ({"balance_days": 367}, "context.balance_days"),
        ({"country_code": "ZZ"}, "context.country_code"),
    ]:
        client, store = api(session=replace(SESSION, **changes))
        response = client.post(
            "/annual-plans", json=REQUEST, headers={"Authorization": "Bearer valid"}
        )
        assert response.status_code == 422
        assert response.json()["error"]["fields"] == [field]
        assert store.runs == []


def test_policy_settings_validate_work_limits_at_startup() -> None:
    import pytest
    from pydantic import ValidationError

    from vacation_window_planner.settings import Settings

    with pytest.raises(ValidationError):
        Settings(database_url="postgresql+psycopg://host/db", annual_policy={"state_limit": 0})
