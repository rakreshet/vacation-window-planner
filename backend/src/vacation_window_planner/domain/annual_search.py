from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import TYPE_CHECKING

from vacation_window_planner.domain.annual_budget import WorkBudget
from vacation_window_planner.domain.assessment import DayDetail, PreparedCalendar, assess_window

if TYPE_CHECKING:
    from vacation_window_planner.domain.annual import AnnualBreak, AnnualRequest


@dataclass(frozen=True)
class AnnualCandidate:
    start_date: date
    end_date: date
    leave_days: int
    slot_mask: int

    @property
    def total_days(self) -> int:
        return (self.end_date - self.start_date).days + 1


def annual_candidates(
    request: AnnualRequest,
    calendar: PreparedCalendar,
    budget: WorkBudget,
) -> tuple[AnnualCandidate, ...]:
    lengths = sorted(
        {
            length
            for slot in request.slots
            if slot.locked_dates is None
            for length in range(slot.min_days, slot.max_days + 1)
        }
    )
    first = max(date(request.year, 1, 1), calendar.earliest_start_date)
    final = date(request.year, 12, 31)
    candidates: list[AnnualCandidate] = []
    for ordinal in range(first.toordinal(), final.toordinal() + 1):
        start = date.fromordinal(ordinal)
        if start.month not in request.allowed_start_months:
            continue
        for length in lengths:
            if ordinal + length - 1 > final.toordinal():
                continue
            budget.candidate()
            end = start + timedelta(days=length - 1)
            assessment = assess_window(start, end, calendar, detail="summary")
            if any(reason.code == "unavailable_dates" for reason in assessment.eligibility_reasons):
                continue
            mask = sum(
                1 << index
                for index, slot in enumerate(request.slots)
                if slot.locked_dates is None and slot.min_days <= length <= slot.max_days
            )
            candidates.append(
                AnnualCandidate(start, end, assessment.window.vacation_days_used, mask)
            )
    return tuple(candidates)


type Selection = tuple[tuple[int, AnnualCandidate], ...]
type StateKey = tuple[int, int]


@dataclass(frozen=True)
class PlanPrefix:
    total_days: int = 0
    selection: Selection = ()

    @property
    def dates(self) -> tuple[tuple[date, date, int], ...]:
        return tuple((item.start_date, item.end_date, slot) for slot, item in self.selection)


def keep_prefix(
    states: dict[StateKey, PlanPrefix], key: StateKey, prefix: PlanPrefix, budget: WorkBudget
) -> None:
    previous = states.get(key)
    if previous is None:
        budget.state()
    if previous is None or (-prefix.total_days, prefix.dates) < (
        -previous.total_days,
        previous.dates,
    ):
        states[key] = prefix


def next_start_indices(days: tuple[DayDetail, ...], gap: int) -> tuple[int, ...]:
    starts: list[int] = []
    for end in range(len(days)):
        first_working = next(
            (index for index in range(end + 1, len(days)) if days[index].charged), len(days)
        )
        starts.append(min(len(days), max(end + gap + 1, first_working + 1)))
    return tuple(starts)


@dataclass(frozen=True)
class CandidateGraph:
    by_start: tuple[tuple[AnnualCandidate, ...], ...]
    successors: tuple[int, ...]
    first_ordinal: int
    slot_count: int
    locked_mask: int
    locked_cost: int
    spendable: int

    @property
    def complete_mask(self) -> int:
        return (1 << self.slot_count) - 1


def build_candidate_graph(
    request: AnnualRequest,
    calendar: PreparedCalendar,
    days: tuple[DayDetail, ...],
    locked: tuple[AnnualBreak, ...],
    budget: WorkBudget,
) -> CandidateGraph:
    first_ordinal = date(request.year, 1, 1).toordinal()
    by_start: list[list[AnnualCandidate]] = [[] for _ in days]
    for candidate in annual_candidates(request, calendar, budget):
        if compatible_with_locks(candidate, locked, days, request.minimum_gap_days):
            by_start[candidate.start_date.toordinal() - first_ordinal].append(candidate)
    return CandidateGraph(
        by_start=tuple(tuple(items) for items in by_start),
        successors=next_start_indices(days, request.minimum_gap_days),
        first_ordinal=first_ordinal,
        slot_count=len(request.slots),
        locked_mask=sum(
            1 << index for index, slot in enumerate(request.slots) if slot.locked_dates
        ),
        locked_cost=sum(item.window.vacation_days_used for item in locked),
        spendable=calendar.context.balance_days - request.reserve_days,
    )


def select_annual_breaks(
    request: AnnualRequest,
    calendar: PreparedCalendar,
    days: tuple[DayDetail, ...],
    locked: tuple[AnnualBreak, ...],
    budget: WorkBudget,
) -> Selection | None:
    graph = build_candidate_graph(request, calendar, days, locked, budget)
    return solve_annual_graph(graph, budget)


def solve_annual_graph(graph: CandidateGraph, budget: WorkBudget) -> Selection | None:
    states: list[dict[StateKey, PlanPrefix]] = [{} for _ in range(len(graph.by_start) + 1)]
    budget.state()
    states[0][(graph.locked_mask, graph.locked_cost)] = PlanPrefix()
    best: tuple[int, int, tuple[tuple[date, date, int], ...]] | None = None
    selected: Selection | None = None
    for cursor, current in enumerate(states):
        for key, prefix in current.items():
            filled, spent = key
            if filled == graph.complete_mask:
                rank = (-prefix.total_days, spent, prefix.dates)
                if best is None or rank < best:
                    best, selected = rank, prefix.selection
            elif cursor < len(graph.by_start):
                advance_prefix(graph, states, cursor, key, prefix, budget)
        current.clear()
    return selected


def advance_prefix(
    graph: CandidateGraph,
    states: list[dict[StateKey, PlanPrefix]],
    cursor: int,
    key: StateKey,
    prefix: PlanPrefix,
    budget: WorkBudget,
) -> None:
    filled, spent = key
    budget.transition()
    keep_prefix(states[cursor + 1], key, prefix, budget)
    for candidate in graph.by_start[cursor]:
        budget.transition()
        if spent + candidate.leave_days > graph.spendable:
            continue
        for slot in range(graph.slot_count):
            budget.transition()
            bit = 1 << slot
            if filled & bit or not candidate.slot_mask & bit:
                continue
            updated = PlanPrefix(
                prefix.total_days + candidate.total_days, prefix.selection + ((slot, candidate),)
            )
            next_cursor = graph.successors[candidate.end_date.toordinal() - graph.first_ordinal]
            keep_prefix(
                states[next_cursor], (filled | bit, spent + candidate.leave_days), updated, budget
            )


def compatible_with_locks(
    candidate: AnnualCandidate,
    locked: tuple[AnnualBreak, ...],
    days: tuple[DayDetail, ...],
    minimum_gap: int,
) -> bool:
    for item in locked:
        left_end, right_start = (
            (candidate.end_date, item.window.start_date)
            if candidate.start_date < item.window.start_date
            else (item.window.end_date, candidate.start_date)
        )
        if (right_start - left_end).days - 1 < minimum_gap:
            return False
        if not any(day.charged and left_end < day.date < right_start for day in days):
            return False
    return True
