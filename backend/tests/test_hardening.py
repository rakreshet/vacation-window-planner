"""Public POC request, logging, CORS, and secret-safety guardrails."""

import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from vacation_window_planner.api import create_app
from vacation_window_planner.settings import Settings


def test_request_body_limit_returns_stable_error() -> None:
    client = TestClient(create_app(database_probe=lambda: True, max_request_bytes=64))

    response = client.post("/interpret", json={"text": "x" * 100})

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"


def test_cors_allows_only_configured_browser_origin() -> None:
    client = TestClient(
        create_app(
            database_probe=lambda: True,
            cors_origins=("https://planner.example",),
        )
    )

    allowed = client.options(
        "/recommendations",
        headers={
            "Origin": "https://planner.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    rejected = client.options(
        "/recommendations",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert allowed.headers["access-control-allow-origin"] == "https://planner.example"
    assert "access-control-allow-origin" not in rejected.headers


def test_request_logs_never_include_body_or_authorization_secrets(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="vacation_window_planner.requests")
    client = TestClient(create_app(database_probe=lambda: True))

    client.post(
        "/interpret",
        json={"text": "sensitive-user-text"},
        headers={"Authorization": "Bearer secret-token"},
    )

    assert "request_complete" in caplog.text
    assert "sensitive-user-text" not in caplog.text
    assert "secret-token" not in caplog.text


def test_retention_and_request_settings_have_safe_bounded_defaults() -> None:
    settings = Settings(database_url="postgresql+psycopg://user:pass@db/app")

    assert settings.session_expiry_days == 30
    assert settings.source_text_retention_days == 30
    assert settings.max_request_bytes == 65_536
    assert settings.cors_origins == ("http://localhost:15173",)


@pytest.mark.parametrize(
    "override",
    [
        {"session_expiry_days": 0},
        {"source_text_retention_days": 366},
        {"max_request_bytes": 100},
    ],
)
def test_unsafe_hardening_settings_are_rejected(override: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        Settings(database_url="postgresql+psycopg://user:pass@db/app", **override)


@pytest.mark.parametrize("key_name", ["gemini_api_key", "xai_api_key"])
def test_interpretation_secret_is_masked_and_not_part_of_settings_dump(key_name: str) -> None:
    settings = Settings(
        database_url="postgresql+psycopg://user:pass@db/app",
        **{key_name: "super-secret-provider-key"},
    )

    assert "super-secret-provider-key" not in repr(settings)
    assert key_name not in settings.model_dump(exclude={key_name})
