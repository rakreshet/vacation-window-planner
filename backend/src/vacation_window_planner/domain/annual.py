from datetime import date, timedelta
from itertools import combinations
from typing import Literal, Self

from pydantic import Field, StrictInt, field_validator, model_validator

from vacation_window_planner.domain.annual_budget import (
    DEFAULT_ANNUAL_POLICY,
    LimitReason,
    WorkCounters,
    WorkLimitExceeded,
)
from vacation_window_planner.domain.annual_budget import (
    AnnualPolicy as AnnualPolicy,
)
from vacation_window_planner.domain.annual_budget import (
    WorkBudget as WorkBudget,
)
from vacation_window_planner.domain.annual_search import Selection, select_annual_breaks
from vacation_window_planner.domain.assessment import DayDetail, PreparedCalendar, assess_window
from vacation_window_planner.domain.contracts import VacationWindow
from vacation_window_planner.domain.personal_calendar import DateRange
from vacation_window_planner.domain.values import DomainValue


class BreakSlot(DomainValue):
    slot_id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    min_days: StrictInt = Field(ge=1, le=28)
    max_days: StrictInt = Field(ge=1, le=28)
    locked_dates: DateRange | None = None

    @model_validator(mode="after")
    def validate_length(self) -> Self:
        if self.min_days > self.max_days:
            raise ValueError("Minimum length must not exceed maximum length")
        if self.locked_dates is None and self.min_days < 3:
            raise ValueError("Generated breaks need at least three days")
        if self.locked_dates is not None:
            length = (self.locked_dates.end_date - self.locked_dates.start_date).days + 1
            if not self.min_days <= length <= self.max_days:
                raise ValueError("Locked dates must fit the slot length")
            if self.min_days < 3 and (self.min_days != length or self.max_days != length):
                raise ValueError("Short exact-date slots must match their locked length")
        return self


class AnnualRequest(DomainValue):
    year: StrictInt = Field(ge=1, le=9999)
    reserve_days: StrictInt = Field(default=0, ge=0, le=366)
    slots: tuple[BreakSlot, ...] = Field(min_length=1, max_length=6)
    allowed_start_months: tuple[StrictInt, ...] = tuple(range(1, 13))
    minimum_gap_days: StrictInt = Field(default=7, ge=0, le=60)

    @field_validator("allowed_start_months")
    @classmethod
    def validate_months(cls, months: tuple[int, ...]) -> tuple[int, ...]:
        if len(set(months)) != len(months) or any(month < 1 or month > 12 for month in months):
            raise ValueError("Choose unique months from January through December")
        return tuple(sorted(months))

    @model_validator(mode="after")
    def validate_mix(self) -> Self:
        if len({slot.slot_id for slot in self.slots}) != len(self.slots):
            raise ValueError("Break slot IDs must be unique")
        if not self.allowed_start_months and any(slot.locked_dates is None for slot in self.slots):
            raise ValueError("Choose start months for generated breaks")
        return self


class AnnualBreak(DomainValue):
    slot_id: str
    locked: bool
    notice_waived: bool = False
    window: VacationWindow
    charged_dates: tuple[date, ...]
    day_details: tuple[DayDetail, ...]
    balance_after_break: int


class AnnualAccounting(DomainValue):
    available_days: int
    reserve_days: int
    spendable_days: int
    total_leave_used: int
    remaining_days: int
    unallocated_days: int
    total_days_away: int
    charged_dates: tuple[date, ...]


class AnnualPlan(DomainValue):
    breaks: tuple[AnnualBreak, ...]
    accounting: AnnualAccounting


class LockedBudgetConflict(DomainValue):
    code: Literal["locked_budget"] = "locked_budget"
    slot_ids: tuple[str, ...]
    required_days: int
    permitted_days: int


class LockedUnavailableConflict(DomainValue):
    code: Literal["locked_unavailable"] = "locked_unavailable"
    slot_ids: tuple[str, ...]
    dates: tuple[date, ...]


class LockedOverlapConflict(DomainValue):
    code: Literal["locked_overlap"] = "locked_overlap"
    slot_ids: tuple[str, ...]


