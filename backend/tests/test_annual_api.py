import os
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from vacation_window_planner.api import create_app
from vacation_window_planner.domain.calendar import FakeCalendarProvider

NOW = datetime(2026, 9, 26, 22, tzinfo=UTC)
LOCKED_REQUEST = {
    "year": 2027,
    "reserve_days": 3,
    "slots": [
        {
            "slot_id": "arranged",
            "min_days": 3,
            "max_days": 3,
            "locked_dates": {"start_date": "2027-01-01", "end_date": "2027-01-03"},
        }
    ],
}
CONTEXT = {
    "balance_days": 18,
    "country_code": "IL",
    "weekend_days": [4, 5],
    "time_zone": "Asia/Jerusalem",
}


@pytest.fixture
def annual_api(monkeypatch: pytest.MonkeyPatch):
    url = os.environ.get("TEST_DATABASE_URL")
    if url is None:
        pytest.skip("Requires disposable PostgreSQL")
    parsed = urlparse(url)
    assert parsed.hostname == "test-db" and parsed.path == "/vacation_test"
    monkeypatch.setenv("DATABASE_URL", url)
    from vacation_window_planner import main

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    monkeypatch.setattr(main, "utc_now", lambda: NOW)
    monkeypatch.setattr(main, "calendar_provider", FakeCalendarProvider())
    app = create_app(
        database_probe=lambda: True,
        clock=lambda: NOW,
        session_creator=main.create_session,
        session_lookup=main.find_session,
        annual_service=main.plan_annual,
    )
    with TestClient(app) as client:
        yield client, main


def test_authenticated_annual_result_is_saved_before_success(annual_api) -> None:
    from vacation_window_planner.repositories.annual_plans import AnnualRunRepository

    client, main = annual_api
    owner = client.post("/sessions", json=CONTEXT).json()
    response = client.post(
        "/annual-plans", json=LOCKED_REQUEST, headers={"Authorization": f"Bearer {owner['token']}"}
    )
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "complete"
    assert result["plans"][0]["accounting"]["total_leave_used"] == 1
    assert result["calculation_context"]["local_today"] == "2026-09-27"
    assert "session_id" not in result["calculation_context"]["planning"]
    with main.sessions() as session:
        store = AnnualRunRepository(session)
        saved = store.get_for_session(UUID(result["run_id"]), UUID(owner["session_id"]))
        assert saved is not None
        assert saved.result == result
        assert saved.structured_input["input"] == result["input"]
        assert saved.structured_input["calendar"]["observed_holidays"] == []
        assert saved.structured_input["coverage"] == {
            "start_date": "2027-01-01",
            "end_date": "2027-12-31",
        }
        assert store.get_for_session(UUID(result["run_id"]), UUID(int=0)) is None


@pytest.mark.parametrize("failure_event", ["before_flush", "before_commit"])
def test_failed_annual_transaction_rolls_back_and_allows_a_clean_retry(
    annual_api, failure_event
) -> None:
    from sqlalchemy import event
    from sqlalchemy.exc import SQLAlchemyError

    from vacation_window_planner.repositories.annual_plans import (
        AnnualPersistenceError,
        AnnualRunRepository,
    )

    client, main = annual_api
    owner = client.post("/sessions", json=CONTEXT).json()
    session_id = UUID(owner["session_id"])
    from uuid import uuid4

    run_id = uuid4()
    with main.sessions() as session:
        store = AnnualRunRepository(session)

        def fail_transaction(*args):
            raise SQLAlchemyError("controlled persistence failure")

        event.listen(session, failure_event, fail_transaction)
        with pytest.raises(AnnualPersistenceError):
            store.save_completed(
                run_id=run_id, session_id=session_id, structured_input={}, result={}, created_at=NOW
            )
        event.remove(session, failure_event, fail_transaction)
        assert store.get_for_session(run_id, session_id) is None
        store.save_completed(
            run_id=run_id,
            session_id=session_id,
            structured_input={"retry": True},
            result={},
            created_at=NOW,
        )
    with main.sessions() as session:
        restored = AnnualRunRepository(session).get_for_session(run_id, session_id)
        assert restored is not None
        assert restored.structured_input == {"retry": True}


@pytest.mark.parametrize("outcome", ["infeasible", "conflict", "too_broad"])
def test_every_evaluable_outcome_has_an_immutable_snapshot(
    annual_api, monkeypatch, outcome
) -> None:
    from vacation_window_planner.domain.annual import AnnualPolicy
    from vacation_window_planner.repositories.annual_plans import AnnualRunRepository

    client, main = annual_api
    owner = client.post("/sessions", json={**CONTEXT, "balance_days": 0}).json()
    body = {"year": 2027, "slots": [{"slot_id": "short", "min_days": 3, "max_days": 3}]}
    if outcome == "conflict":
        body = {**LOCKED_REQUEST, "reserve_days": 0}
    if outcome == "too_broad":
        monkeypatch.setattr(main.settings, "annual_policy", AnnualPolicy(candidate_limit=1))
    headers = {"Authorization": f"Bearer {owner['token']}"}
    response = client.post("/annual-plans", json=body, headers=headers)
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == outcome
    second = client.post("/annual-plans", json=body, headers=headers).json()
    assert result["run_id"] != second["run_id"]
    with main.sessions() as session:
        saved = AnnualRunRepository(session).get_for_session(
            UUID(result["run_id"]), UUID(owner["session_id"])
        )
        assert saved is not None and saved.result == result


def test_http_commit_failure_returns_retryable_error_then_clean_request_succeeds(
    annual_api,
) -> None:
    from sqlalchemy import event
    from sqlalchemy.exc import SQLAlchemyError

    client, main = annual_api
    owner = client.post("/sessions", json=CONTEXT).json()
    headers = {"Authorization": f"Bearer {owner['token']}"}

    def reject_commit(session):
        raise SQLAlchemyError("controlled commit failure")

    event.listen(main.sessions.class_, "before_commit", reject_commit)
    try:
        response = client.post("/annual-plans", json=LOCKED_REQUEST, headers=headers)
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "PERSISTENCE_ERROR"
    finally:
        event.remove(main.sessions.class_, "before_commit", reject_commit)
    assert client.post("/annual-plans", json=LOCKED_REQUEST, headers=headers).status_code == 200
