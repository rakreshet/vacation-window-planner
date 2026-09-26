"""Pure inclusive accounting for a resolved calendar and personal context."""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal, overload

from vacation_window_planner.domain.contracts import (
    DomainValue,
    HolidayCalendar,
    UserVacationContext,
    VacationWindow,
)


class DayDetail(DomainValue):
    date: date
    charged: bool
    kind: Literal[
        "extra_working_day", "personal_day_off", "public_holiday", "weekend", "ordinary_working"
    ]
    is_public_holiday: bool
    is_weekend: bool
    unavailable: bool


class UnavailableDates(DomainValue):
    code: Literal["unavailable_dates"] = "unavailable_dates"
    dates: tuple[date, ...]


class InsufficientNotice(DomainValue):
    code: Literal["insufficient_notice"] = "insufficient_notice"
    earliest_start_date: date


class OverBudget(DomainValue):
    code: Literal["over_budget"] = "over_budget"
    required_days: int
    permitted_days: int


type EligibilityReason = UnavailableDates | InsufficientNotice | OverBudget


class AssessmentSummary(DomainValue):
    window: VacationWindow
    remaining_balance: int
    eligible: bool
    eligibility_reasons: tuple[EligibilityReason, ...]
    warnings: tuple[Literal["full_balance", "negative_balance"], ...]


class WindowAssessment(AssessmentSummary):
    charged_dates: tuple[date, ...]
    day_details: tuple[DayDetail, ...]


@dataclass(frozen=True)
class PreparedCalendar:
    base: HolidayCalendar
    context: UserVacationContext
    coverage: tuple[date, date]
    local_today: date
    earliest_start_date: date


def prepare_calendar(
    base_calendar: HolidayCalendar,
    planning_context: UserVacationContext,
    coverage: tuple[date, date],
    local_today: date,
) -> PreparedCalendar:
    if coverage[1] < coverage[0]:
        raise ValueError("coverage end must not precede its start")
    try:
        earliest = local_today + timedelta(
            days=planning_context.personal_calendar.minimum_notice_days
        )
    except OverflowError as error:
        raise ValueError("minimum notice exceeds supported dates") from error
    return PreparedCalendar(base_calendar, planning_context, coverage, local_today, earliest)


@overload
def assess_window(
    start_date: date,
    end_date: date,
    prepared: PreparedCalendar,
    *,
    detail: Literal["days"] = "days",
) -> WindowAssessment: ...


@overload
def assess_window(
    start_date: date, end_date: date, prepared: PreparedCalendar, *, detail: Literal["summary"]
) -> AssessmentSummary: ...


def assess_window(
    start_date: date,
    end_date: date,
    prepared: PreparedCalendar,
    *,
    detail: Literal["days", "summary"] = "days",
) -> AssessmentSummary:
    if end_date < start_date:
        raise ValueError("end date must not precede start date")
    if start_date < prepared.coverage[0] or end_date > prepared.coverage[1]:
        raise ValueError("window lies outside prepared calendar coverage")
    days: list[DayDetail] = []
    charged: list[date] = []
    holidays: set[date] = set()
    unavailable: list[date] = []
    cost = 0
    for ordinal in range(start_date.toordinal(), end_date.toordinal() + 1):
        day = date.fromordinal(ordinal)
        holiday = day in prepared.base.observed_holidays
        weekend = day.weekday() in prepared.base.weekend_days
        kind: Literal[
            "extra_working_day", "personal_day_off", "public_holiday", "weekend", "ordinary_working"
        ]
        kind = "public_holiday" if holiday else "weekend" if weekend else "ordinary_working"
        for rule in prepared.context.personal_calendar.date_overrides:
            if rule.start_date <= day <= rule.end_date:
                kind = rule.kind
                break
        charged_day = kind in ("extra_working_day", "ordinary_working")
        blocked = any(
            r.start_date <= day <= r.end_date
            for r in prepared.context.personal_calendar.unavailable_ranges
        )
        cost += charged_day
        if holiday:
            holidays.add(day)
        if blocked:
            unavailable.append(day)
        if detail == "days":
            if charged_day:
                charged.append(day)
            days.append(
                DayDetail(
                    date=day,
                    charged=charged_day,
                    kind=kind,
                    is_public_holiday=holiday,
                    is_weekend=weekend,
                    unavailable=blocked,
                )
            )
    reasons: list[EligibilityReason] = []
    if unavailable:
        reasons.append(UnavailableDates(dates=tuple(unavailable)))
    earliest = prepared.earliest_start_date
    if start_date < earliest:
        reasons.append(InsufficientNotice(earliest_start_date=earliest))
    permitted = prepared.context.balance_days + prepared.context.allowed_negative_days
    if cost > permitted:
        reasons.append(OverBudget(required_days=cost, permitted_days=permitted))
    remaining = prepared.context.balance_days - cost
    warnings: tuple[Literal["full_balance", "negative_balance"], ...] = ()
    if remaining < 0:
        warnings = ("negative_balance",)
    elif remaining == 0 and cost > 0:
        warnings = ("full_balance",)
    summary = AssessmentSummary(
        window=VacationWindow(
            start_date=start_date,
            end_date=end_date,
            total_days=(end_date - start_date).days + 1,
            vacation_days_used=cost,
            holiday_dates=frozenset(holidays),
        ),
        remaining_balance=remaining,
        eligible=not reasons,
        eligibility_reasons=tuple(reasons),
        warnings=warnings,
    )
    if detail == "summary":
        return summary
    return WindowAssessment(
        **summary.model_dump(), charged_dates=tuple(charged), day_details=tuple(days)
    )
