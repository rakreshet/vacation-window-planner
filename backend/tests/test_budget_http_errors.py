from datetime import date

from fastapi.testclient import TestClient
from test_annual_http_errors import NOW, REQUEST, SESSION

from vacation_window_planner.api import create_app
from vacation_window_planner.budget_comparison_workflow import BudgetComparisonWorkflow
from vacation_window_planner.domain.annual_budget import AnnualPolicy
from vacation_window_planner.domain.calendar import (
    CalendarResolutionUnavailable,
    FakeCalendarProvider,
)
from vacation_window_planner.domain.contracts import HolidayCalendar


def test_provider_failure_does_not_leak_details_and_allows_a_clean_comparison_retry() -> None:
    class RecoveringCalendar(FakeCalendarProvider):
        unavailable = True

        def resolve(
            self,
            country_code: str,
            start_date: date,
            end_date: date,
            weekend_override: frozenset[int] | None = None,
        ) -> HolidayCalendar:
            if self.unavailable:
                self.unavailable = False
                raise CalendarResolutionUnavailable("private provider detail")
            return super().resolve(country_code, start_date, end_date, weekend_override)

    workflow = BudgetComparisonWorkflow(
        calendar_provider=RecoveringCalendar(), policy=AnnualPolicy(), clock=lambda: NOW
    )
    client = TestClient(
        create_app(
            database_probe=lambda: True,
            clock=lambda: NOW,
            session_lookup=lambda token, now: SESSION if token == "valid" else None,
            budget_comparison_service=workflow.compare,
        )
    )
    response = client.post(
        "/annual-plans/budget-comparison", json=REQUEST, headers={"Authorization": "Bearer valid"}
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CALENDAR_UNAVAILABLE"
    assert "private" not in response.text
    assert (
        client.post(
            "/annual-plans/budget-comparison",
            json=REQUEST,
            headers={"Authorization": "Bearer valid"},
        ).status_code
        == 200
    )


def test_active_annual_requests_and_comparisons_share_the_same_two_permits() -> None:
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier, Event, Lock

    from test_annual_http_errors import MemorySnapshots

    from vacation_window_planner.annual_workflow import AnnualWorkflow

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

    provider = BlockingCalendar()
    annual = AnnualWorkflow(
        calendar_provider=provider,
        policy=AnnualPolicy(),
        clock=lambda: NOW,
        snapshot_writer=MemorySnapshots(),
    )
    comparison = BudgetComparisonWorkflow(
        calendar_provider=provider, policy=AnnualPolicy(), clock=lambda: NOW
    )
    client = TestClient(
        create_app(
            database_probe=lambda: True,
            clock=lambda: NOW,
            session_lookup=lambda *_: SESSION,
            annual_service=annual.plan,
            budget_comparison_service=comparison.compare,
        )
    )
    body = {
        "year": 2027,
        "slots": [
            {
                "slot_id": "arranged",
                "min_days": 3,
                "max_days": 3,
                "locked_dates": {"start_date": "2027-01-01", "end_date": "2027-01-03"},
            }
        ],
    }
    headers = {"Authorization": "Bearer valid"}
    with ThreadPoolExecutor(max_workers=2) as executor:
        pending = [
            executor.submit(client.post, "/annual-plans", json=body, headers=headers)
            for _ in range(2)
        ]
        try:
            entered.wait(timeout=5)
            excess = client.post("/annual-plans/budget-comparison", json=body, headers=headers)
            assert excess.status_code == 503
            assert excess.json()["error"]["code"] == "ANNUAL_PLANNER_BUSY"
        finally:
            release.set()
        assert [future.result().status_code for future in pending] == [200, 200]
    assert (
        client.post("/annual-plans/budget-comparison", json=body, headers=headers).status_code
        == 200
    )
