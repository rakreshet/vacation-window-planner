"""Pure vacation-window candidate generation."""

from datetime import date
from uuid import UUID

import pytest

from vacation_window_planner.domain.contracts import (
    HolidayCalendar,
    SearchConstraints,
    UserVacationContext,
    YearMonth,
)
from vacation_window_planner.domain.date_ranges import StartDateRange
from vacation_window_planner.domain.generator import (
    SearchTooBroadError,
    generate_vacation_windows,
)


def context(balance: int, allowed_negative: int = 0) -> UserVacationContext:
    return UserVacationContext(
        session_id=UUID("00000000-0000-0000-0000-000000000001"),
        balance_days=balance,
        allowed_negative_days=allowed_negative,
        country_code="IL",
        weekend_days=frozenset({4, 5}),
    )


def constraints(length: int, month: int = 9) -> SearchConstraints:
    return SearchConstraints(
        months=(YearMonth(year=2026, month=month),),
        preferred_length_days=length,
    )


def calendar(*holidays: date) -> HolidayCalendar:
    return HolidayCalendar(
        country_code="IL",
        weekend_days=frozenset({4, 5}),
        observed_holidays=frozenset(holidays),
    )


def test_weekend_and_observed_holiday_edges_are_not_charged() -> None:
    windows = generate_vacation_windows(
        context=context(balance=2),
        constraints=constraints(length=5),
        start_dates=(StartDateRange(date(2026, 9, 10), date(2026, 9, 10)),),
        calendar=calendar(date(2026, 9, 10)),
        generation_cap=10,
        length_tolerance_days=0,
    )

    assert windows[0].start_date == date(2026, 9, 10)
    assert windows[0].end_date == date(2026, 9, 14)
    assert windows[0].vacation_days_used == 2
    assert windows[0].holiday_dates == frozenset({date(2026, 9, 10)})


def test_selected_month_constrains_start_but_not_end() -> None:
    windows = generate_vacation_windows(
        context=context(balance=5),
        constraints=constraints(length=4, month=9),
        start_dates=(StartDateRange(date(2026, 9, 30), date(2026, 9, 30)),),
        calendar=calendar(),
        generation_cap=10,
        length_tolerance_days=0,
    )

    assert [(window.start_date, window.end_date) for window in windows] == [
        (date(2026, 9, 30), date(2026, 10, 3))
    ]


def test_zero_pto_window_is_eligible_when_it_matches_length() -> None:
    windows = generate_vacation_windows(
        context=context(balance=0),
        constraints=constraints(length=2),
        start_dates=(StartDateRange(date(2026, 9, 11), date(2026, 9, 11)),),
        calendar=calendar(),
        generation_cap=10,
        length_tolerance_days=0,
    )

    assert windows[0].vacation_days_used == 0


def test_default_zero_negative_allowance_rejects_over_balance() -> None:
    windows = generate_vacation_windows(
        context=context(balance=0),
        constraints=constraints(length=1),
        start_dates=(StartDateRange(date(2026, 9, 13), date(2026, 9, 13)),),
        calendar=calendar(),
        generation_cap=10,
        length_tolerance_days=0,
    )

    assert windows == ()


def test_explicit_negative_allowance_permits_exact_balance_floor() -> None:
    windows = generate_vacation_windows(
        context=context(balance=0, allowed_negative=1),
        constraints=constraints(length=1),
        start_dates=(StartDateRange(date(2026, 9, 13), date(2026, 9, 13)),),
        calendar=calendar(),
        generation_cap=10,
        length_tolerance_days=0,
    )

    assert windows[0].vacation_days_used == 1


def test_soft_tolerance_generates_consecutive_lengths_in_stable_order() -> None:
    windows = generate_vacation_windows(
        context=context(balance=10),
        constraints=constraints(length=3),
        start_dates=(StartDateRange(date(2026, 9, 13), date(2026, 9, 13)),),
        calendar=calendar(),
        generation_cap=10,
        length_tolerance_days=1,
    )

    assert [window.total_days for window in windows] == [2, 3, 4]


def test_generation_cap_returns_no_partial_candidates() -> None:
    with pytest.raises(SearchTooBroadError) as raised:
        generate_vacation_windows(
            context=context(balance=10),
            constraints=constraints(length=2),
            start_dates=(StartDateRange(date(2026, 9, 13), date(2026, 9, 14)),),
            calendar=calendar(),
            generation_cap=1,
            length_tolerance_days=0,
        )

    assert raised.value.code == "SEARCH_TOO_BROAD"
    assert "narrow" in str(raised.value).lower()
