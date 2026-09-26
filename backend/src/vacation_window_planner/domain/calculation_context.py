"""Sanitized, reproducible context attached to calculated results."""

from datetime import UTC, date, datetime
from typing import Literal

from vacation_window_planner.domain.contracts import DomainValue, UserVacationContext
from vacation_window_planner.domain.personal_calendar import PersonalCalendar


class PlanningContext(DomainValue):
    balance_days: int
    allowed_negative_days: int
    country_code: str
    weekend_days: tuple[int, ...]
    time_zone: str
    personal_calendar: PersonalCalendar


class CalculationContext(DomainValue):
    accounting_version: Literal["phase075-v1"] = "phase075-v1"
    calculated_at: datetime
    local_today: date
    planning: PlanningContext


def capture_context(context: UserVacationContext, now: datetime, today: date) -> CalculationContext:
    return CalculationContext(
        calculated_at=now.astimezone(UTC),
        local_today=today,
        planning=PlanningContext(
            balance_days=context.balance_days,
            allowed_negative_days=context.allowed_negative_days,
            country_code=context.country_code,
            weekend_days=tuple(sorted(context.weekend_days)),
            time_zone=context.time_zone,
            personal_calendar=context.personal_calendar,
        ),
    )
