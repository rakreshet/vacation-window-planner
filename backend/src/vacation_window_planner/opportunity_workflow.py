from dataclasses import dataclass
from datetime import date

from vacation_window_planner.domain.assessment import prepare_calendar
from vacation_window_planner.domain.calendar import CalendarProvider, CalendarResolutionUnavailable
from vacation_window_planner.domain.contracts import (
    HolidayCalendar,
    SearchConstraints,
    UserVacationContext,
    VacationWindow,
)
from vacation_window_planner.domain.opportunities import (
    OpportunityPolicy,
    OpportunityResult,
    detect_opportunities,
    opportunity_coverage,
)


@dataclass(frozen=True)
class OpportunityScan:
    result: OpportunityResult
    calendar: HolidayCalendar | None
    coverage_end: date


def scan_opportunities(
    provider: CalendarProvider,
    context: UserVacationContext,
    constraints: SearchConstraints,
    explicit_windows: tuple[VacationWindow, ...],
    today: date,
    search_tolerance: int,
    policy: OpportunityPolicy,
) -> OpportunityScan:
    horizon, coverage_end = opportunity_coverage(today, policy)
    try:
        calendar = provider.resolve(
            context.country_code,
            horizon.start_date,
            coverage_end,
            weekend_override=context.weekend_days,
        )
    except CalendarResolutionUnavailable:
        return OpportunityScan(
            OpportunityResult(
                status="unavailable", policy=policy, start_horizon=horizon, evaluated_pair_count=0
            ),
            None,
            coverage_end,
        )
    prepared = prepare_calendar(calendar, context, (horizon.start_date, coverage_end), today)
    result = detect_opportunities(
        prepared,
        constraints,
        explicit_windows,
        search_length_tolerance=search_tolerance,
        policy=policy,
    )
    return OpportunityScan(result, calendar, coverage_end)
