from datetime import date
from uuid import UUID

from vacation_window_planner.domain.annual import AnnualRequest, plan_year
from vacation_window_planner.domain.assessment import PreparedCalendar, prepare_calendar
from vacation_window_planner.domain.contracts import HolidayCalendar, UserVacationContext


def island_calendar(balance: int = 2) -> PreparedCalendar:
    context = UserVacationContext.model_validate(
        {
            "session_id": UUID(int=1),
            "balance_days": balance,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {
                "unavailable_ranges": [
                    {"start_date": "2027-01-04", "end_date": "2027-01-06"},
                    {"start_date": "2027-01-10", "end_date": "2027-01-19"},
                    {"start_date": "2027-01-24", "end_date": "2027-12-31"},
                ]
            },
        }
    )
    return prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days={4, 5}),
        context,
        (date(2027, 1, 1), date(2027, 12, 31)),
        date(2027, 1, 1),
    )


def island_request(count: int = 1) -> AnnualRequest:
    return AnnualRequest.model_validate(
        {
            "year": 2027,
            "allowed_start_months": [1],
            "minimum_gap_days": 0,
            "slots": [
                {"slot_id": f"short{index}", "min_days": 3, "max_days": 4} for index in range(count)
            ],
        }
    )


def test_full_alternatives_use_declared_objectives_and_materially_different_dates() -> None:
    result = plan_year(island_request(), island_calendar())
    assert len(result.plans) == 3
    assert [
        (plan.objective, plan.breaks[0].window.start_date, plan.accounting.total_leave_used)
        for plan in result.plans
    ] == [
        ("most_days_away", date(2027, 1, 20), 2),
        ("fewer_leave_days", date(2027, 1, 1), 1),
        ("different_dates", date(2027, 1, 7), 1),
    ]


def test_infeasible_mix_returns_maximum_reduced_mix_without_changing_request() -> None:
    request = island_request(count=2)
    result = plan_year(request, island_calendar(balance=1))
    assert result.status == "infeasible"
    assert len(result.plans) == 3
    for plan in result.plans:
        assert plan.fulfillment == "reduced"
        assert plan.retained_slot_ids == ("short0",)
        assert plan.omitted_slot_ids == ("short1",)
        assert plan.accounting.total_leave_used == 1
    assert result.plans[0].breaks[0].window.start_date == date(2027, 1, 1)
    assert len(request.slots) == 2


def test_budget_shortfall_is_reported_only_after_an_exact_full_mix_diagnostic() -> None:
    result = plan_year(island_request(count=2), island_calendar(balance=1))
    assert result.full_mix_feasibility == "infeasible"
    assert result.conflicts[0].code == "mix_budget"
    assert (result.conflicts[0].required_days, result.conflicts[0].permitted_days) == (2, 1)
    assert result.input == island_request(count=2)


def test_plan_identity_ignores_exchangeable_slot_assignments() -> None:
    request = island_request(count=2)
    original = plan_year(request, island_calendar())
    reordered = plan_year(
        request.model_copy(update={"slots": tuple(reversed(request.slots))}), island_calendar()
    )
    assert [plan.plan_id for plan in original.plans] == [plan.plan_id for plan in reordered.plans]
    assert len({plan.plan_id for plan in original.plans}) == len(original.plans)
    assert all(len(plan.plan_id) == 64 for plan in original.plans)


def test_wire_outcome_rejects_full_plans_presented_as_reduced_and_broken_accounting() -> None:
    import pytest
    from pydantic import TypeAdapter, ValidationError

    from vacation_window_planner.domain.annual import AnnualOutcome

    adapter = TypeAdapter(AnnualOutcome)
    result = plan_year(island_request(), island_calendar())
    assert adapter.validate_json(result.model_dump_json()) == result
    incorrect = result.model_dump(mode="json")
    incorrect["status"] = "infeasible"
    incorrect["full_mix_feasibility"] = "infeasible"
    with pytest.raises(ValidationError):
        adapter.validate_python(incorrect)
    incorrect = result.model_dump(mode="json")
    incorrect["plans"][0]["accounting"]["remaining_days"] = 99
    with pytest.raises(ValidationError):
        adapter.validate_python(incorrect)


def test_reduction_preserves_locks_and_can_return_only_the_arranged_break() -> None:
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "minimum_gap_days": 0,
            "allowed_start_months": [1],
            "slots": [
                {
                    "slot_id": "arranged",
                    "min_days": 3,
                    "max_days": 3,
                    "locked_dates": {"start_date": "2027-01-01", "end_date": "2027-01-03"},
                },
                {"slot_id": "extra", "min_days": 3, "max_days": 4},
            ],
        }
    )
    result = plan_year(request, island_calendar(balance=1))
    assert result.status == "infeasible"
    assert len(result.plans) == 1
    assert result.plans[0].omitted_slot_ids == ("extra",)
    assert result.plans[0].breaks[0].locked
    assert result.plans[0].breaks[0].window.start_date == date(2027, 1, 1)


def test_reduction_maximizes_filled_count_before_slot_priority() -> None:
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "minimum_gap_days": 0,
            "allowed_start_months": [1],
            "slots": [
                {"slot_id": "long", "min_days": 4, "max_days": 4},
                {"slot_id": "short1", "min_days": 3, "max_days": 3},
                {"slot_id": "short2", "min_days": 3, "max_days": 3},
            ],
        }
    )
    result = plan_year(request, island_calendar())
    assert result.status == "infeasible"
    assert result.plans[0].retained_slot_ids == ("short1", "short2")
    assert result.plans[0].omitted_slot_ids == ("long",)


def test_structural_conflict_does_not_invent_a_budget_shortfall() -> None:
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "minimum_gap_days": 0,
            "allowed_start_months": [1],
            "slots": [
                {"slot_id": "first", "min_days": 4, "max_days": 4},
                {"slot_id": "second", "min_days": 4, "max_days": 4},
            ],
        }
    )
    result = plan_year(request, island_calendar(balance=366))
    assert result.status == "infeasible"
    assert result.conflicts[0].code == "mix_constraints"


def test_later_objective_limit_discards_all_partial_plans() -> None:
    from vacation_window_planner.domain.annual import AnnualPolicy

    result = plan_year(
        island_request(), island_calendar(), policy=AnnualPolicy(transition_limit=400)
    )
    assert result.status == "too_broad"
    assert result.full_mix_feasibility == "unknown"
    assert result.plans == ()
    assert result.counters.candidates == 62
    assert result.counters.transitions == 401


def test_outcome_rejects_slot_metadata_that_does_not_match_the_original_request() -> None:
    import pytest
    from pydantic import TypeAdapter, ValidationError

    from vacation_window_planner.domain.annual import AnnualOutcome

    result = plan_year(island_request(), island_calendar())
    incorrect = result.model_dump(mode="json")
    incorrect["input"]["slots"][0]["slot_id"] = "another"
    with pytest.raises(ValidationError):
        TypeAdapter(AnnualOutcome).validate_python(incorrect)
