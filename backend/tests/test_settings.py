import pytest
from pydantic import ValidationError
from sqlalchemy.engine import make_url

from vacation_window_planner.settings import Settings


def test_blank_database_url_is_rejected_before_startup() -> None:
    with pytest.raises(ValidationError):
        Settings(database_url="")


def test_non_postgresql_database_url_is_rejected_before_startup() -> None:
    with pytest.raises(ValidationError):
        Settings(database_url="sqlite:///local.db")


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+psycopg"])
def test_provider_urls_keep_credentials_and_tls_while_selecting_psycopg(scheme: str) -> None:
    settings = Settings(
        database_url=f"{scheme}://user:pass%40word%25@db.example/neondb?sslmode=require"
    )
    url = make_url(settings.database_url)
    assert url.drivername == "postgresql+psycopg"
    assert url.password == "pass@word%"
    assert url.query["sslmode"] == "require"


@pytest.mark.parametrize(
    "value",
    ["postgresql:///vacation", "postgresql://db.example", "postgresql+psycopg2://db.example/db"],
)
def test_incomplete_or_unsupported_driver_urls_are_rejected(value: str) -> None:
    with pytest.raises(ValidationError):
        Settings(database_url=value)