class LockedSpacingConflict(DomainValue):
    code: Literal["locked_spacing"] = "locked_spacing"
    slot_ids: tuple[str, ...]
    gap_days: int
    minimum_gap_days: int
    working_dates_between: int


type AnnualConflict = (
    LockedBudgetConflict | LockedUnavailableConflict | LockedOverlapConflict | LockedSpacingConflict
)


class AnnualOutcome(DomainValue):
    status: Literal["complete", "conflict", "infeasible", "too_broad"] = "complete"
    plans: tuple[AnnualPlan, ...] = Field(default=())
    locked_assessments: tuple[AnnualBreak, ...] = ()
    conflicts: tuple[AnnualConflict, ...] = ()
    year_calendar: tuple[DayDetail, ...]
    policy: AnnualPolicy = AnnualPolicy()
    counters: WorkCounters = WorkCounters()
    limit_reason: LimitReason | None = None


def plan_year(
    request: AnnualRequest,
    calendar: PreparedCalendar,
    *,
    policy: AnnualPolicy = DEFAULT_ANNUAL_POLICY,
    work_budget: WorkBudget | None = None,
) -> AnnualOutcome:
    budget = work_budget or WorkBudget(policy)
    if budget.policy != policy:
        raise ValueError("Work budget and annual policy must match")
    try:
        budget.checkpoint()
        result = calculate_year(request, calendar, budget)
        budget.checkpoint()
        return result.model_copy(update={"policy": policy, "counters": budget.counters})
    except WorkLimitExceeded as error:
        return AnnualOutcome(
            status="too_broad",
            year_calendar=(),
            policy=policy,
            counters=budget.counters,
            limit_reason=error.reason,
        )


def calculate_year(
    request: AnnualRequest, calendar: PreparedCalendar, budget: WorkBudget
) -> AnnualOutcome:
    validate_annual_context(request, calendar)
    year_calendar = assess_window(
        date(request.year, 1, 1), date(request.year, 12, 31), calendar
    ).day_details
    breaks = assess_locked_breaks(request, calendar)
    conflicts = locked_conflicts(request, calendar, breaks)
    plan_breaks = breaks
    if not conflicts and any(slot.locked_dates is None for slot in request.slots):
        selected = select_annual_breaks(request, calendar, year_calendar, breaks, budget)
        if selected is None:
            return AnnualOutcome(
                status="infeasible", year_calendar=year_calendar, locked_assessments=breaks
            )
        plan_breaks = assess_selection(request, calendar, selected)
    return AnnualOutcome(
        status="conflict" if conflicts else "complete",
        year_calendar=year_calendar,
        locked_assessments=breaks,
        conflicts=conflicts,
        plans=()
        if conflicts
        else (
            AnnualPlan(
                breaks=plan_breaks,
                accounting=annual_accounting(
                    plan_breaks, calendar.context.balance_days, request.reserve_days
                ),
            ),
        ),
    )


def assess_selection(
    request: AnnualRequest,
    calendar: PreparedCalendar,
    selection: Selection,
) -> tuple[AnnualBreak, ...]:
    selected_slots = list(request.slots)
    for index, candidate in selection:
        selected_slots[index] = selected_slots[index].model_copy(
            update={
                "locked_dates": DateRange(
                    start_date=candidate.start_date, end_date=candidate.end_date
                ),
            }
        )
    locked_ids = {slot.slot_id for slot in request.slots if slot.locked_dates is not None}
    return tuple(
        item.model_copy(update={"locked": item.slot_id in locked_ids})
        for item in assess_locked_breaks(
            request.model_copy(update={"slots": tuple(selected_slots)}), calendar
        )
    )


def assess_locked_breaks(
    request: AnnualRequest,
    calendar: PreparedCalendar,
) -> tuple[AnnualBreak, ...]:
    charged_so_far: set[date] = set()
    breaks: list[AnnualBreak] = []
    for slot in sorted(
        request.slots,
        key=lambda item: item.locked_dates.start_date if item.locked_dates else date.max,
    ):
        if slot.locked_dates is None:
            continue
        assessment = assess_window(
            slot.locked_dates.start_date, slot.locked_dates.end_date, calendar
        )
        charged_so_far.update(assessment.charged_dates)
        breaks.append(
            AnnualBreak(
                slot_id=slot.slot_id,
                locked=True,
                window=assessment.window,
                notice_waived=assessment.window.start_date < calendar.earliest_start_date,
                charged_dates=assessment.charged_dates,
                day_details=assessment.day_details,
                balance_after_break=calendar.context.balance_days - len(charged_so_far),
            )
        )
    return tuple(breaks)


