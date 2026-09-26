from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient

from vacation_window_planner.api import create_app
from vacation_window_planner.comparison_workflow import ComparisonWorkflow
from vacation_window_planner.domain.calendar import FakeCalendarProvider
from vacation_window_planner.domain.comparison import ComparisonPolicy
from vacation_window_planner.repositories.sessions import AnonymousSessionState

NOW = datetime(2026, 9, 26, 12, tzinfo=UTC)
SESSION = AnonymousSessionState(
    id=UUID(int=1),
    balance_days=2,
    allowed_negative_days=1,
    country_code="IL",
    weekend_days=frozenset({4, 5}),
    created_at=NOW,
    expires_at=NOW + timedelta(days=30),
)


def client() -> TestClient:
    workflow = ComparisonWorkflow(
        calendar_provider=FakeCalendarProvider(),
        policy=ComparisonPolicy(_env_file=None),
        clock=lambda: NOW,
        source_search_owned=lambda search, session: search == UUID(int=2),
    )
    return TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda token, now: SESSION if token == "valid" else None,
            comparison_service=workflow.compare,
        )
    )


def test_exact_dates_explain_over_budget_baseline_without_search_fields() -> None:
    response = client().post(
        "/comparisons",
        headers={"Authorization": "Bearer valid"},
        json={
            "start_date": "2027-01-03",
            "end_date": "2027-01-07",
        },
    )
    assert response.status_code == 200
    baseline = response.json()["baseline"]
    assert baseline["window"]["vacation_days_used"] == 5
    assert baseline["charged_dates"] == [
        "2027-01-03",
        "2027-01-04",
        "2027-01-05",
        "2027-01-06",
        "2027-01-07",
    ]
    assert baseline["remaining_balance"] == -3
    assert baseline["feasible"] is False
    assert baseline["warnings"] == ["over_budget"]


def test_origin_must_belong_to_authenticated_session() -> None:
    response = client().post(
        "/comparisons",
        headers={"Authorization": "Bearer valid"},
        json={
            "start_date": "2027-01-03",
            "end_date": "2027-01-07",
            "source_search_id": str(UUID(int=99)),
        },
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_invalid_dates_and_sessions_are_rejected_while_free_weekends_are_valid() -> None:
    for payload in [
        {"start_date": "2026-09-25", "end_date": "2026-09-27"},
        {"start_date": "2027-01-01", "end_date": "2027-02-01"},
        {"start_date": "2027-01-07", "end_date": "2027-01-03"},
        {"start_date": "9999-12-28", "end_date": "9999-12-30"},
    ]:
        assert (
            client()
            .post("/comparisons", headers={"Authorization": "Bearer valid"}, json=payload)
            .status_code
            == 422
        )
    payload = {"start_date": "2027-01-01", "end_date": "2027-01-02"}
    assert client().post("/comparisons", json=payload).status_code == 401
    assert (
        client()
        .post("/comparisons", headers={"Authorization": "Bearer expired"}, json=payload)
        .status_code
        == 401
    )
    response = client().post(
        "/comparisons", headers={"Authorization": "Bearer valid"}, json=payload
    )
    assert response.json()["baseline"]["window"]["vacation_days_used"] == 0
    assert response.json()["baseline"]["feasible"] is True
