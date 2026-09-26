from dataclasses import replace
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


class MemorySnapshots:
    def save_completed(self, **values: object) -> None:
        self.last = values


def client(balance: int = 2, **policy_values: object) -> TestClient:
    workflow = ComparisonWorkflow(
        calendar_provider=FakeCalendarProvider(),
        policy=ComparisonPolicy(_env_file=None, **policy_values),
        clock=lambda: NOW,
        snapshot_writer=MemorySnapshots(),
        source_search_owned=lambda search, session: search == UUID(int=2),
    )
    return TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda token, now: (
                replace(SESSION, balance_days=balance) if token == "valid" else None
            ),
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


def test_nearby_groups_fulfil_their_literal_promises_and_preserve_baseline() -> None:
    data = (
        client(balance=8)
        .post(
            "/comparisons",
            headers={"Authorization": "Bearer valid"},
            json={
                "start_date": "2027-01-03",
                "end_date": "2027-01-07",
            },
        )
        .json()
    )
    assert data["baseline"]["window"]["start_date"] == "2027-01-03"
    saved = data["save_leave"][0]
    assert saved["evaluation"]["window"]["total_days"] == 5
    assert saved["delta"]["vacation_days_saved"] == 2
    assert saved["evaluation"]["window"]["start_date"] == "2027-01-01"
    extended = data["longer_break"][0]
    assert extended["evaluation"]["window"]["total_days"] == 9
    assert extended["delta"]["extra_days"] == 4
    assert extended["evaluation"]["window"]["vacation_days_used"] == 5
    assert len(data["save_leave"]) <= 3 and len(data["longer_break"]) <= 3


def test_zero_leave_and_no_improvement_are_valid_complete_responses() -> None:
    body = {"start_date": "2027-01-01", "end_date": "2027-01-02"}
    data = (
        client(balance=0)
        .post("/comparisons", headers={"Authorization": "Bearer valid"}, json=body)
        .json()
    )
    assert data["save_leave"] == [] and data["longer_break"] == []
    assert data["baseline"]["window"]["vacation_days_used"] == 0


def test_incomplete_discovery_never_returns_a_partial_shortlist() -> None:
    response = client(generation_cap=1).post(
        "/comparisons",
        headers={"Authorization": "Bearer valid"},
        json={
            "start_date": "2027-01-03",
            "end_date": "2027-01-07",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "COMPARISON_TOO_BROAD"
    assert "save_leave" not in response.json()


def test_all_alternatives_are_feasible_and_deterministic_across_month_boundary() -> None:
    body = {"start_date": "2027-01-03", "end_date": "2027-01-07"}
    app = client(balance=2)
    first = app.post("/comparisons", headers={"Authorization": "Bearer valid"}, json=body).json()
    second = app.post("/comparisons", headers={"Authorization": "Bearer valid"}, json=body).json()
    assert first["save_leave"] == second["save_leave"]
    assert first["longer_break"] == second["longer_break"]
    for group in ("save_leave", "longer_break"):
        for option in first[group]:
            assert option["evaluation"]["feasible"] is True
            assert option["evaluation"]["remaining_balance"] >= -1
            assert option["delta"]["vacation_days_saved"] >= 0
