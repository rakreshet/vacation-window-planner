"""Pure comparison accounting; feasibility is separate from exact cost."""

from datetime import date, timedelta

from vacation_window_planner.domain.comparison import ComparedWindow, ComparisonWarning
from vacation_window_planner.domain.contracts import HolidayCalendar, UserVacationContext
from vacation_window_planner.domain.evaluation import evaluate_window


def describe_window(
    start: date, end: date, calendar: HolidayCalendar, context: UserVacationContext
) -> ComparedWindow:
    evaluation = evaluate_window(start, end, calendar, balance_days=context.balance_days)
    remaining = evaluation.remaining_balance
    feasible = remaining >= -context.allowed_negative_days
    warnings: tuple[ComparisonWarning, ...] = ()
    if not feasible:
        warnings = (ComparisonWarning.OVER_BUDGET,)
    elif remaining < 0:
        warnings = (ComparisonWarning.NEGATIVE_BALANCE,)
    elif remaining == 0:
        warnings = (ComparisonWarning.FULL_BALANCE,)
    weekends = tuple(
        start + timedelta(days=offset)
        for offset in range(evaluation.window.total_days)
        if (start + timedelta(days=offset)).weekday() in calendar.weekend_days
    )
    return ComparedWindow(
        **evaluation.model_dump(), weekend_dates=weekends, feasible=feasible, warnings=warnings
    )
