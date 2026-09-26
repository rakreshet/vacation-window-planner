import os
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from vacation_window_planner.api import create_app
from vacation_window_planner.domain.calendar import FakeCalendarProvider
from vacation_window_planner.repositories.searches import SearchSnapshotRepository


@pytest.mark.parametrize("failure_event", ["before_flush", "before_commit"])
def test_failed_search_transaction_returns_recoverable_error_without_partial_snapshots(
    monkeypatch: pytest.MonkeyPatch,
    failure_event: str,
) -> None:
    database_url = os.environ.get("TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("Requires disposable PostgreSQL")
    assert (
        urlparse(database_url).hostname == "test-db"
        and urlparse(database_url).path == "/vacation_test"
    )
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    from vacation_window_planner import main

    migration_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    migration_config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(migration_config, "head")
    now = datetime(2026, 9, 26, 12, tzinfo=UTC)
    monkeypatch.setattr(main, "utc_now", lambda: now)
    monkeypatch.setattr(main, "calendar_provider", FakeCalendarProvider())
    app = create_app(
        database_probe=lambda: True,
        clock=lambda: now,
        session_creator=main.create_session,
        session_lookup=main.find_session,
        recommendation_service=main.recommend,
    )
    client = TestClient(app, raise_server_exceptions=False)
    owner = client.post(
        "/sessions", json={"balance_days": 8, "country_code": "IL", "weekend_days": [4, 5]}
    ).json()

    def fail_transaction(*args: object) -> None:
        raise SQLAlchemyError("simulated database failure")

    event.listen(Session, failure_event, fail_transaction)
    try:
        response = client.post(
            "/recommendations",
            headers={"Authorization": f"Bearer {owner['token']}"},
            json={
                "months": [{"year": 2027, "month": 1}],
                "preferred_length_days": 5,
                "include_opportunities": True,
            },
        )
    finally:
        event.remove(Session, failure_event, fail_transaction)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PERSISTENCE_ERROR"
    with main.sessions() as session:
        assert SearchSnapshotRepository(session).list_for_session(UUID(owner["session_id"])) == ()
