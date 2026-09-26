"""The configured interpretation provider is optional and explicit."""

import pytest
from pydantic import ValidationError

from vacation_window_planner.interpreter import build_interpreter
from vacation_window_planner.settings import Settings

DATABASE_URL = "postgresql+psycopg://user:pass@db/app"


def test_xai_key_enables_interpretation_without_gemini_key() -> None:
    settings = Settings(
        database_url=DATABASE_URL,
        interpret_provider="xai",
        xai_api_key="test-key",
        xai_model="grok-4.3",
    )

    assert build_interpreter(settings) is not None


def test_selected_provider_needs_its_own_key() -> None:
    assert build_interpreter(Settings(database_url=DATABASE_URL)) is None
    assert (
        build_interpreter(
            Settings(
                database_url=DATABASE_URL,
                interpret_provider="xai",
                gemini_api_key="google-only",
            )
        )
        is None
    )


def test_gemini_key_remains_supported() -> None:
    settings = Settings(database_url=DATABASE_URL, gemini_api_key="test-key")

    assert build_interpreter(settings) is not None


def test_unknown_provider_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(database_url=DATABASE_URL, interpret_provider="unknown")
