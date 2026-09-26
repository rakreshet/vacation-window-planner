from datetime import date

from vacation_window_planner.domain.calendar import FakeCalendarProvider
from vacation_window_planner.domain.evaluation import evaluate_window


def test_exact_window_explains_charged_dates_even_when_over_budget() -> None:
    calendar = FakeCalendarProvider({"IL": frozenset({date(2027, 1, 4)})}).resolve(
        "IL", date(2027, 1, 1), date(2027, 1, 9)
    )
    result = evaluate_window(date(2027, 1, 1), date(2027, 1, 9), calendar, balance_days=2)
    assert result.window.total_days == 9
    assert result.charged_dates == (
        date(2027, 1, 3),
        date(2027, 1, 5),
        date(2027, 1, 6),
        date(2027, 1, 7),
    )
    assert result.window.vacation_days_used == 4
    assert result.remaining_balance == -2


def test_cross_year_window_counts_holiday_weekend_overlap_once() -> None:
    calendar = FakeCalendarProvider({"IL": frozenset({date(2027, 1, 1)})}).resolve(
        "IL", date(2026, 12, 31), date(2027, 1, 2)
    )
    result = evaluate_window(date(2026, 12, 31), date(2027, 1, 2), calendar, balance_days=1)
    assert result.charged_dates == (date(2026, 12, 31),)
    assert result.window.total_days == 3
    assert result.remaining_balance == 0


def test_weekend_window_uses_no_vacation_days() -> None:
    calendar = FakeCalendarProvider().resolve("IL", date(2027, 1, 1), date(2027, 1, 2))
    result = evaluate_window(date(2027, 1, 1), date(2027, 1, 2), calendar, balance_days=0)
    assert result.charged_dates == ()
    assert result.remaining_balance == 0
