"""Public database-session contract against disposable PostgreSQL."""

import os
from urllib.parse import urlparse

import pytest
from sqlalchemy import text

from vacation_window_planner.database import make_engine, make_session_factory


def test_typed_session_factory_connects_to_disposable_postgresql() -> None:
    database_url = os.environ.get("TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("TEST_DATABASE_URL is not set")
    parsed_url = urlparse(database_url)
    if parsed_url.hostname != "test-db" or parsed_url.path != "/vacation_test":
        pytest.fail("Session tests may only target the disposable test-db container")

    engine = make_engine(database_url)
    try:
        sessions = make_session_factory(engine)
        with sessions() as session:
            assert session.execute(text("SELECT 1")).scalar_one() == 1
    finally:
        engine.dispose()
