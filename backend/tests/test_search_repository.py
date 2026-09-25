"""Immutable search snapshots through the repository seam."""

import hashlib
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from vacation_window_planner.models import AnonymousSession, Base
from vacation_window_planner.repositories.searches import (
    RecommendationSnapshotInput,
    SearchSnapshotPersistenceError,
    SearchSnapshotRepository,
)

SESSION_ID = UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as database_session:
        now = datetime(2026, 9, 25, 12, tzinfo=UTC)
        database_session.add(
            AnonymousSession(
                id=SESSION_ID,
                token_hash=hashlib.sha256(b"token").hexdigest(),
                created_at=now,
                expires_at=now + timedelta(days=30),
                balance_days=8,
                allowed_negative_days=0,
                country_code="IL",
                weekend_days=[4, 5],
            )
        )
        database_session.commit()
        yield database_session
    engine.dispose()


def recommendation(rank: int, start: str) -> RecommendationSnapshotInput:
    return RecommendationSnapshotInput(
        rank=rank,
        result={"start_date": start, "score": 90 - rank},
        warnings=("length_relaxed",) if rank == 2 else (),
    )


def test_completed_search_round_trips_exact_ordered_snapshot(session: Session) -> None:
    repository = SearchSnapshotRepository(session)
    structured_input = {
        "balance_days": 8,
        "months": [{"year": 2027, "month": 1}],
        "policy": {"engine_version": "phase0-v1", "generation_cap": 5000},
    }

    search_id = repository.save_completed(
        session_id=SESSION_ID,
        engine_version="phase0-v1",
        structured_input=structured_input,
        source_text="A week in January",
        recommendations=(recommendation(2, "2027-01-10"), recommendation(1, "2027-01-03")),
        created_at=datetime(2026, 9, 25, 12, tzinfo=UTC),
    )
    session.commit()

    restored = repository.get(search_id)
    assert restored is not None
    assert restored.structured_input == structured_input
    assert restored.source_text == "A week in January"
    assert restored.engine_version == "phase0-v1"
    assert [item.rank for item in restored.recommendations] == [1, 2]
    assert restored.recommendations[1].result == {
        "start_date": "2027-01-10",
        "score": 88,
    }
    assert restored.recommendations[1].warnings == ("length_relaxed",)


def test_snapshot_write_rolls_back_atomically_on_invalid_order(session: Session) -> None:
    repository = SearchSnapshotRepository(session)

    with pytest.raises(SearchSnapshotPersistenceError):
        repository.save_completed(
            session_id=SESSION_ID,
            engine_version="phase0-v1",
            structured_input={"balance_days": 8},
            source_text=None,
            recommendations=(recommendation(1, "2027-01-03"), recommendation(1, "2027-01-10")),
            created_at=datetime(2026, 9, 25, 12, tzinfo=UTC),
        )

    assert repository.list_for_session(SESSION_ID) == ()
