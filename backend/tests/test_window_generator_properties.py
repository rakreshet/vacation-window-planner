"""Deterministic property corpus for vacation-window generation."""

from datetime import date, timedelta
from uuid import UUID

from hypothesis import given, settings
from hypothesis import strategies as st

from vacation_window_planner.domain.contracts import (
    HolidayCalendar,
    SearchConstraints,
    UserVacationContext,
    YearMonth,
)
from vacation_window_planner.domain.date_ranges import StartDateRange
from vacation_window_planner.domain.generator import generate_vacation_windows


@settings(max_examples=150, derandomize=True, deadline=None)
@given(
    month=st.integers(min_value=1, max_value=12),
    start_day=st.integers(min_value=1, max_value=20),
    start_span=st.integers(min_value=0, max_value=5),
    preferred_length=st.integers(min_value=1, max_value=8),
    tolerance=st.integers(min_value=0, max_value=2),
    balance=st.integers(min_value=0, max_value=8),
    allowed_negative=st.integers(min_value=0, max_value=5),
    weekend_days=st.frozensets(st.integers(min_value=0, max_value=6), min_size=1, max_size=3),
    holiday_offsets=st.frozensets(st.integers(min_value=0, max_value=20), max_size=6),
)
def test_generated_windows_preserve_domain_invariants(
    month: int,
    start_day: int,
    start_span: int,
    preferred_length: int,
    tolerance: int,
    balance: int,
    allowed_negative: int,
    weekend_days: frozenset[int],
    holiday_offsets: frozenset[int],
) -> None:
    first_allowed = date(2027, month, start_day)
    last_allowed = first_allowed + timedelta(days=start_span)
    holidays = frozenset(first_allowed + timedelta(days=offset) for offset in holiday_offsets)
    context = UserVacationContext(
        session_id=UUID("00000000-0000-0000-0000-000000000001"),
        balance_days=balance,
        allowed_negative_days=allowed_negative,
        country_code="IL",
        weekend_days=weekend_days,
    )
    constraints = SearchConstraints(
        months=(YearMonth(year=2027, month=month),),
        preferred_length_days=preferred_length,
    )
    calendar = HolidayCalendar(
        country_code="IL",
        weekend_days=weekend_days,
        observed_holidays=holidays,
    )

    windows = generate_vacation_windows(
        context=context,
        constraints=constraints,
        start_dates=(StartDateRange(first_allowed, last_allowed),),
        calendar=calendar,
        generation_cap=100,
        length_tolerance_days=tolerance,
    )

    identities = [(window.start_date, window.end_date) for window in windows]
    assert len(identities) == len(set(identities))
    assert identities == sorted(identities, key=lambda item: (item[0], (item[1] - item[0]).days))

    for window in windows:
        assert window.start_date >= date(2027, 1, 1)
        assert window.start_date.month == month
        assert window.total_days == (window.end_date - window.start_date).days + 1
        assert balance - window.vacation_days_used >= -allowed_negative

        dates = (window.start_date + timedelta(days=offset) for offset in range(window.total_days))
        expected_charged = sum(
            day.weekday() not in weekend_days and day not in holidays for day in dates
        )
        assert window.vacation_days_used == expected_charged
        assert window.holiday_dates == frozenset(
            day for day in holidays if window.start_date <= day <= window.end_date
        )
