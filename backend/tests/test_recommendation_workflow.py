"""Recommendation workflow at its provider-independent public seam."""

from datetime import UTC, date, datetime
from uuid import UUID

import pytest

from vacation_window_planner.domain.calendar import FakeCalendarProvider
from vacation_window_planner.domain.contracts import (
    SearchConstraints,
    UserVacationContext,
    YearMonth,
)
from vacation_window_planner.domain.date_ranges import PastSearchRangeError
from vacation_window_planner.domain.generator import SearchTooBroadError
from vacation_window_planner.domain.policy import RecommendationPolicy
from vacation_window_planner.repositories.searches import RecommendationSnapshotInput
from vacation_window_planner.workflow import (
    RecommendationRequest,
    RecommendationWorkflow,
)

SESSION_ID = UUID("00000000-0000-0000-0000-000000000001")
SEARCH_ID = UUID("00000000-0000-0000-0000-000000000002")
NOW = datetime(2026, 9, 25, 12, tzinfo=UTC)


class FakeSnapshotWriter:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[dict[str, object]] = []

    def save_completed(
        self,
        *,
        session_id: UUID,
        engine_version: str,
        structured_input: dict[str, object],
        source_text: str | None,
        recommendations: tuple[RecommendationSnapshotInput, ...],
        created_at: datetime,
    ) -> UUID:
        if self.fail:
            raise RuntimeError("database unavailable")
        self.calls.append(
            {
                "session_id": session_id,
                "engine_version": engine_version,
                "structured_input": structured_input,
                "source_text": source_text,
                "recommendations": recommendations,
                "created_at": created_at,
            }
        )
        return SEARCH_ID


def request(
    *,
    month: YearMonth | None = None,
    balance: int = 10,
    weekend_days: frozenset[int] = frozenset({4, 5}),
) -> RecommendationRequest:
    return RecommendationRequest(
        context=UserVacationContext(
            session_id=SESSION_ID,
            balance_days=balance,
            country_code="IL",
            weekend_days=weekend_days,
        ),
        constraints=SearchConstraints(
            months=(month or YearMonth(year=2026, month=9),), preferred_length_days=5
        ),
        source_text="Five days in September",
    )


def workflow(writer: FakeSnapshotWriter, *, generation_cap: int = 5000) -> RecommendationWorkflow:
    return RecommendationWorkflow(
        calendar_provider=FakeCalendarProvider(),
        snapshot_writer=writer,
        policy=RecommendationPolicy(_env_file=None, generation_cap=generation_cap),
        clock=lambda: NOW,
    )


def test_success_composes_ranked_explained_and_persisted_results() -> None:
    writer = FakeSnapshotWriter()

    result = workflow(writer).recommend(request())

    assert result.search_id == SEARCH_ID
    assert result.notice == "Past start dates were excluded; search begins on 2026-09-25."
    assert len(result.recommendations) == 5
    assert [item.rank for item in result.recommendations] == [1, 2, 3, 4, 5]
    assert all(item.explanation for item in result.recommendations)
    assert writer.calls[0]["source_text"] == "Five days in September"
    assert writer.calls[0]["engine_version"] == "phase0-v1"


def test_equal_value_dates_share_one_rank_and_leave_room_for_distinct_outcomes() -> None:
    writer = FakeSnapshotWriter()
    search = RecommendationRequest(
        context=UserVacationContext(
            session_id=SESSION_ID,
            balance_days=6,
            allowed_negative_days=1,
            country_code="IL",
            weekend_days=frozenset({4, 5}),
        ),
        constraints=SearchConstraints(
            months=(YearMonth(year=2026, month=10),),
            preferred_length_days=9,
            result_limit=5,
        ),
    )

    result = workflow(writer).recommend(search)

    first = result.recommendations[0]
    assert first.window.start_date == date(2026, 10, 2)
    assert first.score == 72
    assert first.matching_window_count == 5
    assert [window.start_date for window in first.alternative_windows] == [
        date(2026, 10, 9),
        date(2026, 10, 16),
        date(2026, 10, 23),
        date(2026, 10, 30),
    ]
    assert len(result.recommendations) > 1
    assert len(
        {
            (item.window.total_days, item.window.vacation_days_used, item.score)
            for item in result.recommendations
        }
    ) == len(result.recommendations)
    assert first.score_breakdown is not None
    assert first.score_breakdown.leave_efficiency.points == 22.22
    assert first.score_breakdown.time_away.points == 30
    assert first.score_breakdown.length_fit.points == 20
    snapshots = writer.calls[0]["recommendations"]
    assert isinstance(snapshots, tuple)
    assert snapshots[0].rank == 1
    assert snapshots[0].result["matching_window_count"] == 5


