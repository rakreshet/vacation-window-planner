"""Migration contract against a disposable PostgreSQL database."""

import os
from pathlib import Path
from urllib.parse import urlparse

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_upgrade_and_downgrade_session_schema() -> None:
    database_url = os.environ.get("TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("TEST_DATABASE_URL is not set")
    parsed_url = urlparse(database_url)
    if parsed_url.hostname != "test-db" or parsed_url.path != "/vacation_test":
        pytest.fail("Migration tests may only target the disposable test-db container")

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    engine = create_engine(database_url)

    try:
        command.upgrade(config, "head")
        assert inspect(engine).has_table("anonymous_sessions")
        assert {
            "balance_days",
            "allowed_negative_days",
            "country_code",
            "weekend_days",
        } <= {column["name"] for column in inspect(engine).get_columns("anonymous_sessions")}
        assert inspect(engine).has_table("searches")
        assert inspect(engine).has_table("recommendations")

        command.downgrade(config, "base")
        assert not inspect(engine).has_table("anonymous_sessions")
    finally:
        engine.dispose()
