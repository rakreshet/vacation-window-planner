"""Representative Phase 0 journey against PostgreSQL with fake providers."""

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from vacation_window_planner.api import SessionHttpRequest, create_app
from vacation_window_planner.database import make_engine, make_session_factory
from vacation_window_planner.domain.calendar import FakeCalendarProvider
from vacation_window_planner.domain.contracts import FeedbackValue, YearMonth
from vacation_window_planner.domain.policy import RecommendationPolicy
from vacation_window_planner.interpreter import ConstraintProposal
from vacation_window_planner.repositories.feedback import FeedbackRepository
from vacation_window_planner.repositories.searches import SearchSnapshotRepository
from vacation_window_planner.repositories.sessions import (
    AnonymousSessionRepository,
    AnonymousSessionState,
    CreatedAnonymousSession,
)
from vacation_window_planner.workflow import (
    RecommendationRequest,
    RecommendationResult,
    RecommendationWorkflow,
)

NOW = datetime(2026, 9, 25, 12, tzinfo=UTC)


def test_representative_phase0_journey_and_cap_safety() -> None:
    database_url = os.environ.get("TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("TEST_DATABASE_URL is not set")
    parsed_url = urlparse(database_url)
    if parsed_url.hostname != "test-db" or parsed_url.path != "/vacation_test":
        pytest.fail("Acceptance tests may only target the disposable test-db container")

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")
    engine = make_engine(database_url)
    sessions = make_session_factory(engine)
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE feedback, recommendations, searches, anonymous_sessions"))

    def create_session(body: SessionHttpRequest, now: datetime) -> CreatedAnonymousSession:
        with sessions() as session:
            created = AnonymousSessionRepository(session).create(
                balance_days=body.balance_days,
                allowed_negative_days=body.allowed_negative_days,
                country_code=body.country_code,
                weekend_days=body.weekend_days,
                now=now,
                expires_at=now + timedelta(days=30),
            )
            session.commit()
            return created

    def find_session(token: str, now: datetime) -> AnonymousSessionState | None:
        with sessions() as session:
            return AnonymousSessionRepository(session).find_active(token, now=now)

    def recommendation_service(
        policy: RecommendationPolicy,
    ) -> object:
        def recommend(request: RecommendationRequest) -> RecommendationResult:
            with sessions() as session:
                result = RecommendationWorkflow(
                    calendar_provider=FakeCalendarProvider(),
                    snapshot_writer=SearchSnapshotRepository(session),
                    policy=policy,
                    clock=lambda: NOW,
                ).recommend(request)
                session.commit()
                return result

        return recommend

    def save_feedback(
        search_id: UUID,
        rank: int,
        session_id: UUID,
        value: FeedbackValue,
    ) -> None:
        with sessions() as session:
            FeedbackRepository(session).set_for_rank(
                session_id=session_id,
                search_id=search_id,
                rank=rank,
                value=value,
                now=NOW,
            )
            session.commit()

    def interpret(source_text: str) -> ConstraintProposal:
        return ConstraintProposal(
            source_text=source_text,
            balance_days=8,
            country_code="IL",
            months=(YearMonth(year=2026, month=10),),
            preferred_length_days=5,
            weekend_days=frozenset({4, 5}),
            missing_fields=(),
        )

    app = create_app(
        database_probe=lambda: True,
        session_creator=create_session,
        session_lookup=find_session,
        recommendation_service=recommendation_service(RecommendationPolicy(_env_file=None)),
        interpretation_service=interpret,
        feedback_service=save_feedback,
        clock=lambda: NOW,
    )
    client = TestClient(app)

    created = client.post(
        "/sessions",
        json={
            "balance_days": 8,
            "allowed_negative_days": 0,
            "country_code": "IL",
            "weekend_days": [4, 5],
        },
    )
    assert created.status_code == 201
    token = created.json()["token"]
    session_id = UUID(created.json()["session_id"])

    proposal = client.post("/interpret", json={"text": "Five days in October"})
    assert proposal.status_code == 200
    with sessions() as session:
        assert SearchSnapshotRepository(session).list_for_session(session_id) == ()

    search_body = {
        "months": proposal.json()["months"],
        "preferred_length_days": proposal.json()["preferred_length_days"],
        "result_limit": 5,
        "source_text": proposal.json()["source_text"],
    }
    first_search = client.post(
        "/recommendations",
        json=search_body,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first_search.status_code == 200, first_search.text
    assert 0 < len(first_search.json()["recommendations"]) <= 5
    first_search_id = UUID(first_search.json()["search_id"])
    with sessions() as session:
        snapshot = SearchSnapshotRepository(session).get(first_search_id)
        assert snapshot is not None
        assert snapshot.source_text == "Five days in October"
        assert len(snapshot.recommendations) == len(first_search.json()["recommendations"])

    rerun = client.post(
        "/recommendations",
        json={**search_body, "source_text": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rerun.status_code == 200

    feedback = client.post(
        f"/recommendations/{first_search_id}/1/feedback",
        json={"value": "thumbs_up"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert feedback.status_code == 200
    with sessions() as session:
        snapshot = SearchSnapshotRepository(session).get(first_search_id)
        assert snapshot is not None
        stored_feedback = FeedbackRepository(session).get(
            session_id, snapshot.recommendations[0].id
        )
        assert stored_feedback is not None
        assert stored_feedback.value == FeedbackValue.THUMBS_UP

    capped_client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_lookup=find_session,
            recommendation_service=recommendation_service(
                RecommendationPolicy(_env_file=None, generation_cap=1)
            ),
            clock=lambda: NOW,
        )
    )
    capped = capped_client.post(
        "/recommendations",
        json=search_body,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert capped.status_code == 422
    assert capped.json()["error"]["code"] == "SEARCH_TOO_BROAD"
    assert "recommendations" not in capped.json()
    with sessions() as session:
        assert len(SearchSnapshotRepository(session).list_for_session(session_id)) == 2

    engine.dispose()
