"""Country workweek defaults are deterministic and easy to replace later."""

import pytest

from vacation_window_planner.domain.workweek import default_weekend_days


@pytest.mark.parametrize(
    ("country_code", "expected"),
    [
        ("IL", frozenset({4, 5})),
        ("US", frozenset({5, 6})),
        ("GB", frozenset({5, 6})),
    ],
)
def test_country_workweek_defaults(country_code: str, expected: frozenset[int]) -> None:
    assert default_weekend_days(country_code) == expected
