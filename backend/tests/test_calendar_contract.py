"""Contract tests for calendar resolution, independent of a live provider."""

from datetime import date

import pytest

from vacation_window_planner.domain.calendar import FakeCalendarProvider, UnsupportedCalendarError


def test_israel_uses_friday_and_saturday_weekend() -> None:
    calendar = FakeCalendarProvider().resolve("IL", date(2026, 9, 1), date(2026, 9, 30))

    assert calendar.country_code == "IL"
    assert calendar.weekend_days == frozenset({4, 5})
    assert calendar.observed_holidays == frozenset()


def test_us_uses_saturday_and_sunday_weekend() -> None:
    calendar = FakeCalendarProvider().resolve("US", date(2026, 9, 1), date(2026, 9, 30))

    assert calendar.weekend_days == frozenset({5, 6})


def test_observed_holidays_are_filtered_to_inclusive_requested_range() -> None:
    provider = FakeCalendarProvider(
        observed_holidays={
            "IL": frozenset(
                {date(2026, 8, 31), date(2026, 9, 1), date(2026, 9, 30), date(2026, 10, 1)}
            )
        }
    )

    calendar = provider.resolve("IL", date(2026, 9, 1), date(2026, 9, 30))

    assert calendar.observed_holidays == frozenset({date(2026, 9, 1), date(2026, 9, 30)})


def test_custom_workweek_overrides_locale_default() -> None:
    calendar = FakeCalendarProvider().resolve(
        "IL", date(2026, 9, 1), date(2026, 9, 30), weekend_override=frozenset({5, 6})
    )

    assert calendar.weekend_days == frozenset({5, 6})


def test_unsupported_country_fails_clearly() -> None:
    with pytest.raises(UnsupportedCalendarError, match="FR"):
        FakeCalendarProvider().resolve("FR", date(2026, 9, 1), date(2026, 9, 30))


def test_end_before_start_fails_clearly() -> None:
    with pytest.raises(ValueError, match="end date"):
        FakeCalendarProvider().resolve("IL", date(2026, 9, 30), date(2026, 9, 1))
