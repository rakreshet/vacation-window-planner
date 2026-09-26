from datetime import date

import pytest

from vacation_window_planner.domain.contracts import VacationWindow
from vacation_window_planner.domain.opportunities import OpportunityPolicy, score_opportunity


@pytest.mark.parametrize(
    "total,cost,raw,display",
    [
        (9, 3, 64.2857142857, 64),
        (7, 5, 41.1428571429, 41),
        (4, 0, 75, 75),
    ],
)
def test_opportunity_score_matches_the_product_examples(
    total: int, cost: int, raw: float, display: int
) -> None:
    window = VacationWindow(
        start_date=date(2027, 1, 1),
        end_date=date(2027, 1, total),
        total_days=total,
        vacation_days_used=cost,
    )
    score = score_opportunity(window, OpportunityPolicy())
    assert score.raw_points == pytest.approx(raw)
    assert score.score == display
    assert sum(component.points for component in score.score_breakdown.values()) == pytest.approx(
        raw
    )


@pytest.mark.parametrize(
    "settings",
    [
        {"efficiency_weight": 0.8},
        {"horizon_days": 366},
        {"minimum_length_days": 2},
        {"minimum_length_days": 10, "maximum_length_days": 9},
        {"result_limit": 6},
        {"generation_cap": 20001},
        {"threshold": 101},
        {"near_duplicate_overlap": 0},
    ],
)
def test_opportunity_policy_rejects_invalid_bounds(settings: dict[str, object]) -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        OpportunityPolicy(**settings)


def test_scan_completes_all_pairs_and_returns_a_grounded_outside_search_opportunity() -> None:
    from uuid import UUID

    from vacation_window_planner.domain.assessment import prepare_calendar
    from vacation_window_planner.domain.contracts import (
        HolidayCalendar,
        SearchConstraints,
        UserVacationContext,
        YearMonth,
    )
    from vacation_window_planner.domain.opportunities import detect_opportunities

    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=0, country_code="IL", weekend_days=frozenset(range(7))
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=context.weekend_days),
        context,
        (date(2027, 1, 1), date(2027, 3, 1)),
        date(2027, 1, 1),
    )
    result = detect_opportunities(
        prepared,
        SearchConstraints(months=(YearMonth(year=2027, month=2),), preferred_length_days=5),
        (),
        search_length_tolerance=2,
        policy=OpportunityPolicy(horizon_days=30, result_limit=1),
    )
    assert result.status == "complete"
    assert result.evaluated_pair_count == 750
    assert result.items[0].window.start_date == date(2027, 1, 1)
    assert result.items[0].window.total_days == 28
    assert result.items[0].score == 100
    assert result.items[0].assessment.charged_dates == ()
    assert [difference.code for difference in result.items[0].criteria_differences] == [
        "start_month_outside_selection",
        "length_outside_tolerance",
    ]


def test_scan_cap_counts_ineligible_pairs_and_never_returns_partial_results() -> None:
    from uuid import UUID

    from vacation_window_planner.domain.assessment import prepare_calendar
    from vacation_window_planner.domain.contracts import (
        HolidayCalendar,
        SearchConstraints,
        UserVacationContext,
        YearMonth,
    )
    from vacation_window_planner.domain.opportunities import detect_opportunities

    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=0, country_code="IL", weekend_days=frozenset()
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=frozenset()),
        context,
        (date(2027, 1, 1), date(2027, 3, 1)),
        date(2027, 1, 1),
    )
    result = detect_opportunities(
        prepared,
        SearchConstraints(months=(YearMonth(year=2027, month=2),), preferred_length_days=5),
        (),
        search_length_tolerance=2,
        policy=OpportunityPolicy(horizon_days=30, generation_cap=10),
    )
    assert result.status == "too_broad"
    assert result.items == ()
    assert result.evaluated_pair_count == 11


def test_scan_suppresses_near_duplicates_of_explicit_and_selected_windows() -> None:
    from uuid import UUID

    from vacation_window_planner.domain.assessment import prepare_calendar
    from vacation_window_planner.domain.contracts import (
        HolidayCalendar,
        SearchConstraints,
        UserVacationContext,
        YearMonth,
    )
    from vacation_window_planner.domain.opportunities import detect_opportunities

    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=0, country_code="IL", weekend_days=frozenset(range(7))
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=context.weekend_days),
        context,
        (date(2027, 1, 1), date(2027, 3, 1)),
        date(2027, 1, 1),
    )
    explicit = VacationWindow(
        start_date=date(2027, 1, 1), end_date=date(2027, 1, 28), total_days=28, vacation_days_used=0
    )
    result = detect_opportunities(
        prepared,
        SearchConstraints(months=(YearMonth(year=2027, month=2),), preferred_length_days=5),
        (explicit,),
        search_length_tolerance=2,
        policy=OpportunityPolicy(horizon_days=30),
    )
    assert [item.window.start_date for item in result.items] == [
        date(2027, 1, 7),
        date(2027, 1, 13),
        date(2027, 1, 19),
    ]