def locked_conflicts(
    request: AnnualRequest,
    calendar: PreparedCalendar,
    breaks: tuple[AnnualBreak, ...],
) -> tuple[AnnualConflict, ...]:
    conflicts: list[AnnualConflict] = []
    for left, right in combinations(breaks, 2):
        conflict = separation_conflict(left, right, request.minimum_gap_days, calendar)
        if conflict:
            conflicts.append(conflict)
    for item in breaks:
        unavailable = tuple(day.date for day in item.day_details if day.unavailable)
        if unavailable:
            conflicts.append(LockedUnavailableConflict(slot_ids=(item.slot_id,), dates=unavailable))
    cost = len({day for item in breaks for day in item.charged_dates})
    spendable = calendar.context.balance_days - request.reserve_days
    if cost > spendable:
        conflicts.append(
            LockedBudgetConflict(
                slot_ids=tuple(item.slot_id for item in breaks),
                required_days=cost,
                permitted_days=spendable,
            )
        )
    return tuple(sorted(conflicts, key=lambda item: (item.slot_ids, item.code)))


def separation_conflict(
    left: AnnualBreak,
    right: AnnualBreak,
    minimum_gap: int,
    calendar: PreparedCalendar,
) -> LockedOverlapConflict | LockedSpacingConflict | None:
    if left.window.end_date >= right.window.start_date:
        return LockedOverlapConflict(slot_ids=(left.slot_id, right.slot_id))
    gap = (right.window.start_date - left.window.end_date).days - 1
    working = (
        assess_window(
            left.window.end_date + timedelta(days=1),
            right.window.start_date - timedelta(days=1),
            calendar,
            detail="summary",
        ).window.vacation_days_used
        if gap
        else 0
    )
    if gap < minimum_gap or not working:
        return LockedSpacingConflict(
            slot_ids=(left.slot_id, right.slot_id),
            gap_days=gap,
            minimum_gap_days=minimum_gap,
            working_dates_between=working,
        )
    return None


def annual_accounting(
    breaks: tuple[AnnualBreak, ...],
    available: int,
    reserve: int,
) -> AnnualAccounting:
    charged = tuple(sorted({day for item in breaks for day in item.charged_dates}))
    remaining = available - len(charged)
    return AnnualAccounting(
        available_days=available,
        reserve_days=reserve,
        spendable_days=available - reserve,
        total_leave_used=len(charged),
        remaining_days=remaining,
        unallocated_days=remaining - reserve,
        total_days_away=sum(item.window.total_days for item in breaks),
        charged_dates=charged,
    )


def validate_annual_context(request: AnnualRequest, calendar: PreparedCalendar) -> None:
    if (
        calendar.base.country_code != calendar.context.country_code
        or calendar.base.weekend_days != calendar.context.weekend_days
    ):
        raise ValueError("Resolved calendar must match the common planning context")
    if calendar.context.allowed_negative_days:
        raise ValueError("Annual planning does not use a negative allowance")
    if not calendar.local_today.year <= request.year <= calendar.local_today.year + 2:
        raise ValueError("Choose the current year or one of the next two years")
    if not 0 <= calendar.context.balance_days <= 366:
        raise ValueError("Available leave must be between zero and 366 days")
    if request.reserve_days > calendar.context.balance_days:
        raise ValueError("Reserve cannot exceed available leave")
    for slot in request.slots:
        dates = slot.locked_dates
        if dates is not None and (
            dates.start_date < calendar.local_today
            or dates.start_date.year != request.year
            or dates.end_date.year != request.year
        ):
            raise ValueError(
                f"Locked break {slot.slot_id} must start today or later within the plan year"
            )
