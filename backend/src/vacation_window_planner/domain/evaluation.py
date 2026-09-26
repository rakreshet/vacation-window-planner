"""Exact, inclusive date accounting shared by Search and comparison."""

from datetime import date, timedelta

from vacation_window_planner.domain.contracts import DomainValue, HolidayCalendar, VacationWindow


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
    if end_date < start_date:
        raise ValueError("end date must not precede start date")
    dates = tuple(
        start_date + timedelta(days=offset) for offset in range((end_date - start_date).days + 1)
    )
    holidays = frozenset(day for day in dates if day in calendar.observed_holidays)
    charged = tuple(
        day for day in dates if day.weekday() not in calendar.weekend_days and day not in holidays
    )
    return WindowEvaluation(
        window=VacationWindow(
            start_date=start_date,
            end_date=end_date,
            total_days=len(dates),
            vacation_days_used=len(charged),
            holiday_dates=holidays,
        ),
        charged_dates=charged,
        remaining_balance=balance_days - len(charged),
    )
