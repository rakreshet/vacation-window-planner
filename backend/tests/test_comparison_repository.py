import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config

from vacation_window_planner.comparison_workflow import ComparisonRequest, ComparisonWorkflow
from vacation_window_planner.database import make_engine, make_session_factory
from vacation_window_planner.domain.calendar import FakeCalendarProvider
from vacation_window_planner.domain.comparison import ComparisonInput, ComparisonPolicy
from vacation_window_planner.domain.contracts import UserVacationContext
from vacation_window_planner.repositories.comparisons import ComparisonSnapshotRepository
from vacation_window_planner.repositories.sessions import AnonymousSessionRepository


def test_comparison_round_trips_reproducible_snapshot_only_for_owner() -> None:
    url = os.environ.get("TEST_DATABASE_URL")
    if url is None:
        pytest.skip("Requires disposable PostgreSQL")
    parsed = urlparse(url)
    assert parsed.hostname == "test-db" and parsed.path == "/vacation_test"
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    engine = make_engine(url)
    sessions = make_session_factory(engine)
    now = datetime(2026, 9, 26, 12, tzinfo=UTC)
    with sessions() as session:
        owner = AnonymousSessionRepository(session).create(
            balance_days=8,
            allowed_negative_days=0,
            country_code="IL",
            weekend_days=frozenset({4, 5}),
            now=now,
            expires_at=now + timedelta(days=30),
        )
        context = UserVacationContext(
            session_id=owner.id, balance_days=8, country_code="IL", weekend_days=frozenset({4, 5})
        )
        dates = ComparisonInput(start_date="2027-01-03", end_date="2027-01-07")
        store = ComparisonSnapshotRepository(session)
        result = ComparisonWorkflow(
            calendar_provider=FakeCalendarProvider(),
            policy=ComparisonPolicy(_env_file=None),
            clock=lambda: now,
            source_search_owned=lambda search, user: False,
            snapshot_writer=store,
        ).compare(ComparisonRequest(context=context, dates=dates))
        session.commit()
        restored = store.get_for_session(result.comparison_id, owner.id)
        assert restored is not None
        assert restored.result == result.model_dump(mode="json")
        assert restored.structured_input["dates"] == dates.model_dump(mode="json")
        assert restored.structured_input["calendar"]["weekend_days"] == [4, 5]
        assert restored.structured_input["local_today"] == "2026-09-26"
        assert store.get_for_session(result.comparison_id, UUID(int=999)) is None
    engine.dispose()
