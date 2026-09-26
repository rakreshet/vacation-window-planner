from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from math import isclose
from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from vacation_window_planner.domain.assessment import (
    CalendarCoverageError,
    PreparedCalendar,
    WindowAssessment,
    assess_window,
)
from vacation_window_planner.domain.contracts import (
    DomainValue,
    ScoreComponent,
    SearchConstraints,
    VacationWindow,
    YearMonth,
)


class OpportunityPolicy(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OPPORTUNITY_", extra="forbid", frozen=True)

    version: Literal["phase075-opportunity-v1"] = "phase075-opportunity-v1"
    horizon_days: int = Field(default=365, ge=30, le=365)
    minimum_length_days: int = Field(default=4, ge=3, le=28)
    maximum_length_days: int = Field(default=28, ge=3, le=28)
    result_limit: int = Field(default=3, ge=1, le=5)
    generation_cap: int = Field(default=12000, ge=1, le=20000)
    threshold: float = Field(default=60, ge=0, le=100)
    near_duplicate_overlap: float = Field(default=0.80, gt=0, le=1)
    efficiency_weight: float = Field(default=0.50, ge=0)
    length_weight: float = Field(default=0.35, ge=0)
    low_leave_weight: float = Field(default=0.15, ge=0)
    efficiency_saturation: float = Field(default=5, gt=0)
    length_saturation: float = Field(default=14, gt=0)
    leave_cost_saturation: float = Field(default=14, gt=0)

    @model_validator(mode="after")
    def validate_weights(self) -> Self:
        if not isclose(
            self.efficiency_weight + self.length_weight + self.low_leave_weight, 1, abs_tol=1e-9
        ):
            raise ValueError("opportunity weights must sum to one")
        if self.minimum_length_days > self.maximum_length_days:
            raise ValueError("minimum opportunity length must not exceed maximum")
        return self


class OpportunityScore(DomainValue):
    score: int
    raw_points: float
    score_breakdown: dict[Literal["efficiency", "length", "low_leave_use"], ScoreComponent]


def score_opportunity(window: VacationWindow, policy: OpportunityPolicy) -> OpportunityScore:
    efficiency = (
        min(window.total_days / window.vacation_days_used, policy.efficiency_saturation)
        / policy.efficiency_saturation
        if window.vacation_days_used
        else 1
    )
    length = min(window.total_days / policy.length_saturation, 1)
    low_leave_use = 1 - min(window.vacation_days_used / policy.leave_cost_saturation, 1)
    components: dict[Literal["efficiency", "length", "low_leave_use"], ScoreComponent] = {
        "efficiency": ScoreComponent(
            points=100 * policy.efficiency_weight * efficiency,
            max_points=100 * policy.efficiency_weight,
        ),
        "length": ScoreComponent(
            points=100 * policy.length_weight * length, max_points=100 * policy.length_weight
        ),
        "low_leave_use": ScoreComponent(
            points=100 * policy.low_leave_weight * low_leave_use,
            max_points=100 * policy.low_leave_weight,
        ),
    }
    raw_points = sum(component.points for component in components.values())
    display_score = int(Decimal(str(raw_points)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return OpportunityScore(score=display_score, raw_points=raw_points, score_breakdown=components)


class OutsideSelectedMonths(DomainValue):
    code: Literal["start_month_outside_selection"] = "start_month_outside_selection"
    actual_month: YearMonth


class OutsideLengthTolerance(DomainValue):
    code: Literal["length_outside_tolerance"] = "length_outside_tolerance"
    actual_days: int
    minimum_days: int
    maximum_days: int


type CriteriaDifference = OutsideSelectedMonths | OutsideLengthTolerance


class OpportunityItem(OpportunityScore):
    opportunity_id: str
    window: VacationWindow
    assessment: WindowAssessment
    explanation: str
    criteria_differences: tuple[CriteriaDifference, ...]


class OpportunityHorizon(DomainValue):
    start_date: date
    end_date: date


class OpportunityResult(DomainValue):
    status: Literal["complete", "too_broad", "unavailable"]
    items: tuple[OpportunityItem, ...] = ()
    policy: OpportunityPolicy
    start_horizon: OpportunityHorizon
    evaluated_pair_count: int


def criteria_differences(
    window: VacationWindow, constraints: SearchConstraints, tolerance: int
) -> tuple[CriteriaDifference, ...]:
    differences: list[CriteriaDifference] = []
    start_month = YearMonth(year=window.start_date.year, month=window.start_date.month)
    if start_month not in constraints.months:
        differences.append(OutsideSelectedMonths(actual_month=start_month))
    minimum = max(1, constraints.preferred_length_days - tolerance)
    maximum = constraints.preferred_length_days + tolerance
    if not minimum <= window.total_days <= maximum:
        differences.append(
            OutsideLengthTolerance(
                actual_days=window.total_days, minimum_days=minimum, maximum_days=maximum
            )
        )
    return tuple(differences)


def build_opportunity(
    window: VacationWindow,
    prepared: PreparedCalendar,
    score: OpportunityScore,
    differences: tuple[CriteriaDifference, ...],
    policy: OpportunityPolicy,
) -> OpportunityItem:
    explanation = f"{window.total_days} days off using {window.vacation_days_used} vacation days."
    if any(isinstance(difference, OutsideSelectedMonths) for difference in differences):
        explanation += " Starts outside your selected months."
    if any(isinstance(difference, OutsideLengthTolerance) for difference in differences):
        explanation += " Length is outside your Search flexibility."
    return OpportunityItem(
        **score.model_dump(),
        window=window,
        opportunity_id=f"{policy.version}:{window.start_date}:{window.end_date}",
        assessment=assess_window(window.start_date, window.end_date, prepared),
        explanation=explanation,
        criteria_differences=differences,
    )


@dataclass(frozen=True)
class OpportunityCandidate:
    window: VacationWindow
    score: OpportunityScore
    differences: tuple[CriteriaDifference, ...]


def opportunity_rank(candidate: OpportunityCandidate) -> tuple[float, int, int, date, date]:
    return (
        -candidate.score.raw_points,
        -candidate.window.total_days,
        candidate.window.vacation_days_used,
        candidate.window.start_date,
        candidate.window.end_date,
    )


def select_distinct_opportunities(
    candidates: list[OpportunityCandidate],
    explicit_windows: tuple[VacationWindow, ...],
    prepared: PreparedCalendar,
    policy: OpportunityPolicy,
) -> tuple[OpportunityItem, ...]:
    selected: list[OpportunityItem] = []
    for candidate in sorted(candidates, key=opportunity_rank):
        previous_windows = (*explicit_windows, *(item.window for item in selected))
        if any(
            near_duplicate(candidate.window, previous, policy.near_duplicate_overlap)
            for previous in previous_windows
        ):
            continue
        selected.append(
            build_opportunity(
                candidate.window, prepared, candidate.score, candidate.differences, policy
            )
        )
        if len(selected) == policy.result_limit:
            break
    return tuple(selected)


def detect_opportunities(
    prepared: PreparedCalendar,
    constraints: SearchConstraints,
    explicit_windows: tuple[VacationWindow, ...],
    *,
    search_length_tolerance: int,
    policy: OpportunityPolicy,
) -> OpportunityResult:
    horizon, _ = opportunity_coverage(prepared.local_today, policy)
    candidates: list[OpportunityCandidate] = []
    evaluated_pair_count = 0
    for start_ordinal in range(
        max(horizon.start_date, prepared.earliest_start_date).toordinal(),
        horizon.end_date.toordinal() + 1,
    ):
        start = date.fromordinal(start_ordinal)
        for length in range(policy.minimum_length_days, policy.maximum_length_days + 1):
            evaluated_pair_count += 1
            if evaluated_pair_count > policy.generation_cap:
                return OpportunityResult(
                    status="too_broad",
                    policy=policy,
                    start_horizon=horizon,
                    evaluated_pair_count=evaluated_pair_count,
                )
            assessment = assess_window(
                start, start + timedelta(days=length - 1), prepared, detail="summary"
            )
            if not assessment.eligible:
                continue
            differences = criteria_differences(
                assessment.window, constraints, search_length_tolerance
            )
            score = score_opportunity(assessment.window, policy)
            if differences and score.raw_points >= policy.threshold:
                candidates.append(OpportunityCandidate(assessment.window, score, differences))
    return OpportunityResult(
        status="complete",
        policy=policy,
        start_horizon=horizon,
        evaluated_pair_count=evaluated_pair_count,
        items=select_distinct_opportunities(candidates, explicit_windows, prepared, policy),
    )


def near_duplicate(window: VacationWindow, previous: VacationWindow, threshold: float) -> bool:
    intersection_days = max(
        0,
        (min(window.end_date, previous.end_date) - max(window.start_date, previous.start_date)).days
        + 1,
    )
    return intersection_days / min(window.total_days, previous.total_days) >= threshold


def opportunity_coverage(today: date, policy: OpportunityPolicy) -> tuple[OpportunityHorizon, date]:
    try:
        horizon_end = today + timedelta(days=policy.horizon_days - 1)
        coverage_end = horizon_end + timedelta(days=policy.maximum_length_days - 1)
    except OverflowError as error:
        raise CalendarCoverageError("Opportunity horizon exceeds the supported calendar") from error
    return OpportunityHorizon(start_date=today, end_date=horizon_end), coverage_end
