import pytest
from pydantic import ValidationError

from vacation_window_planner.settings import Settings


def test_blank_database_url_is_rejected_before_startup() -> None:
    with pytest.raises(ValidationError):
        Settings(database_url="")


def test_non_postgresql_database_url_is_rejected_before_startup() -> None:
    with pytest.raises(ValidationError):
        Settings(database_url="sqlite:///local.db")
