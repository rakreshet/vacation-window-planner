"""Typed recommendation HTTP boundary and stable error codes."""

from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient

from vacation_window_planner.api import create_app
from vacation_window_planner.domain.contracts import (
    Recommendation,
    ScoreBreakdown,
    ScoreComponent,
    VacationWindow,
)
from vacation_window_planner.domain.generator import SearchTooBroadError
from vacation_window_planner.repositories.feedback import FeedbackAuthorizationError
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


def test_recommendation_response_exposes_grouped_dates_and_score_facts() -> None:
    recommendation = Recommendation(
        window=VacationWindow(
            start_date=date(2026, 10, 2),
            end_date=date(2026, 10, 10),
            total_days=9,
            vacation_days_used=5,
        ),
        rank=1,
        score=72,
        explanation="9 days off use 5 vacation days.",
        remaining_balance=1,
        matching_window_count=2,
        alternative_windows=(
            VacationWindow(
                start_date=date(2026, 10, 9),
                end_date=date(2026, 10, 17),
                total_days=9,
                vacation_days_used=5,
            ),
        ),
        score_breakdown=ScoreBreakdown(
            leave_efficiency=ScoreComponent(points=22.22, max_points=50),
            time_away=ScoreComponent(points=30, max_points=30),
            length_fit=ScoreComponent(points=20, max_points=20),
        ),
    )
    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda _token, _now: active_session(),
            recommendation_service=lambda _request: RecommendationResult(
                search_id=SEARCH_ID, recommendations=(recommendation,)
            ),
            clock=lambda: NOW,
        )
    )

    response = client.post(
        "/recommendations", json=body(), headers={"Authorization": "Bearer token"}
    )

    assert response.status_code == 200
    grouped = response.json()["recommendations"][0]
    assert grouped["matching_window_count"] == 2
    assert grouped["alternative_windows"][0]["start_date"] == "2026-10-09"
    assert grouped["score_breakdown"] == {
        "leave_efficiency": {"points": 22.22, "max_points": 50.0},
        "time_away": {"points": 30.0, "max_points": 30.0},
        "length_fit": {"points": 20.0, "max_points": 20.0},
    }


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


def test_feedback_endpoint_authorizes_session_and_accepts_only_thumbs() -> None:
    actions: list[tuple[UUID, int, UUID, str]] = []

    def save_feedback(search_id: UUID, rank: int, session_id: UUID, value: object) -> None:
        actions.append((search_id, rank, session_id, str(value)))

    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda _token, _now: active_session(),
            feedback_service=save_feedback,
            clock=lambda: NOW,
        )
    )

    response = client.post(
        f"/recommendations/{SEARCH_ID}/1/feedback",
        json={"value": "thumbs_up"},
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    assert response.json() == {"value": "thumbs_up"}
    assert actions[0][:3] == (SEARCH_ID, 1, SESSION_ID)


def test_feedback_for_another_sessions_recommendation_is_hidden() -> None:
    def reject_feedback(_search_id: UUID, _rank: int, _session_id: UUID, _value: object) -> None:
        raise FeedbackAuthorizationError("not owned")

    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda _token, _now: active_session(),
            feedback_service=reject_feedback,
            clock=lambda: NOW,
        )
    )

    response = client.post(
        f"/recommendations/{SEARCH_ID}/1/feedback",
        json={"value": "thumbs_down"},
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RECOMMENDATION_NOT_FOUND"


def test_opportunity_request_flag_is_explicit_and_unrequested_output_is_absent() -> None:
    from vacation_window_planner.workflow import RecommendationRequest

    requested: list[bool] = []

    def recommend(request: RecommendationRequest) -> RecommendationResult:
        requested.append(request.include_opportunities)
        return RecommendationResult(search_id=SEARCH_ID, recommendations=())

    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=lambda *_: active_session(),
            recommendation_service=recommend,
        )
    )
    for include in [False, True]:
        response = client.post(
            "/recommendations",
            headers={"Authorization": "Bearer token"},
            json={**body(), "include_opportunities": include},
        )
        assert response.status_code == 200
        assert "opportunities" not in response.json()
    assert requested == [False, True]
