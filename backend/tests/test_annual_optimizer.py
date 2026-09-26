from datetime import date, timedelta
from random import Random
from uuid import UUID

from annual_oracle import exhaustive_plan

from vacation_window_planner.domain.annual import AnnualRequest, plan_year
from vacation_window_planner.domain.assessment import prepare_calendar
from vacation_window_planner.domain.contracts import HolidayCalendar, UserVacationContext


def test_optimizer_matches_independent_exhaustive_combinations_on_small_calendars() -> None:
    random = Random(20270926)
    first, final = date(2027, 1, 1), date(2027, 1, 12)
    for case in range(40):
        budget = random.randrange(0, 7)
        weekends = {4, 5} if case % 2 else {5, 6}
        days = [first + timedelta(days=offset) for offset in range(12)]
        holidays = {day for day in days if random.random() < 0.2}
        unavailable = {day for day in days if random.random() < 0.15}
        working = {day for day in days if day.weekday() not in weekends and day not in holidays}
        context = UserVacationContext.model_validate(
            {
                "session_id": UUID(int=1),
                "balance_days": budget,
                "country_code": "IL",
                "weekend_days": weekends,
                "personal_calendar": {
                    "unavailable_ranges": [
                        {"start_date": day, "end_date": day} for day in sorted(unavailable)
                    ]
                    + [{"start_date": "2027-01-13", "end_date": "2027-12-31"}]
                },
            }
        )
        calendar = prepare_calendar(
            HolidayCalendar(country_code="IL", weekend_days=weekends, observed_holidays=holidays),
            context,
            (first, date(2027, 12, 31)),
            first,
        )
        request = AnnualRequest.model_validate(
            {
                "year": 2027,
                "reserve_days": min(budget, case % 2),
                "minimum_gap_days": case % 3,
                "allowed_start_months": [1],
                "slots": [
                    {"slot_id": f"slot{index}", "min_days": 3, "max_days": 3 + (case + index) % 3}
                    for index in range(1 + case % 3)
                ],
            }
        )
        expected = exhaustive_plan(
            request, working, unavailable, budget - request.reserve_days, first, final
        )
        result = plan_year(request, calendar)
        if expected is None:
            assert result.status == "infeasible", case
            assert not result.plans
        else:
            assert result.status == "complete", case
            actual = tuple(
                (item.window.start_date, item.window.end_date) for item in result.plans[0].breaks
            )
            assert actual == expected, case
            assert result.plans[0].accounting.remaining_days >= request.reserve_days


def test_generated_zero_leave_break_can_end_on_the_last_day_of_the_year() -> None:
    context = UserVacationContext.model_validate(
        {
            "session_id": UUID(int=1),
            "balance_days": 0,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {
                "date_overrides": [
                    {
                        "start_date": "2027-12-29",
                        "end_date": "2027-12-31",
                        "kind": "personal_day_off",
                    },
                ],
                "minimum_notice_days": 2,
            },
        }
    )
    calendar = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days={4, 5}),
        context,
        (date(2027, 1, 1), date(2027, 12, 31)),
        date(2027, 12, 27),
    )
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "allowed_start_months": [12],
            "slots": [
                {"slot_id": "year_end", "min_days": 3, "max_days": 5},
            ],
        }
    )
    result = plan_year(request, calendar)
    assert result.status == "complete"
    selected = result.plans[0].breaks[0]
    assert (selected.window.start_date, selected.window.end_date) == (
        date(2027, 12, 29),
        date(2027, 12, 31),
    )
    assert result.plans[0].accounting.total_leave_used == 0
    assert result.counters.candidates == 1


def test_deadline_includes_final_locked_assessment_and_result_construction() -> None:
    from vacation_window_planner.domain.annual import WorkBudget

    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=5, country_code="IL", weekend_days={4, 5}
    )
    calendar = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days={4, 5}),
        context,
        (date(2027, 1, 1), date(2027, 12, 31)),
        date(2027, 1, 1),
    )
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "slots": [
                {
                    "slot_id": "fixed",
                    "min_days": 3,
                    "max_days": 3,
                    "locked_dates": {"start_date": "2027-01-01", "end_date": "2027-01-03"},
                },
            ],
        }
    )
    times = iter([0.0, 0.0, 6.0])
    result = plan_year(request, calendar, work_budget=WorkBudget(clock=lambda: next(times)))
    assert result.status == "too_broad"
    assert result.plans == ()


def test_calendar_facts_must_match_the_submitted_common_context() -> None:
    import pytest

    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=5, country_code="IL", weekend_days={4, 5}
    )
    calendar = prepare_calendar(
        HolidayCalendar(country_code="US", weekend_days={5, 6}),
        context,
        (date(2027, 1, 1), date(2027, 12, 31)),
        date(2027, 1, 1),
    )
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "slots": [
                {"slot_id": "short", "min_days": 3, "max_days": 3},
            ],
        }
    )
    with pytest.raises(ValueError, match="calendar"):
        plan_year(request, calendar)


def test_equal_objectives_compare_all_dates_before_slot_assignments() -> None:
    context = UserVacationContext.model_validate(
        {
            "session_id": UUID(int=1),
            "balance_days": 8,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {
                "unavailable_ranges": [
                    {"start_date": "2027-01-21", "end_date": "2027-12-31"},
                ]
            },
        }
    )
    calendar = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days={4, 5}),
        context,
        (date(2027, 1, 1), date(2027, 12, 31)),
        date(2027, 1, 1),
    )
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "minimum_gap_days": 0,
            "allowed_start_months": [1],
            "slots": [
                {"slot_id": "long", "min_days": 4, "max_days": 6},
                {"slot_id": "short1", "min_days": 4, "max_days": 5},
                {"slot_id": "short2", "min_days": 4, "max_days": 5},
            ],
        }
    )
    plan = plan_year(request, calendar).plans[0]
    assert [(item.window.start_date, item.window.end_date) for item in plan.breaks] == [
        (date(2027, 1, 1), date(2027, 1, 4)),
        (date(2027, 1, 6), date(2027, 1, 9)),
        (date(2027, 1, 11), date(2027, 1, 16)),
    ]
    assert (plan.accounting.total_days_away, plan.accounting.total_leave_used) == (14, 8)