def test_scan_reports_calendar_overflow_as_typed_validation() -> None:
    from uuid import UUID

    from vacation_window_planner.domain.assessment import CalendarCoverageError, prepare_calendar
    from vacation_window_planner.domain.contracts import (
        HolidayCalendar,
        SearchConstraints,
        UserVacationContext,
        YearMonth,
    )
    from vacation_window_planner.domain.opportunities import detect_opportunities

    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=0, country_code="IL", weekend_days=frozenset(range(7))
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=context.weekend_days),
        context,
        (date(9999, 12, 1), date.max),
        date(9999, 12, 1),
    )
    with pytest.raises(CalendarCoverageError):
        detect_opportunities(
            prepared,
            SearchConstraints(months=(YearMonth(year=9999, month=12),), preferred_length_days=5),
            (),
            search_length_tolerance=2,
            policy=OpportunityPolicy(horizon_days=30),
        )


def test_threshold_changes_do_not_change_opportunity_scores() -> None:
    window = VacationWindow(
        start_date=date(2027, 1, 1), end_date=date(2027, 1, 9), total_days=9, vacation_days_used=3
    )
    assert score_opportunity(window, OpportunityPolicy(threshold=0)) == score_opportunity(
        window, OpportunityPolicy(threshold=100)
    )


def test_undisclosed_windows_inside_full_search_tolerance_are_excluded() -> None:
    from uuid import UUID

    from vacation_window_planner.domain.assessment import prepare_calendar
    from vacation_window_planner.domain.contracts import (
        HolidayCalendar,
        SearchConstraints,
        UserVacationContext,
        YearMonth,
    )
    from vacation_window_planner.domain.opportunities import detect_opportunities

    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=0, country_code="IL", weekend_days=frozenset(range(7))
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=context.weekend_days),
        context,
        (date(2027, 1, 1), date(2027, 3, 1)),
        date(2027, 1, 1),
    )
    result = detect_opportunities(
        prepared,
        SearchConstraints(months=(YearMonth(year=2027, month=1),), preferred_length_days=5),
        (),
        search_length_tolerance=2,
        policy=OpportunityPolicy(horizon_days=30, maximum_length_days=7),
    )
    assert result.status == "complete"
    assert result.items == ()
    assert result.evaluated_pair_count == 120


def test_default_scan_completes_9125_pairs_with_no_ordinary_weekends() -> None:
    from uuid import UUID

    from vacation_window_planner.domain.assessment import prepare_calendar
    from vacation_window_planner.domain.contracts import (
        HolidayCalendar,
        SearchConstraints,
        UserVacationContext,
        YearMonth,
    )
    from vacation_window_planner.domain.opportunities import detect_opportunities

    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=0, country_code="IL", weekend_days=frozenset({4, 5})
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=context.weekend_days),
        context,
        (date(2027, 1, 1), date(2028, 1, 27)),
        date(2027, 1, 1),
    )
    result = detect_opportunities(
        prepared,
        SearchConstraints(months=(YearMonth(year=2027, month=1),), preferred_length_days=5),
        (),
        search_length_tolerance=2,
        policy=OpportunityPolicy(),
    )
    assert result.status == "complete"
    assert result.items == ()
    assert result.evaluated_pair_count == 9125


@pytest.mark.parametrize("notice,expected_pairs", [(29, 25), (30, 0)])
def test_notice_does_not_extend_horizon_and_unavailability_applies_to_free_breaks(
    notice: int, expected_pairs: int
) -> None:
    from uuid import UUID

    from vacation_window_planner.domain.assessment import prepare_calendar
    from vacation_window_planner.domain.contracts import (
        HolidayCalendar,
        SearchConstraints,
        UserVacationContext,
        YearMonth,
    )
    from vacation_window_planner.domain.opportunities import detect_opportunities
    from vacation_window_planner.domain.personal_calendar import PersonalCalendar

    rules = PersonalCalendar.model_validate(
        {
            "minimum_notice_days": notice,
            "unavailable_ranges": [
                {"start_date": "2027-01-30", "end_date": "2027-01-30"},
            ],
        }
    )
    context = UserVacationContext(
        session_id=UUID(int=1),
        balance_days=0,
        country_code="IL",
        weekend_days=frozenset(range(7)),
        personal_calendar=rules,
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=context.weekend_days),
        context,
        (date(2027, 1, 1), date(2027, 3, 1)),
        date(2027, 1, 1),
    )
    result = detect_opportunities(
        prepared,
        SearchConstraints(months=(YearMonth(year=2027, month=2),), preferred_length_days=5),
        (),
        search_length_tolerance=2,
        policy=OpportunityPolicy(horizon_days=30),
    )
    assert result.items == ()
    assert result.evaluated_pair_count == expected_pairs
    assert result.start_horizon.end_date == date(2027, 1, 30)
