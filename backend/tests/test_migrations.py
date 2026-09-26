"""Migration contract against a disposable PostgreSQL database."""

import os
from pathlib import Path
from urllib.parse import urlparse

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


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
        command.upgrade(config, "20260926_06")
        with engine.begin() as connection:
            connection.execute(
                text("""
                INSERT INTO anonymous_sessions
                (id, token_hash, created_at, expires_at, balance_days, allowed_negative_days,
                 country_code, weekend_days, time_zone)
                VALUES ('00000000-0000-0000-0000-000000000099', 'migration-fixture',
                        now(), now() + interval '1 day', 8, 0, 'IL', '[4,5]', 'Asia/Jerusalem')
            """)
            )
        command.upgrade(config, "head")
        with engine.connect() as connection:
            assert (
                connection.execute(
                    text(
                        "SELECT personal_calendar FROM anonymous_sessions "
                        "WHERE token_hash = 'migration-fixture'"
                    )
                ).scalar_one()
                == {}
            )

        assert inspect(engine).has_table("anonymous_sessions")
        assert {
            "balance_days",
            "allowed_negative_days",
            "country_code",
            "weekend_days",
            "time_zone",
            "personal_calendar",
        } <= {column["name"] for column in inspect(engine).get_columns("anonymous_sessions")}
        assert inspect(engine).has_table("searches")
        assert inspect(engine).has_table("recommendations")
        assert inspect(engine).has_table("feedback")
        assert inspect(engine).has_table("comparisons")

        command.downgrade(config, "base")
        assert not inspect(engine).has_table("anonymous_sessions")
    finally:
        engine.dispose()
