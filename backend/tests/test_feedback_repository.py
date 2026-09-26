"""Simple recommendation feedback through its repository seam."""

import hashlib
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from vacation_window_planner.domain.contracts import FeedbackValue
from vacation_window_planner.models import (
    AnonymousSession,
    Base,
    RecommendationRecord,
    SearchRecord,
)
from vacation_window_planner.repositories.feedback import (
    FeedbackAuthorizationError,
    FeedbackRepository,
)

SESSION_ID = UUID("00000000-0000-0000-0000-000000000001")
OTHER_SESSION_ID = UUID("00000000-0000-0000-0000-000000000002")
SEARCH_ID = UUID("00000000-0000-0000-0000-000000000003")
RECOMMENDATION_ID = UUID("00000000-0000-0000-0000-000000000004")
NOW = datetime(2026, 9, 25, 12, tzinfo=UTC)


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as database_session:
        for identifier in (SESSION_ID, OTHER_SESSION_ID):
            database_session.add(
                AnonymousSession(
                    id=identifier,
                    token_hash=hashlib.sha256(str(identifier).encode()).hexdigest(),
                    created_at=NOW,
                    expires_at=NOW + timedelta(days=30),
                    balance_days=8,
                    allowed_negative_days=0,
                    country_code="IL",
                    weekend_days=[4, 5],
                )
            )
        database_session.add(
            SearchRecord(
                id=SEARCH_ID,
                session_id=SESSION_ID,
                engine_version="phase0-v1",
                structured_input={},
                source_text=None,
                created_at=NOW,
            )
        )
        database_session.add(
            RecommendationRecord(
                id=RECOMMENDATION_ID,
                search_id=SEARCH_ID,
                rank=1,
                result={},
                warnings=[],
            )
        )
        database_session.commit()
        yield database_session
    engine.dispose()


def test_one_feedback_value_is_created_for_user_action(session: Session) -> None:
    repository = FeedbackRepository(session)

    feedback = repository.set_for_rank(
        session_id=SESSION_ID,
        search_id=SEARCH_ID,
        rank=1,
        value=FeedbackValue.THUMBS_UP,
        now=NOW,
    )
    session.commit()

    assert feedback.recommendation_id == RECOMMENDATION_ID
    restored = repository.get(SESSION_ID, RECOMMENDATION_ID)
    assert restored is not None
    assert restored.value == FeedbackValue.THUMBS_UP


def test_new_action_replaces_prior_feedback_value(session: Session) -> None:
    repository = FeedbackRepository(session)
    repository.set_for_rank(
        session_id=SESSION_ID,
        search_id=SEARCH_ID,
        rank=1,
        value=FeedbackValue.THUMBS_UP,
        now=NOW,
    )
    repository.set_for_rank(
        session_id=SESSION_ID,
        search_id=SEARCH_ID,
        rank=1,
        value=FeedbackValue.THUMBS_DOWN,
        now=NOW + timedelta(minutes=1),
    )
    session.commit()

    restored = repository.get(SESSION_ID, RECOMMENDATION_ID)
    assert restored is not None
    assert restored.value == FeedbackValue.THUMBS_DOWN
    assert repository.count_for_recommendation(RECOMMENDATION_ID) == 1


def test_other_session_cannot_submit_feedback(session: Session) -> None:
    with pytest.raises(FeedbackAuthorizationError):
        FeedbackRepository(session).set_for_rank(
            session_id=OTHER_SESSION_ID,
            search_id=SEARCH_ID,
            rank=1,
            value=FeedbackValue.THUMBS_UP,
            now=NOW,
        )
