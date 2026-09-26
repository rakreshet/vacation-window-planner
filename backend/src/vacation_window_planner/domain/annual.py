import hashlib
import json
from dataclasses import replace
from datetime import date, timedelta
from itertools import combinations
from typing import Annotated, Literal, Self

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
from vacation_window_planner.domain.annual_search import (
    CandidateGraph,
    Selection,
    build_candidate_graph,
    solve_annual_graph,
)
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

    @model_validator(mode="after")
    def validate_day_accounting(self) -> Self:
        expected_dates = tuple(
            date.fromordinal(ordinal)
            for ordinal in range(
                self.window.start_date.toordinal(),
                self.window.end_date.toordinal() + 1,
            )
        )
        if tuple(day.date for day in self.day_details) != expected_dates:
            raise ValueError("Break details must cover every inclusive date once")
        if self.charged_dates != tuple(day.date for day in self.day_details if day.charged):
            raise ValueError("Charged dates must match effective day details")
        if len(self.charged_dates) != self.window.vacation_days_used:
            raise ValueError("Break cost must match charged dates")
        return self


class AnnualAccounting(DomainValue):
    available_days: int
    reserve_days: int
    spendable_days: int
    total_leave_used: int
    remaining_days: int
    unallocated_days: int
    total_days_away: int
    charged_dates: tuple[date, ...]

    @model_validator(mode="after")
    def validate_pool(self) -> Self:
        if not 0 <= self.reserve_days <= self.available_days <= 366:
            raise ValueError("Invalid annual pool or reserve")
        if self.spendable_days != self.available_days - self.reserve_days:
            raise ValueError("Spendable days must exclude the reserve once")
        if self.charged_dates != tuple(sorted(set(self.charged_dates))):
            raise ValueError("Annual charged dates must be unique and ordered")
        if (
            self.total_leave_used != len(self.charged_dates)
            or self.total_leave_used > self.spendable_days
        ):
            raise ValueError("Annual leave must match charged dates and fit the spendable pool")
        if self.remaining_days != self.available_days - self.total_leave_used:
            raise ValueError("Remaining balance must deduct annual leave once")
        if self.unallocated_days != self.remaining_days - self.reserve_days:
            raise ValueError("Unallocated leave must exclude the reserve")
        return self


type PlanObjective = Literal["most_days_away", "fewer_leave_days", "different_dates"]


class AnnualPlan(DomainValue):
    plan_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    objective: PlanObjective = "most_days_away"
    fulfillment: Literal["full", "reduced"] = "full"
    retained_slot_ids: tuple[str, ...] = ()
    omitted_slot_ids: tuple[str, ...] = ()
    breaks: tuple[AnnualBreak, ...]
    accounting: AnnualAccounting

    @model_validator(mode="after")
    def validate_combination(self) -> Self:
        identifiers = tuple(item.slot_id for item in self.breaks)
        if not 1 <= len(identifiers) <= 6 or len(set(identifiers)) != len(identifiers):
            raise ValueError("A plan must fill one through six distinct slots")
        if set(self.retained_slot_ids) != set(identifiers) or set(self.omitted_slot_ids) & set(
            identifiers
        ):
            raise ValueError("Retained and omitted slots must match the selected breaks")
        if (self.fulfillment == "reduced") != bool(self.omitted_slot_ids):
            raise ValueError("Reduced plans must identify every omitted slot")
        remaining = self.accounting.available_days
        previous_end: date | None = None
        for item in self.breaks:
            if previous_end is not None and item.window.start_date <= previous_end:
                raise ValueError("Plan breaks must be ordered and nonoverlapping")
            remaining -= item.window.vacation_days_used
            if item.balance_after_break != remaining:
                raise ValueError("Running balance must follow chronological charged dates")
            previous_end = item.window.end_date
        charged = tuple(day for item in self.breaks for day in item.charged_dates)
        if charged != self.accounting.charged_dates:
            raise ValueError("Aggregate charged dates must match all selected breaks")
        if sum(item.window.total_days for item in self.breaks) != self.accounting.total_days_away:
            raise ValueError("Annual days away must count only selected breaks")
        return self


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


