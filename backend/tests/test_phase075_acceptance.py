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
from vacation_window_planner.repositories.searches import SearchSnapshotRepository


def test_personal_search_actions_and_saved_recheck_share_recorded_accounting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
    now = datetime(2026, 9, 26, 12, tzinfo=UTC)
    monkeypatch.setattr(main, "utc_now", lambda: now)
    monkeypatch.setattr(main, "calendar_provider", FakeCalendarProvider({"IL": frozenset()}))
    app = create_app(
        database_probe=lambda: True,
        clock=lambda: now,
        session_creator=main.create_session,
        session_lookup=main.find_session,
        recommendation_service=main.recommend,
        comparison_service=main.compare,
    )
    context = {
        "balance_days": 8,
        "allowed_negative_days": 0,
        "country_code": "IL",
        "weekend_days": [4, 5],
        "time_zone": "Asia/Jerusalem",
        "personal_calendar": {
            "schema_version": 1,
            "minimum_notice_days": 0,
            "unavailable_ranges": [],
            "date_overrides": [
                {"start_date": "2027-01-07", "end_date": "2027-01-07", "kind": "personal_day_off"},
                {"start_date": "2027-01-08", "end_date": "2027-01-08", "kind": "extra_working_day"},
            ],
        },
    }
    with TestClient(app) as client:
        owner = client.post("/sessions", json=context).json()
        headers = {"Authorization": f"Bearer {owner['token']}"}
        response = client.post(
            "/recommendations",
            headers=headers,
            json={
                "months": [{"year": 2027, "month": 1}],
                "preferred_length_days": 5,
                "include_opportunities": True,
                "include_action_details": True,
            },
        )
        assert response.status_code == 200
        search = response.json()
        for recommendation in search["recommendations"]:
            assert recommendation["assessment"]["window"] == recommendation["window"]
            assert [
                item["window"] for item in recommendation["alternative_assessments"]
            ] == recommendation["alternative_windows"]
        baseline = client.post(
            "/comparisons",
            headers=headers,
            json={"start_date": "2027-01-07", "end_date": "2027-01-09"},
        ).json()["baseline"]
        assert baseline["window"]["vacation_days_used"] == 1
        assert baseline["assessment"]["charged_dates"] == ["2027-01-08"]
        assert baseline["assessment"]["day_details"][0]["kind"] == "personal_day_off"
        assert baseline["assessment"]["day_details"][1]["kind"] == "extra_working_day"
        assert search["opportunities"]["status"] == "complete"
        with main.sessions() as session:
            stored = SearchSnapshotRepository(session).get(UUID(search["search_id"]))
            assert stored is not None
            assert stored.recommendations[0].result == search["recommendations"][0]
        fresh = client.post(
            "/sessions", json={**search["calculation_context"]["planning"], "balance_days": 0}
        ).json()
        recheck = client.post(
            "/comparisons",
            headers={"Authorization": f"Bearer {fresh['token']}"},
            json={"start_date": "2027-01-07", "end_date": "2027-01-09"},
        )
        assert recheck.status_code == 200
        assert recheck.json()["baseline"]["assessment"]["eligibility_reasons"] == [
            {"code": "over_budget", "required_days": 1, "permitted_days": 0}
        ]
        assert recheck.json()["calculation_context"]["planning"]["time_zone"] == "Asia/Jerusalem"
    main.engine.dispose()
