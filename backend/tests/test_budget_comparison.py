from datetime import date
from uuid import UUID

from vacation_window_planner.domain.annual import AnnualRequest
from vacation_window_planner.domain.assessment import prepare_calendar
from vacation_window_planner.domain.contracts import HolidayCalendar, UserVacationContext


def may_request() -> AnnualRequest:
    return AnnualRequest.model_validate(
        {
            "year": 2027,
            "allowed_start_months": [5],
            "slots": [{"slot_id": "break", "min_days": 3, "max_days": 14}],
        }
    )


def may_calendar(balance: int = 4):
    context = UserVacationContext(
        session_id=UUID(int=1),
        balance_days=balance,
        country_code="GB",
        weekend_days={5, 6},
        time_zone="Europe/London",
    )
    base = HolidayCalendar(
        country_code="GB",
        weekend_days={5, 6},
        observed_holidays={date(2027, 5, 3)},
    )
    return prepare_calendar(
        base, context, (date(2027, 1, 1), date(2027, 12, 31)), date(2026, 10, 3)
    )


def test_one_more_leave_day_unlocks_the_next_weekend_without_changing_the_request() -> None:
    from vacation_window_planner.domain.budget_comparison import compare_annual_budgets

    request = may_request()
    calendar = may_calendar()
    result = compare_annual_budgets(request, calendar)
    assert [
        (
            scenario.available_days,
            scenario.outcome.plans[0].accounting.total_days_away,
            scenario.outcome.plans[0].breaks[0].window.start_date,
            scenario.outcome.plans[0].breaks[0].window.end_date,
        )
        for scenario in result.scenarios
    ] == [
        (3, 6, date(2027, 5, 1), date(2027, 5, 6)),
        (4, 9, date(2027, 5, 1), date(2027, 5, 9)),
        (5, 10, date(2027, 5, 1), date(2027, 5, 10)),
    ]
    assert all(scenario.outcome.input == request for scenario in result.scenarios)
    assert calendar.context.balance_days == 4


def test_budget_comparison_returns_only_the_primary_plan_and_preserves_normal_alternatives() -> (
    None
):
    from vacation_window_planner.domain.annual import plan_year
    from vacation_window_planner.domain.budget_comparison import compare_annual_budgets

    ordinary = plan_year(may_request(), may_calendar())
    comparison = compare_annual_budgets(may_request(), may_calendar())
    assert all(len(scenario.outcome.plans) == 1 for scenario in comparison.scenarios)
    assert comparison.scenarios[1].outcome.plans[0] == ordinary.plans[0]
    assert len(ordinary.plans) > 1


def test_budget_neighbors_stay_within_the_balance_and_reserve_bounds() -> None:
    from vacation_window_planner.domain.budget_comparison import compare_annual_budgets

    zero = compare_annual_budgets(may_request(), may_calendar(0))
    maximum = compare_annual_budgets(may_request(), may_calendar(366))
    reserved = compare_annual_budgets(
        may_request().model_copy(update={"reserve_days": 4}), may_calendar()
    )
    assert [scenario.available_days for scenario in zero.scenarios] == [0, 1]
    assert [scenario.available_days for scenario in maximum.scenarios] == [365, 366]
    assert [scenario.available_days for scenario in reserved.scenarios] == [4, 5]


def test_an_invalid_baseline_cannot_be_replaced_by_a_valid_neighbor() -> None:
    import pytest

    from vacation_window_planner.domain.annual import AnnualInputError
    from vacation_window_planner.domain.budget_comparison import compare_annual_budgets

    with pytest.raises(AnnualInputError, match="Reserve cannot exceed"):
        compare_annual_budgets(may_request().model_copy(update={"reserve_days": 5}), may_calendar())


def test_locked_dates_and_reserve_stay_fixed_when_a_lower_budget_cannot_afford_them() -> None:
    from vacation_window_planner.domain.budget_comparison import compare_annual_budgets

    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "reserve_days": 1,
            "slots": [
                {
                    "slot_id": "arranged",
                    "min_days": 9,
                    "max_days": 9,
                    "locked_dates": {"start_date": "2027-05-01", "end_date": "2027-05-09"},
                }
            ],
        }
    )
    result = compare_annual_budgets(request, may_calendar(5))
    assert [scenario.outcome.status for scenario in result.scenarios] == [
        "conflict",
        "complete",
        "complete",
    ]
    assert result.scenarios[0].outcome.conflicts[0].code == "locked_budget"
    for scenario in result.scenarios[1:]:
        plan = scenario.outcome.plans[0]
        assert plan.breaks[0].window.start_date == date(2027, 5, 1)
        assert plan.breaks[0].window.end_date == date(2027, 5, 9)
        assert plan.accounting.total_leave_used == 4
        assert plan.accounting.reserve_days == 1


def test_comparison_checks_baseline_first_and_keeps_it_when_shared_candidate_work_runs_out() -> (
    None
):
    from vacation_window_planner.domain.annual_budget import AnnualPolicy
    from vacation_window_planner.domain.budget_comparison import compare_annual_budgets

    result = compare_annual_budgets(
        may_request(), may_calendar(), policy=AnnualPolicy(candidate_limit=372)
    )
    assert [scenario.outcome.status for scenario in result.scenarios] == [
        "too_broad",
        "complete",
        "too_broad",
    ]
    assert result.scenarios[1].outcome.plans[0].accounting.total_days_away == 9
    for scenario in (result.scenarios[0], result.scenarios[2]):
        assert scenario.outcome.plans == ()
        assert scenario.outcome.full_mix_feasibility == "unknown"
        assert scenario.outcome.limit_reason == "candidate_limit"


def test_insufficient_budget_is_a_labeled_reduction_and_more_budget_can_have_no_benefit() -> None:
    from vacation_window_planner.domain.budget_comparison import compare_annual_budgets

    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "allowed_start_months": [5],
            "slots": [
                {"slot_id": "first", "min_days": 3, "max_days": 3},
                {"slot_id": "second", "min_days": 3, "max_days": 3},
            ],
        }
    )
    result = compare_annual_budgets(request, may_calendar(1))
    lower, baseline, upper = result.scenarios
    assert lower.outcome.status == "infeasible"
    assert lower.outcome.plans[0].fulfillment == "reduced"
    assert lower.outcome.plans[0].omitted_slot_ids == ("second",)
    assert baseline.outcome.status == upper.outcome.status == "complete"
    assert baseline.outcome.plans[0].accounting.total_days_away == 6
    assert upper.outcome.plans[0].accounting.total_days_away == 6
    assert lower.outcome.input == baseline.outcome.input == upper.outcome.input == request
    assert (
        lower.outcome.year_calendar == baseline.outcome.year_calendar == upper.outcome.year_calendar
    )