def test_distinct_outcome_can_use_a_later_date_when_its_first_date_overlaps() -> None:
    search = RecommendationRequest(
        context=UserVacationContext(
            session_id=SESSION_ID,
            balance_days=6,
            allowed_negative_days=1,
            country_code="IL",
            weekend_days=frozenset({4, 5}),
        ),
        constraints=SearchConstraints(
            months=(YearMonth(year=2026, month=10), YearMonth(year=2026, month=11)),
            preferred_length_days=9,
            result_limit=5,
        ),
    )

    result = workflow(FakeSnapshotWriter()).recommend(search)

    assert len(result.recommendations) == 5
    distinct = next(item for item in result.recommendations if item.score == 68)
    assert distinct.window.start_date > date(2026, 10, 1)
    assert any(window.start_date == date(2026, 10, 1) for window in distinct.alternative_windows)


def test_matching_date_count_is_preserved_when_alternative_list_is_bounded() -> None:
    search = RecommendationRequest(
        context=UserVacationContext(
            session_id=SESSION_ID,
            balance_days=6,
            allowed_negative_days=1,
            country_code="IL",
            weekend_days=frozenset({4, 5}),
        ),
        constraints=SearchConstraints(
            months=(
                YearMonth(year=2026, month=10),
                YearMonth(year=2026, month=11),
                YearMonth(year=2026, month=12),
            ),
            preferred_length_days=9,
            result_limit=5,
        ),
    )

    first = workflow(FakeSnapshotWriter()).recommend(search).recommendations[0]

    assert first.matching_window_count == 13
    assert len(first.alternative_windows) == 12


def test_empty_candidate_set_is_persisted_without_results() -> None:
    writer = FakeSnapshotWriter()

    result = workflow(writer).recommend(request(balance=0, weekend_days=frozenset()))

    assert result.recommendations == ()
    assert writer.calls[0]["recommendations"] == ()


def test_fully_past_request_fails_before_persistence() -> None:
    writer = FakeSnapshotWriter()

    with pytest.raises(PastSearchRangeError):
        workflow(writer).recommend(request(month=YearMonth(year=2026, month=8)))

    assert writer.calls == []


def test_cap_hit_returns_coded_error_without_partial_results_or_persistence() -> None:
    writer = FakeSnapshotWriter()

    with pytest.raises(SearchTooBroadError) as raised:
        workflow(writer, generation_cap=1).recommend(request())

    assert raised.value.code == "SEARCH_TOO_BROAD"
    assert writer.calls == []


def test_persistence_failure_is_not_hidden() -> None:
    with pytest.raises(RuntimeError, match="database unavailable"):
        workflow(FakeSnapshotWriter(fail=True)).recommend(request())


def test_future_date_clipping_uses_the_effective_local_date() -> None:
    result = RecommendationWorkflow(
        calendar_provider=FakeCalendarProvider(),
        snapshot_writer=FakeSnapshotWriter(),
        policy=RecommendationPolicy(_env_file=None),
        clock=lambda: datetime(2026, 9, 25, 22, tzinfo=UTC),
    ).recommend(request())
    assert result.notice == "Past start dates were excluded; search begins on 2026-09-26."
    assert all(item.window.start_date >= date(2026, 9, 26) for item in result.recommendations)


def test_search_respects_unavailable_dates_in_saved_personal_context() -> None:
    from dataclasses import replace

    from vacation_window_planner.domain.personal_calendar import PersonalCalendar

    original = request()
    rules = PersonalCalendar.model_validate(
        {
            "unavailable_ranges": [
                {"start_date": "2026-09-25", "end_date": "2026-10-31"},
            ]
        }
    )
    personalized = replace(
        original, context=original.context.model_copy(update={"personal_calendar": rules})
    )
    result = workflow(FakeSnapshotWriter()).recommend(personalized)
    assert result.recommendations == ()


