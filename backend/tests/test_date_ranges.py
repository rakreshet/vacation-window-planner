"""Future-date normalization at the domain boundary."""

from datetime import date

import pytest

from vacation_window_planner.domain.contracts import YearMonth
from vacation_window_planner.domain.date_ranges import (
    PastSearchRangeError,
    normalize_selected_months,
)


def test_fully_future_month_is_unchanged() -> None:
    result = normalize_selected_months((YearMonth(year=2027, month=2),), date(2026, 9, 25))

    assert result.start_dates[0].start_date == date(2027, 2, 1)
    assert result.start_dates[0].end_date == date(2027, 2, 28)
    assert result.notice is None


def test_current_month_is_clipped_to_today() -> None:
    result = normalize_selected_months((YearMonth(year=2026, month=9),), date(2026, 9, 25))

    assert result.start_dates[0].start_date == date(2026, 9, 25)
    assert result.start_dates[0].end_date == date(2026, 9, 30)
    assert result.notice == "Past start dates were excluded; search begins on 2026-09-25."


def test_fully_past_selection_fails_clearly() -> None:
    with pytest.raises(PastSearchRangeError, match="past"):
        normalize_selected_months((YearMonth(year=2026, month=8),), date(2026, 9, 25))


def test_leap_year_february_includes_twenty_ninth() -> None:
    result = normalize_selected_months((YearMonth(year=2028, month=2),), date(2027, 1, 1))

    assert result.start_dates[0].end_date == date(2028, 2, 29)


def test_past_month_is_dropped_while_future_month_remains() -> None:
    result = normalize_selected_months(
        (YearMonth(year=2026, month=8), YearMonth(year=2026, month=10)),
        date(2026, 9, 25),
    )

    assert [(item.start_date, item.end_date) for item in result.start_dates] == [
        (date(2026, 10, 1), date(2026, 10, 31))
    ]
    assert result.notice == "Past start dates were excluded; search begins on 2026-10-01."


def test_range_ends_at_month_boundary_without_limiting_window_end() -> None:
    result = normalize_selected_months((YearMonth(year=2026, month=12),), date(2026, 12, 31))

    assert result.start_dates[0].start_date == date(2026, 12, 31)
    assert result.start_dates[0].end_date == date(2026, 12, 31)
