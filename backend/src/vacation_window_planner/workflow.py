"""Phase 0 recommendation orchestration without HTTP concerns."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol
from uuid import UUID

from vacation_window_planner.domain.action_details import attach_action_details
from vacation_window_planner.domain.assessment import CalendarCoverageError, prepare_calendar
from vacation_window_planner.domain.calculation_context import CalculationContext, capture_context
from vacation_window_planner.domain.calendar import CalendarProvider
from vacation_window_planner.domain.contracts import (
    Recommendation,
    SearchConstraints,
    UserVacationContext,
    VacationWindow,
)
from vacation_window_planner.domain.date_ranges import normalize_selected_months
from vacation_window_planner.domain.diversity import select_diverse_window_groups
from vacation_window_planner.domain.explanations import (
    DeterministicExplanationFormatter,
    ExplanationFormatter,
)
from vacation_window_planner.domain.generator import generate_vacation_windows
from vacation_window_planner.domain.local_dates import local_today
from vacation_window_planner.domain.opportunities import OpportunityPolicy, OpportunityResult
from vacation_window_planner.domain.policy import RecommendationPolicy
from vacation_window_planner.domain.scoring import score_vacation_windows
from vacation_window_planner.opportunity_workflow import scan_opportunities
from vacation_window_planner.repositories.searches import RecommendationSnapshotInput


class SnapshotWriter(Protocol):
    def save_completed(
        self,
        *,
        session_id: UUID,
        engine_version: str,
        structured_input: dict[str, object],
        source_text: str | None,
        recommendations: tuple[RecommendationSnapshotInput, ...],
        created_at: datetime,
    ) -> UUID: ...


@dataclass(frozen=True)
class RecommendationRequest:
    context: UserVacationContext
    constraints: SearchConstraints
    source_text: str | None = None
    include_opportunities: bool = False
    include_action_details: bool = False


@dataclass(frozen=True)
class RecommendationResult:
    search_id: UUID
    recommendations: tuple[Recommendation, ...]
    notice: str | None = None
    calculation_context: CalculationContext | None = None
    opportunities: OpportunityResult | None = None


class RecommendationWorkflow:
    def __init__(
        self,
        *,
        calendar_provider: CalendarProvider,
        snapshot_writer: SnapshotWriter,
        policy: RecommendationPolicy,
        clock: Callable[[], datetime],
        explanation_formatter: ExplanationFormatter | None = None,
        opportunity_policy: OpportunityPolicy | None = None,
    ) -> None:
        self._opportunity_policy = opportunity_policy or OpportunityPolicy()
        self._calendar_provider = calendar_provider
        self._snapshot_writer = snapshot_writer
        self._policy = policy
        self._clock = clock
        self._explanation_formatter = explanation_formatter or DeterministicExplanationFormatter()

    def recommend(self, request: RecommendationRequest) -> RecommendationResult:
        now = self._clock()
        today = local_today(now, request.context.time_zone)
        normalized = normalize_selected_months(request.constraints.months, today)
        calendar_start = normalized.start_dates[0].start_date
        latest_start = normalized.start_dates[-1].end_date
        maximum_length = (
            request.constraints.preferred_length_days + self._policy.length_tolerance_days
        )
        try:
            calendar_end = latest_start + timedelta(days=maximum_length - 1)
        except OverflowError as error:
            raise CalendarCoverageError("Search dates exceed the supported calendar") from error
        calendar = self._calendar_provider.resolve(
            request.context.country_code,
            calendar_start,
            calendar_end,
            weekend_override=request.context.weekend_days,
        )
        windows = generate_vacation_windows(
            context=request.context,
            constraints=request.constraints,
            start_dates=normalized.start_dates,
            calendar=calendar,
            generation_cap=self._policy.generation_cap,
            length_tolerance_days=self._policy.length_tolerance_days,
            today=today,
        )
        recommendation_tuple = self._rank_recommendations(windows, request)
        if request.include_action_details:
            prepared = prepare_calendar(
                calendar, request.context, (calendar_start, calendar_end), today
            )
            recommendation_tuple = attach_action_details(recommendation_tuple, prepared)
        calculation_context = capture_context(request.context, now, today)
        structured_input: dict[str, object] = {
            "context": request.context.model_dump(mode="json"),
            "calculation_context": calculation_context.model_dump(mode="json"),
            "constraints": request.constraints.model_dump(mode="json"),
            "policy": self._policy.model_dump(mode="json"),
            "calendar": calendar.model_dump(mode="json"),
            "clipping_notice": normalized.notice,
            "local_today": today.isoformat(),
            "coverage": {
                "start_date": calendar_start.isoformat(),
                "end_date": calendar_end.isoformat(),
            },
        }
        opportunities = None
        if request.include_opportunities:
            explicit_windows = tuple(
                window
                for recommendation in recommendation_tuple
                for window in (recommendation.window, *recommendation.alternative_windows)
            )
            scan = scan_opportunities(
                self._calendar_provider,
                request.context,
                request.constraints,
                explicit_windows,
                today,
                self._policy.length_tolerance_days,
                self._opportunity_policy,
            )
            opportunities = scan.result
            structured_input["opportunities"] = opportunities.model_dump(mode="json")
            structured_input["opportunity_calendar"] = (
                scan.calendar.model_dump(mode="json") if scan.calendar else None
            )
            structured_input["opportunity_coverage"] = {
                "start_date": today.isoformat(),
                "end_date": scan.coverage_end.isoformat(),
            }
        snapshot_recommendations = tuple(
            RecommendationSnapshotInput(
                rank=item.rank,
                result=item.model_dump(mode="json"),
                warnings=tuple(warning.value for warning in item.warnings),
            )
            for item in recommendation_tuple
        )
        search_id = self._snapshot_writer.save_completed(
            session_id=request.context.session_id,
            engine_version=self._policy.engine_version,
            structured_input=structured_input,
            source_text=request.source_text,
            recommendations=snapshot_recommendations,
            created_at=now,
        )
        return RecommendationResult(
            search_id=search_id,
            recommendations=recommendation_tuple,
            notice=normalized.notice,
            calculation_context=calculation_context,
            opportunities=opportunities,
        )

    def _rank_recommendations(
        self,
        windows: tuple[VacationWindow, ...],
        request: RecommendationRequest,
    ) -> tuple[Recommendation, ...]:
        scored = score_vacation_windows(
            windows,
            context=request.context,
            constraints=request.constraints,
            policy=self._policy,
        )
        selected = select_diverse_window_groups(
            scored,
            result_limit=request.constraints.result_limit,
            near_duplicate_overlap_ratio=self._policy.near_duplicate_overlap_ratio,
            material_score_gap=self._policy.material_score_gap,
        )
        recommendations: list[Recommendation] = []
        previous_score: int | None = None
        for rank, group in enumerate(selected, start=1):
            item = group.representative
            recommendations.append(
                Recommendation(
                    window=item.window,
                    rank=rank,
                    score=item.score,
                    explanation=self._explanation_formatter.explain(item, previous_score),
                    remaining_balance=item.facts.remaining_balance,
                    warnings=item.warnings,
                    alternative_windows=group.alternative_windows,
                    matching_window_count=group.matching_window_count,
                    score_breakdown=item.score_breakdown,
                )
            )
            previous_score = item.score

        return tuple(recommendations)
