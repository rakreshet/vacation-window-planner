"""HTTP journeys through production services and disposable PostgreSQL."""

import os
from datetime import UTC, date, datetime
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from vacation_window_planner.api import create_app
from vacation_window_planner.domain.calendar import FakeCalendarProvider
from vacation_window_planner.domain.contracts import FeedbackValue
from vacation_window_planner.repositories.comparisons import ComparisonSnapshotRepository
from vacation_window_planner.repositories.feedback import FeedbackRepository
from vacation_window_planner.repositories.searches import SearchSnapshotRepository


def test_both_http_journeys_share_accounting_and_preserve_search_and_feedback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url = os.environ.get("TEST_DATABASE_URL")
    if url is None:
        pytest.skip("Requires disposable PostgreSQL")
    parsed = urlparse(url)
    assert parsed.hostname == "test-db" and parsed.path == "/vacation_test"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    from vacation_window_planner import main

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    now = datetime(2026, 9, 26, 12, tzinfo=UTC)
    monkeypatch.setattr(main, "utc_now", lambda: now)
    # Holiday lies outside the manually entered baseline; discovery must include it.
    monkeypatch.setattr(
        main, "calendar_provider", FakeCalendarProvider({"IL": frozenset({date(2027, 1, 10)})})
    )
    app = create_app(
        database_probe=lambda: True,
        clock=lambda: now,
        session_creator=main.create_session,
        session_lookup=main.find_session,
        recommendation_service=main.recommend,
        comparison_service=main.compare,
        feedback_service=main.save_feedback,
    )
    with TestClient(app) as client:
        context = {
            "balance_days": 8,
            "allowed_negative_days": 0,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "time_zone": "Asia/Jerusalem",
        }
        owner = client.post("/sessions", json=context).json()
        headers = {"Authorization": f"Bearer {owner['token']}"}
        search_response = client.post(
            "/recommendations",
            headers=headers,
            json={"months": [{"year": 2027, "month": 1}], "preferred_length_days": 5},
        )
        assert search_response.status_code == 200
        search = search_response.json()
        first = search["recommendations"][0]
        search_id = UUID(search["search_id"])
        assert (
            client.post(
                f"/recommendations/{search_id}/1/feedback",
                headers=headers,
                json={"value": "thumbs_up"},
            ).status_code
            == 200
        )
        with main.sessions() as session:
            before = SearchSnapshotRepository(session).get(search_id)

        window = first["window"]
        dates = {"start_date": window["start_date"], "end_date": window["end_date"]}
        manual = client.post("/comparisons", headers=headers, json=dates)
        from_search = client.post(
            "/comparisons", headers=headers, json={**dates, "source_search_id": str(search_id)}
        )
        assert manual.status_code == from_search.status_code == 200
        assert manual.json()["baseline"] == from_search.json()["baseline"]
        assert manual.json()["baseline"]["window"] == window
        assert manual.json()["save_leave"] == from_search.json()["save_leave"]
        assert manual.json()["longer_break"] == from_search.json()["longer_break"]

        nearby = client.post(
            "/comparisons",
            headers=headers,
            json={"start_date": "2027-01-03", "end_date": "2027-01-07"},
        ).json()
        assert nearby["baseline"]["window"]["vacation_days_used"] == 5
        assert nearby["baseline"]["window"]["holiday_dates"] == []
        assert nearby["save_leave"][0]["evaluation"]["window"]["vacation_days_used"] == 2
        assert nearby["save_leave"][0]["evaluation"]["window"]["holiday_dates"] == ["2027-01-10"]
        stranger = client.post("/sessions", json=context).json()
        assert (
            client.post(
                "/comparisons",
                headers={"Authorization": f"Bearer {stranger['token']}"},
                json={**dates, "source_search_id": str(search_id)},
            ).status_code
            == 404
        )
        with main.sessions() as session:
            restored = ComparisonSnapshotRepository(session).get_for_session(
                UUID(from_search.json()["comparison_id"]), UUID(owner["session_id"])
            )
            assert restored is not None
            assert restored.result == from_search.json()
            assert restored.structured_input["dates"]["source_search_id"] == str(search_id)
            assert restored.structured_input["context"]["time_zone"] == "Asia/Jerusalem"
            assert SearchSnapshotRepository(session).get(search_id) == before
            assert before is not None
            feedback = FeedbackRepository(session).get(
                UUID(owner["session_id"]), before.recommendations[0].id
            )
            assert feedback is not None and feedback.value == FeedbackValue.THUMBS_UP
    main.engine.dispose()
