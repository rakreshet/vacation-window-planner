"""Pure enumeration of feasible vacation windows."""

from datetime import date, timedelta

from vacation_window_planner.domain.contracts import (
    HolidayCalendar,
    SearchConstraints,
    UserVacationContext,
    VacationWindow,
)
from vacation_window_planner.domain.date_ranges import StartDateRange
from vacation_window_planner.domain.evaluation import evaluate_window


class SearchTooBroadError(ValueError):
    """Enumeration exceeded its safety limit without returning partial results."""

    code = "SEARCH_TOO_BROAD"

    def __init__(self) -> None:
        super().__init__("Search is too broad; narrow the selected months or length flexibility.")


def _dates_between(start_date: date, end_date: date) -> tuple[date, ...]:
    return tuple(
        start_date + timedelta(days=offset) for offset in range((end_date - start_date).days + 1)
    )


def generate_vacation_windows(
    *,
    context: UserVacationContext,
    constraints: SearchConstraints,
    start_dates: tuple[StartDateRange, ...],
    calendar: HolidayCalendar,
    generation_cap: int,
    length_tolerance_days: int = 2,
) -> tuple[VacationWindow, ...]:
    """Enumerate the complete feasible candidate set or fail without partial output."""
    if generation_cap < 1:
        raise ValueError("generation cap must be positive")
    if length_tolerance_days < 0:
        raise ValueError("length tolerance must not be negative")
    if context.country_code != calendar.country_code:
        raise ValueError("context and calendar country must match")

    lengths = range(
        max(1, constraints.preferred_length_days - length_tolerance_days),
        constraints.preferred_length_days + length_tolerance_days + 1,
    )
    considered = 0
    windows: list[VacationWindow] = []
    seen: set[tuple[date, date]] = set()

    for allowed_range in sorted(start_dates, key=lambda item: item.start_date):
        for start_date in _dates_between(allowed_range.start_date, allowed_range.end_date):
            for total_days in lengths:
                considered += 1
                if considered > generation_cap:
                    raise SearchTooBroadError

                end_date = start_date + timedelta(days=total_days - 1)
                identity = (start_date, end_date)
                if identity in seen:
                    continue
                seen.add(identity)
                evaluation = evaluate_window(
                    start_date, end_date, calendar, balance_days=context.balance_days
                )
                if evaluation.remaining_balance < -context.allowed_negative_days:
                    continue
                windows.append(evaluation.window)

    return tuple(windows)