def test_search_returns_reproducible_sanitized_calculation_context() -> None:
    writer = FakeSnapshotWriter()
    result = workflow(writer).recommend(request())
    captured = result.calculation_context.model_dump(mode="json")
    assert captured["accounting_version"] == "phase075-v1"
    assert captured["local_today"] == "2026-09-25"
    assert captured["calculated_at"] == "2026-09-25T12:00:00Z"
    assert "session_id" not in captured["planning"]
    assert captured["planning"]["personal_calendar"]["minimum_notice_days"] == 0
    assert writer.calls[0]["structured_input"]["calculation_context"] == captured


def test_calendar_limit_is_a_typed_input_error() -> None:
    from vacation_window_planner.domain.assessment import CalendarCoverageError

    with pytest.raises(CalendarCoverageError):
        workflow(FakeSnapshotWriter()).recommend(request(month=YearMonth(year=9999, month=12)))


def test_requested_opportunities_preserve_explicit_results_and_are_snapshotted() -> None:
    from dataclasses import replace

    original = request()
    baseline = workflow(FakeSnapshotWriter()).recommend(original)
    writer = FakeSnapshotWriter()
    result = workflow(writer).recommend(replace(original, include_opportunities=True))
    assert result.recommendations == baseline.recommendations
    assert result.opportunities.status == "complete"
    assert result.opportunities.evaluated_pair_count == 9125
    assert writer.calls[0]["structured_input"]["opportunities"] == result.opportunities.model_dump(
        mode="json"
    )
    assert writer.calls[0]["structured_input"]["opportunity_calendar"] is not None


def test_supported_opportunity_calendar_failure_preserves_search_and_records_null_facts() -> None:
    from dataclasses import replace

    from vacation_window_planner.domain.calendar import CalendarResolutionUnavailable
    from vacation_window_planner.domain.contracts import HolidayCalendar

    class UnavailableOpportunityCalendar(FakeCalendarProvider):
        def resolve(
            self,
            country_code: str,
            start_date: date,
            end_date: date,
            weekend_override: frozenset[int] | None = None,
        ) -> HolidayCalendar:
            if end_date > date(2027, 1, 1):
                raise CalendarResolutionUnavailable("calendar unavailable")
            return super().resolve(country_code, start_date, end_date, weekend_override)

    writer = FakeSnapshotWriter()
    service = RecommendationWorkflow(
        calendar_provider=UnavailableOpportunityCalendar(),
        snapshot_writer=writer,
        policy=RecommendationPolicy(),
        clock=lambda: NOW,
    )
    result = service.recommend(replace(request(), include_opportunities=True))
    assert result.recommendations
    assert result.opportunities.status == "unavailable"
    assert result.opportunities.items == ()
    assert writer.calls[0]["structured_input"]["opportunity_calendar"] is None


def test_opportunity_cap_preserves_explicit_results_and_resolved_facts() -> None:
    from dataclasses import replace

    from vacation_window_planner.domain.opportunities import OpportunityPolicy

    writer = FakeSnapshotWriter()
    service = RecommendationWorkflow(
        calendar_provider=FakeCalendarProvider(),
        snapshot_writer=writer,
        policy=RecommendationPolicy(),
        clock=lambda: NOW,
        opportunity_policy=OpportunityPolicy(generation_cap=1),
    )
    result = service.recommend(replace(request(), include_opportunities=True))
    assert result.recommendations
    assert result.opportunities.status == "too_broad"
    assert not result.opportunities.items
    assert writer.calls[0]["structured_input"]["opportunity_calendar"] is not None


def test_action_details_cover_every_visible_exact_window() -> None:
    from dataclasses import replace

    result = workflow(FakeSnapshotWriter()).recommend(
        replace(request(), include_action_details=True)
    )
    for recommendation in result.recommendations:
        assert recommendation.assessment.window == recommendation.window
        assert recommendation.assessment.remaining_balance == recommendation.remaining_balance
        assert (
            tuple(detail.window for detail in recommendation.alternative_assessments)
            == recommendation.alternative_windows
        )
        assert all(
            len(detail.charged_dates) == detail.window.vacation_days_used
            for detail in recommendation.alternative_assessments
        )
