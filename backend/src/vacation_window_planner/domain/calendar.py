"""Provider-independent effective holiday calendar resolution."""

from collections.abc import Mapping
from datetime import date
from typing import Protocol

import holidays

from vacation_window_planner.domain.contracts import HolidayCalendar
from vacation_window_planner.domain.workweek import default_weekend_days


class UnsupportedCalendarError(ValueError):
    """The requested country does not have a configured calendar."""


class CalendarProvider(Protocol):
    """Resolve observed dates and an effective workweek for an inclusive range."""

    def resolve(
        self,
        country_code: str,
        start_date: date,
        end_date: date,
        weekend_override: frozenset[int] | None = None,
    ) -> HolidayCalendar: ...


class FakeCalendarProvider:
    """A fixed calendar for deterministic tests and offline development."""

    SUPPORTED_COUNTRIES = frozenset({"IL", "US"})

    def __init__(self, observed_holidays: Mapping[str, frozenset[date]] | None = None) -> None:
        self.observed_holidays = observed_holidays or {}

    def resolve(
        self,
        country_code: str,
        start_date: date,
        end_date: date,
        weekend_override: frozenset[int] | None = None,
    ) -> HolidayCalendar:
        if end_date < start_date:
            raise ValueError("end date must not precede start date")
        if country_code not in self.SUPPORTED_COUNTRIES:
            raise UnsupportedCalendarError(f"unsupported country calendar: {country_code}")
        observed = self.observed_holidays.get(country_code, frozenset())
        return HolidayCalendar(
            country_code=country_code,
            weekend_days=(
                default_weekend_days(country_code)
                if weekend_override is None
                else weekend_override
            ),
            observed_holidays=frozenset(day for day in observed if start_date <= day <= end_date),
        )


class PythonHolidaysCalendarProvider:
    """Production calendar backed by the offline ``python-holidays`` dataset."""

    SUPPORTED_COUNTRIES = frozenset({"IL"})

    def resolve(
        self,
        country_code: str,
        start_date: date,
        end_date: date,
        weekend_override: frozenset[int] | None = None,
    ) -> HolidayCalendar:
        if end_date < start_date:
            raise ValueError("end date must not precede start date")
        if country_code not in self.SUPPORTED_COUNTRIES:
            raise UnsupportedCalendarError(f"unsupported country calendar: {country_code}")

        source = holidays.country_holidays(
            country_code,
            years=range(start_date.year, end_date.year + 1),
            observed=True,
        )
        return HolidayCalendar(
            country_code=country_code,
            weekend_days=(
                default_weekend_days(country_code)
                if weekend_override is None
                else weekend_override
            ),
            observed_holidays=frozenset(day for day in source if start_date <= day <= end_date),
        )
