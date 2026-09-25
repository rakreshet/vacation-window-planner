"""Provider-independent effective holiday calendar resolution."""

from collections.abc import Mapping
from datetime import date
from typing import Protocol

from vacation_window_planner.domain.contracts import HolidayCalendar


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

    DEFAULT_WEEKENDS: Mapping[str, frozenset[int]] = {
        "IL": frozenset({4, 5}),
        "US": frozenset({5, 6}),
    }

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
        try:
            default_weekend = self.DEFAULT_WEEKENDS[country_code]
        except KeyError as error:
            raise UnsupportedCalendarError(
                f"unsupported country calendar: {country_code}"
            ) from error
        observed = self.observed_holidays.get(country_code, frozenset())
        return HolidayCalendar(
            country_code=country_code,
            weekend_days=default_weekend if weekend_override is None else weekend_override,
            observed_holidays=frozenset(day for day in observed if start_date <= day <= end_date),
        )