class MixBudgetConflict(DomainValue):
    code: Literal["mix_budget"] = "mix_budget"
    slot_ids: tuple[str, ...]
    required_days: int
    permitted_days: int


class MixConstraintsConflict(DomainValue):
    code: Literal["mix_constraints"] = "mix_constraints"
    slot_ids: tuple[str, ...]


type AnnualConflict = Annotated[
    LockedBudgetConflict
    | LockedUnavailableConflict
    | LockedOverlapConflict
    | LockedSpacingConflict
    | MixBudgetConflict
    | MixConstraintsConflict,
    Field(discriminator="code"),
]


class AnnualResult(DomainValue):
    input: AnnualRequest
    plans: tuple[AnnualPlan, ...] = Field(default=(), max_length=3)
    locked_assessments: tuple[AnnualBreak, ...] = ()
    conflicts: tuple[AnnualConflict, ...] = ()
    year_calendar: tuple[DayDetail, ...]
    policy: AnnualPolicy = DEFAULT_ANNUAL_POLICY
    counters: WorkCounters = WorkCounters()
    limit_reason: LimitReason | None = None

    @model_validator(mode="after")
    def validate_request_fulfillment(self) -> Self:
        requested = tuple(slot.slot_id for slot in self.input.slots)
        locked = {slot.slot_id: slot.locked_dates for slot in self.input.slots if slot.locked_dates}
        for plan in self.plans:
            retained = set(plan.retained_slot_ids)
            if plan.retained_slot_ids != tuple(slot for slot in requested if slot in retained):
                raise ValueError("Retained slots must follow original request order")
            if plan.omitted_slot_ids != tuple(slot for slot in requested if slot not in retained):
                raise ValueError("Omitted slots must complete the original request")
            if not locked.keys() <= retained:
                raise ValueError("Every plan must preserve locked slots")
            for item in plan.breaks:
                if item.locked != (item.slot_id in locked):
                    raise ValueError("Break lock state must match the original request")
                dates = locked.get(item.slot_id)
                if dates and (item.window.start_date, item.window.end_date) != (
                    dates.start_date,
                    dates.end_date,
                ):
                    raise ValueError("Locked dates must remain unchanged")
        return self


class CompleteAnnualResult(AnnualResult):
    status: Literal["complete"] = "complete"
    full_mix_feasibility: Literal["feasible"] = "feasible"
    plans: tuple[AnnualPlan, ...] = Field(min_length=1, max_length=3)
    conflicts: tuple[AnnualConflict, ...] = Field(default=(), max_length=0)

    @model_validator(mode="after")
    def require_full_plans(self) -> Self:
        if any(plan.fulfillment != "full" for plan in self.plans):
            raise ValueError("Complete outcomes require full plans")
        return self


class InfeasibleAnnualResult(AnnualResult):
    status: Literal["infeasible"] = "infeasible"
    full_mix_feasibility: Literal["infeasible"] = "infeasible"

    @model_validator(mode="after")
    def require_reduced_plans(self) -> Self:
        if any(plan.fulfillment != "reduced" for plan in self.plans):
            raise ValueError("Infeasible outcomes may contain only reduced plans")
        return self


class ConflictedAnnualResult(AnnualResult):
    status: Literal["conflict"] = "conflict"
    full_mix_feasibility: Literal["not_evaluated"] = "not_evaluated"
    plans: tuple[AnnualPlan, ...] = Field(default=(), max_length=0)
    conflicts: tuple[AnnualConflict, ...] = Field(min_length=1)


class IncompleteAnnualResult(AnnualResult):
    status: Literal["too_broad"] = "too_broad"
    full_mix_feasibility: Literal["unknown"] = "unknown"
    plans: tuple[AnnualPlan, ...] = Field(default=(), max_length=0)
    limit_reason: LimitReason


