"""Anonymous session creation HTTP boundary."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi.testclient import TestClient

from vacation_window_planner.api import create_app
from vacation_window_planner.repositories.sessions import CreatedAnonymousSession

NOW = datetime(2026, 9, 25, 12, tzinfo=UTC)
SESSION_ID = UUID("00000000-0000-0000-0000-000000000001")


def test_anonymous_session_creation_returns_opaque_token() -> None:
    captured: list[object] = []

    def create_session(request: object, now: datetime) -> CreatedAnonymousSession:
        captured.extend((request, now))
        return CreatedAnonymousSession(id=SESSION_ID, token="opaque-token")

    client = TestClient(
        create_app(
            database_probe=lambda: True,
            session_creator=create_session,
            clock=lambda: NOW,
        )
    )

    response = client.post(
        "/sessions",
        json={
            "balance_days": 8,
            "allowed_negative_days": 1,
            "country_code": "IL",
            "weekend_days": [4, 5],
        },
    )

    assert response.status_code == 201
    assert response.json() == {"session_id": str(SESSION_ID), "token": "opaque-token"}
    assert captured[1] == NOW


def test_invalid_time_zone_is_rejected_before_session_creation() -> None:
    client = TestClient(create_app(database_probe=lambda: True))
    response = client.post(
        "/sessions",
        json={
            "balance_days": 8,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "time_zone": "Mars/Olympus",
        },
    )
    assert response.status_code == 422
    assert "body.time_zone" in response.json()["error"]["fields"]


def test_invalid_personal_calendar_has_a_specific_error() -> None:
    client = TestClient(create_app(database_probe=lambda: True))
    response = client.post(
        "/sessions",
        json={
            "balance_days": 8,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {"minimum_notice_days": True},
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_PERSONAL_CALENDAR"
    assert "body.personal_calendar.minimum_notice_days" in response.json()["error"]["fields"]
