"""Typed recommendation HTTP boundary and stable error codes."""

from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient

from vacation_window_planner.api import create_app
from vacation_window_planner.domain.contracts import Recommendation, VacationWindow
from vacation_window_planner.domain.generator import SearchTooBroadError
from vacation_window_planner.repositories.searches import SearchSnapshotPersistenceError
from vacation_window_planner.repositories.sessions import AnonymousSessionState
from vacation_window_planner.workflow import RecommendationResult

SESSION_ID = UUID("00000000-0000-0000-0000-000000000001")
SEARCH_ID = UUID("00000000-0000-0000-0000-000000000002")
NOW = datetime(2026, 9, 25, 12, tzinfo=UTC)


def active_session() -> AnonymousSessionState:
    return AnonymousSessionState(
        id=SESSION_ID,
        balance_days=8,
        allowed_negative_days=0,
        country_code="IL",
        weekend_days=frozenset({4, 5}),
        created_at=NOW - timedelta(days=1),
        expires_at=NOW + timedelta(days=29),
    )


def body() -> dict[str, object]:
    return {
        "months": [{"year": 2026, "month": 10}],
        "preferred_length_days": 5,
        "result_limit": 5,
        "source_text": None,
    }


def test_recommendation_success_returns_typed_data_only() -> None:
    recommendation = Recommendation(
        window=VacationWindow(
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 5),
            total_days=5,
            vacation_days_used=2,
        ),
        rank=1,
        score=82,
        explanation="5 days off use 2 vacation days.",
        remaining_balance=6,
    )
    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda _token, _now: active_session(),
            recommendation_service=lambda _request: RecommendationResult(
                search_id=SEARCH_ID,
                recommendations=(recommendation,),
            ),
            clock=lambda: NOW,
        )
    )

    response = client.post(
        "/recommendations", json=body(), headers={"Authorization": "Bearer token"}
    )

    assert response.status_code == 200
    assert response.json()["search_id"] == str(SEARCH_ID)
    assert response.json()["recommendations"][0]["score"] == 82
    assert "color" not in response.text


def test_zero_results_is_a_successful_empty_collection() -> None:
    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda _token, _now: active_session(),
            recommendation_service=lambda _request: RecommendationResult(
                search_id=SEARCH_ID, recommendations=()
            ),
            clock=lambda: NOW,
        )
    )

    response = client.post(
        "/recommendations", json=body(), headers={"Authorization": "Bearer token"}
    )

    assert response.status_code == 200
    assert response.json()["recommendations"] == []


def test_validation_error_uses_stable_machine_code() -> None:
    client = TestClient(create_app(database_probe=lambda: True))

    response = client.post(
        "/recommendations",
        json={**body(), "preferred_length_days": 0},
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_expired_or_unknown_session_is_rejected() -> None:
    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda _token, _now: None,
            recommendation_service=lambda _request: RecommendationResult(
                search_id=SEARCH_ID, recommendations=()
            ),
            clock=lambda: NOW,
        )
    )

    response = client.post(
        "/recommendations", json=body(), headers={"Authorization": "Bearer expired"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SESSION_EXPIRED"


def test_search_too_broad_returns_narrow_search_error() -> None:
    def too_broad(_request: object) -> RecommendationResult:
        raise SearchTooBroadError

    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda _token, _now: active_session(),
            recommendation_service=too_broad,
            clock=lambda: NOW,
        )
    )

    response = client.post(
        "/recommendations", json=body(), headers={"Authorization": "Bearer token"}
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "SEARCH_TOO_BROAD",
            "message": "Search is too broad; narrow the selected months or length flexibility.",
            "fields": [],
        }
    }


def test_repository_failure_returns_stable_service_error() -> None:
    def unavailable(_request: object) -> RecommendationResult:
        raise SearchSnapshotPersistenceError("failed")

    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda _token, _now: active_session(),
            recommendation_service=unavailable,
            clock=lambda: NOW,
        )
    )

    response = client.post(
        "/recommendations", json=body(), headers={"Authorization": "Bearer token"}
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PERSISTENCE_ERROR"