type AnnualOutcome = Annotated[
    CompleteAnnualResult | InfeasibleAnnualResult | ConflictedAnnualResult | IncompleteAnnualResult,
    Field(discriminator="status"),
]


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
        return IncompleteAnnualResult(
            input=request,
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
    if conflicts:
        return ConflictedAnnualResult(
            input=request,
            year_calendar=year_calendar,
            locked_assessments=breaks,
            conflicts=conflicts,
        )
    if all(slot.locked_dates is not None for slot in request.slots):
        return CompleteAnnualResult(
            input=request,
            year_calendar=year_calendar,
            locked_assessments=breaks,
            plans=(build_annual_plan(request, calendar, ()),),
        )
    graph = build_candidate_graph(request, calendar, year_calendar, breaks, budget)
    first = solve_annual_graph(graph, budget)
    infeasible = first is None
    mix_conflicts = (diagnose_full_mix(request, graph, budget),) if infeasible else ()
    if first is None:
        first = solve_annual_graph(graph, budget, allow_reduced=True)
    if first is None:
        return InfeasibleAnnualResult(
            input=request,
            year_calendar=year_calendar,
            locked_assessments=breaks,
            conflicts=mix_conflicts,
        )
    retained_mask = graph.locked_mask | sum(1 << index for index, _ in first)
    selections: list[Selection] = [first]
    plans = [build_annual_plan(request, calendar, first)]
    for objective in ("fewer_leave_days", "different_dates"):
        selection = solve_annual_graph(
            graph,
            budget,
            objective="fewer_leave_days" if objective == "fewer_leave_days" else "most_days_away",
            previous=tuple(selections),
            target_mask=retained_mask,
        )
        if selection is None:
            break
        selections.append(selection)
        plans.append(build_annual_plan(request, calendar, selection, objective))
    result_type = InfeasibleAnnualResult if infeasible else CompleteAnnualResult
    return result_type(
        input=request,
        year_calendar=year_calendar,
        locked_assessments=breaks,
        plans=tuple(plans),
        conflicts=mix_conflicts,
    )


def diagnose_full_mix(
    request: AnnualRequest,
    graph: CandidateGraph,
    budget: WorkBudget,
) -> MixBudgetConflict | MixConstraintsConflict:
    maximum_mix_leave = sum(slot.max_days for slot in request.slots)
    selection = solve_annual_graph(
        replace(graph, spendable=maximum_mix_leave), budget, objective="fewer_leave_days"
    )
    slot_ids = tuple(slot.slot_id for slot in request.slots)
    if selection is None:
        return MixConstraintsConflict(slot_ids=slot_ids)
    cost = graph.locked_cost + sum(candidate.leave_days for _, candidate in selection)
    return MixBudgetConflict(slot_ids=slot_ids, required_days=cost, permitted_days=graph.spendable)


def build_annual_plan(
    request: AnnualRequest,
    calendar: PreparedCalendar,
    selection: Selection,
    objective: PlanObjective = "most_days_away",
) -> AnnualPlan:
    breaks = assess_selection(request, calendar, selection)
    retained = {item.slot_id for item in breaks}
    omitted = tuple(slot.slot_id for slot in request.slots if slot.slot_id not in retained)
    return AnnualPlan(
        plan_id=annual_plan_identity(request, calendar, breaks),
        objective=objective,
        breaks=breaks,
        fulfillment="reduced" if omitted else "full",
        retained_slot_ids=tuple(slot.slot_id for slot in request.slots if slot.slot_id in retained),
        omitted_slot_ids=omitted,
        accounting=annual_accounting(breaks, calendar.context.balance_days, request.reserve_days),
    )


def annual_plan_identity(
    request: AnnualRequest,
    calendar: PreparedCalendar,
    breaks: tuple[AnnualBreak, ...],
) -> str:
    constraints = request.model_dump(mode="json", exclude={"slots"})
    constraints["slots"] = sorted(
        (slot.model_dump(mode="json", exclude={"slot_id"}) for slot in request.slots),
        key=lambda slot: json.dumps(slot, sort_keys=True),
    )
    payload = {
        "version": "annual-v1",
        "input": constraints,
        "context": calendar.context.model_dump(mode="json", exclude={"session_id"}),
        "holidays": sorted(day.isoformat() for day in calendar.base.observed_holidays),
        "breaks": [item.model_dump(mode="json", exclude={"slot_id"}) for item in breaks],
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


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
