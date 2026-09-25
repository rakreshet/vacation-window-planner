"""Anonymous-session persistence through the repository seam."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from vacation_window_planner.models import AnonymousSession, Base
from vacation_window_planner.repositories.sessions import (
    AnonymousSessionRepository,
    SessionTokenCollisionError,
)


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as database_session:
        yield database_session
    engine.dispose()


def test_token_creation_stores_only_hash_and_round_trips_context(session: Session) -> None:
    now = datetime(2026, 9, 25, 12, tzinfo=UTC)
    repository = AnonymousSessionRepository(session, token_factory=lambda: "opaque-token")

    created = repository.create(
        balance_days=8,
        allowed_negative_days=1,
        country_code="IL",
        weekend_days=frozenset({4, 5}),
        now=now,
        expires_at=now + timedelta(days=30),
    )
    session.commit()
    stored = session.scalars(select(AnonymousSession)).one()

    assert created.token == "opaque-token"
    assert stored.token_hash != created.token
    assert len(stored.token_hash) == 64
    resumed = repository.find_active(created.token, now=now + timedelta(days=1))
    assert resumed is not None
    assert resumed.balance_days == 8
    assert resumed.allowed_negative_days == 1
    assert resumed.country_code == "IL"
    assert resumed.weekend_days == frozenset({4, 5})


def test_expired_token_cannot_resume_session(session: Session) -> None:
    now = datetime(2026, 9, 25, 12, tzinfo=UTC)
    repository = AnonymousSessionRepository(session, token_factory=lambda: "expired-token")
    created = repository.create(
        balance_days=4,
        allowed_negative_days=0,
        country_code="IL",
        weekend_days=frozenset({4, 5}),
        now=now,
        expires_at=now + timedelta(hours=1),
    )
    session.commit()

    assert repository.find_active(created.token, now=now + timedelta(hours=1)) is None


def test_token_hash_is_unique_in_database(session: Session) -> None:
    now = datetime(2026, 9, 25, 12, tzinfo=UTC)
    repository = AnonymousSessionRepository(session, token_factory=lambda: "same-token")
    values = {
        "balance_days": 4,
        "allowed_negative_days": 0,
        "country_code": "IL",
        "weekend_days": frozenset({4, 5}),
        "now": now,
        "expires_at": now + timedelta(days=1),
    }
    repository.create(**values)
    session.commit()

    with pytest.raises(SessionTokenCollisionError):
        repository.create(**values)
