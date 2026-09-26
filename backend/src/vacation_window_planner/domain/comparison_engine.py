"""Pure comparison accounting; feasibility is separate from exact cost."""

from datetime import date, timedelta

from vacation_window_planner.domain.comparison import (
    ComparedWindow,
    ComparisonAlternative,
    ComparisonDelta,
    ComparisonPolicy,
    ComparisonWarning,
)
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


class ComparisonTooBroadError(ValueError):
    """Discovery must finish completely before any result is returned."""


def discover_alternatives(
    baseline: ComparedWindow,
    *,
    calendar: HolidayCalendar,
    context: UserVacationContext,
    policy: ComparisonPolicy,
    today: date,
) -> tuple[tuple[ComparisonAlternative, ...], tuple[ComparisonAlternative, ...]]:
    """Rank literal gains relative to one baseline, grouping identical outcomes."""
    window = baseline.window
    earliest = date.fromordinal(
        max(today.toordinal(), window.start_date.toordinal() - policy.shift_days)
    )
    latest = window.start_date + timedelta(days=policy.shift_days)
    maximum_length = min(policy.max_length_days, window.total_days + policy.extra_days)
    candidate_count = ((latest - earliest).days + 1) * (maximum_length - window.total_days + 1)
    if candidate_count > policy.generation_cap:
        raise ComparisonTooBroadError("We could not finish checking nearby dates. Try again later.")
    saved: list[ComparisonAlternative] = []
    longer: list[ComparisonAlternative] = []
    for offset in range((latest - earliest).days + 1):
        start = earliest + timedelta(days=offset)
        for length in range(window.total_days, maximum_length + 1):
            end = start + timedelta(days=length - 1)
            evaluated = describe_window(start, end, calendar, context)
            savings = window.vacation_days_used - evaluated.window.vacation_days_used
            extra = length - window.total_days
            if not evaluated.feasible or savings < 0 or (extra == 0 and savings == 0):
                continue
            delta = ComparisonDelta(
                extra_days=extra,
                vacation_days_saved=savings,
                start_shift_days=(start - window.start_date).days,
                end_shift_days=(end - window.end_date).days,
            )
            explanation = (
                f"Same {length} days off, {savings} fewer vacation "
                f"{'day' if savings == 1 else 'days'}."
                if extra == 0
                else f"{extra} more {'day' if extra == 1 else 'days'} off, "
                + (
                    f"{savings} fewer vacation {'day' if savings == 1 else 'days'}."
                    if savings
                    else "no extra vacation days."
                )
            )
            alternative = ComparisonAlternative(
                evaluation=evaluated, delta=delta, explanation=explanation
            )
            (saved if extra == 0 else longer).append(alternative)

    def select(
        items: list[ComparisonAlternative], *, by_length: bool
    ) -> tuple[ComparisonAlternative, ...]:
        ordered = sorted(
            items,
            key=lambda item: (
                -(item.delta.extra_days if by_length else item.delta.vacation_days_saved),
                abs(item.delta.start_shift_days) + abs(item.delta.end_shift_days),
                item.evaluation.window.start_date,
                item.evaluation.window.end_date,
            ),
        )
        outcomes: set[tuple[int, int]] = set()
        selected: list[ComparisonAlternative] = []
        for item in ordered:
            identity = (
                item.evaluation.window.total_days,
                item.evaluation.window.vacation_days_used,
            )
            if identity not in outcomes:
                selected.append(item)
                outcomes.add(identity)
            if len(selected) == policy.result_limit:
                break
        return tuple(selected)

    return select(saved, by_length=False), select(longer, by_length=True)
