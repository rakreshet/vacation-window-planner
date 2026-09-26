"""Exact, inclusive date accounting shared by Search and comparison."""

from datetime import date
from uuid import UUID

from vacation_window_planner.domain.assessment import assess_window, prepare_calendar
from vacation_window_planner.domain.contracts import (
    DomainValue,
    HolidayCalendar,
    UserVacationContext,
    VacationWindow,
)


class WindowEvaluation(DomainValue):
    window: VacationWindow
    charged_dates: tuple[date, ...]
    remaining_balance: int


def evaluate_window(
    start_date: date,
    end_date: date,
    calendar: HolidayCalendar,
    *,
    balance_days: int,
) -> WindowEvaluation:
    """Evaluate exact dates without filtering out an over-budget window."""
    context = UserVacationContext(
        session_id=UUID(int=0),
        balance_days=balance_days,
        country_code=calendar.country_code,
        weekend_days=calendar.weekend_days,
    )
    prepared = prepare_calendar(calendar, context, (start_date, end_date), start_date)
    assessment = assess_window(start_date, end_date, prepared)
    return WindowEvaluation(
        window=assessment.window,
        charged_dates=assessment.charged_dates,
        remaining_balance=assessment.remaining_balance,
    )
