from datetime import date
from uuid import UUID

from vacation_window_planner.domain.annual import AnnualRequest, plan_year
from vacation_window_planner.domain.assessment import PreparedCalendar, prepare_calendar
from vacation_window_planner.domain.contracts import HolidayCalendar, UserVacationContext


def test_locked_break_uses_one_budget_and_preserves_the_reserve() -> None:
    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=18, country_code="IL", weekend_days={4, 5}
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
            "reserve_days": 3,
            "slots": [
                {
                    "slot_id": "august",
                    "min_days": 7,
                    "max_days": 14,
                    "locked_dates": {"start_date": "2027-08-06", "end_date": "2027-08-14"},
                }
            ],
        }
    )

    outcome = plan_year(request, calendar)

    assert outcome.status == "complete"
    plan = outcome.plans[0]
    assert plan.accounting.total_leave_used == 5
    assert plan.accounting.remaining_days == 13
    assert plan.accounting.reserve_days == 3
    assert plan.accounting.unallocated_days == 10
    assert plan.breaks[0].slot_id == "august"
    assert plan.breaks[0].charged_dates == tuple(date(2027, 8, day) for day in (8, 9, 10, 11, 12))
    assert plan.breaks[0].balance_after_break == 13


def prepared_annual_calendar(
    balance: int = 18,
    personal_calendar: dict[str, object] | None = None,
    today: date = date(2027, 1, 1),
) -> PreparedCalendar:
    context = UserVacationContext.model_validate(
        {
            "session_id": UUID(int=1),
            "balance_days": balance,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": personal_calendar or {},
        }
    )
    return prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days={4, 5}),
        context,
        (date(2027, 1, 1), date(2027, 12, 31)),
        today,
    )


def locked_slot(slot_id: str, start: str, end: str) -> dict[str, object]:
    length = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
    return {
        "slot_id": slot_id,
        "min_days": length,
        "max_days": length,
        "locked_dates": {"start_date": start, "end_date": end},
    }


def test_running_balance_follows_dates_instead_of_slot_priority() -> None:
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "reserve_days": 3,
            "slots": [
                locked_slot("august", "2027-08-06", "2027-08-14"),
                locked_slot("march", "2027-03-05", "2027-03-08"),
                locked_slot("may", "2027-05-07", "2027-05-10"),
            ],
        }
    )
    calendar = prepared_annual_calendar(
        personal_calendar={
            "date_overrides": [
                {"start_date": "2027-05-10", "end_date": "2027-05-10", "kind": "personal_day_off"},
            ]
        }
    )
    result = plan_year(request, calendar).plans[0]
    assert [(item.slot_id, item.balance_after_break) for item in result.breaks] == [
        ("march", 16),
        ("may", 15),
        ("august", 10),
    ]
    assert (
        result.accounting.total_days_away,
        result.accounting.total_leave_used,
        result.accounting.remaining_days,
        result.accounting.unallocated_days,
    ) == (17, 8, 10, 7)


def test_locked_cost_cannot_spend_the_reserve() -> None:
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "reserve_days": 3,
            "slots": [
                locked_slot("august", "2027-08-06", "2027-08-14"),
            ],
        }
    )
    result = plan_year(request, prepared_annual_calendar(balance=7))
    assert result.status == "conflict"
    assert result.plans == ()
    assert result.conflicts[0].code == "locked_budget"
    assert (result.conflicts[0].required_days, result.conflicts[0].permitted_days) == (5, 4)
    assert result.locked_assessments[0].window.vacation_days_used == 5


def test_lock_reports_unavailable_dates_even_when_nonworking() -> None:
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "slots": [
                locked_slot("august", "2027-08-06", "2027-08-14"),
            ],
        }
    )
    calendar = prepared_annual_calendar(
        personal_calendar={
            "unavailable_ranges": [
                {"start_date": "2027-08-07", "end_date": "2027-08-07"},
            ]
        }
    )
    result = plan_year(request, calendar)
    assert result.status == "conflict"
    assert result.conflicts[0].code == "locked_unavailable"
    assert result.conflicts[0].dates == (date(2027, 8, 7),)
    assert result.locked_assessments[0].window.vacation_days_used == 5


def test_overlapping_locks_are_retained_and_charged_dates_are_not_duplicated() -> None:
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "slots": [
                locked_slot("first", "2027-08-06", "2027-08-14"),
                locked_slot("second", "2027-08-12", "2027-08-16"),
            ],
        }
    )
    result = plan_year(request, prepared_annual_calendar())
    assert result.status == "conflict"
    assert result.conflicts[0].code == "locked_overlap"
    assert result.conflicts[0].slot_ids == ("first", "second")
    assert [item.balance_after_break for item in result.locked_assessments] == [13, 11]


def test_separate_breaks_need_both_calendar_spacing_and_a_working_date() -> None:
    for second_start, second_end, gap, expected in [
        ("2027-01-10", "2027-01-14", 0, "conflict"),
        ("2027-01-11", "2027-01-15", 0, "complete"),
        ("2027-01-14", "2027-01-18", 7, "conflict"),
        ("2027-01-15", "2027-01-19", 7, "complete"),
    ]:
        request = AnnualRequest.model_validate(
            {
                "year": 2027,
                "minimum_gap_days": gap,
                "slots": [
                    locked_slot("first", "2027-01-03", "2027-01-07"),
                    locked_slot("second", second_start, second_end),
                ],
            }
        )
        outcome = plan_year(request, prepared_annual_calendar())
        assert outcome.status == expected
        if expected == "conflict":
            assert outcome.conflicts[0].code == "locked_spacing"


def test_invalid_annual_fields_are_rejected_without_coercing_days() -> None:
    import pytest
    from pydantic import ValidationError

    valid = {"year": 2027, "slots": [locked_slot("august", "2027-08-06", "2027-08-14")]}
    invalid_fields = [
        {"reserve_days": True},
        {"reserve_days": 1.5},
        {"reserve_days": -1},
        {"minimum_gap_days": 61},
        {"minimum_gap_days": -1},
        {"year": True},
        {"allowed_start_months": [0]},
        {"allowed_start_months": [1, 1]},
        {"slots": []},
        {"slots": valid["slots"] * 7},
        {"slots": [locked_slot("same", "2027-08-06", "2027-08-14")] * 2},
        {"slots": [{"slot_id": "unlocked", "min_days": 1, "max_days": 3}]},
        {"slots": [{"slot_id": "unlocked", "min_days": 8, "max_days": 3}]},
        {"slots": [{"slot_id": "unlocked", "min_days": 3, "max_days": 29}]},
        {
            "slots": [{"slot_id": "unlocked", "min_days": 3, "max_days": 5}],
            "allowed_start_months": [],
        },
    ]
    for fields in invalid_fields:
        with pytest.raises(ValidationError):
            AnnualRequest.model_validate({**valid, **fields})


def test_annual_context_rejects_past_dates_cross_year_locks_and_invalid_pool() -> None:
    import pytest

    for year, start, end, balance, reserve in [
        (2026, "2026-08-06", "2026-08-14", 18, 0),
        (2030, "2030-08-06", "2030-08-14", 18, 0),
        (2027, "2026-12-30", "2027-01-03", 18, 0),
        (2027, "2027-12-30", "2028-01-03", 18, 0),
        (2027, "2027-01-01", "2027-01-04", 18, 0),
        (2027, "2027-08-06", "2027-08-14", 367, 0),
        (2027, "2027-08-06", "2027-08-14", -1, 0),
        (2027, "2027-08-06", "2027-08-14", 2, 3),
    ]:
        request = AnnualRequest.model_validate(
            {"year": year, "reserve_days": reserve, "slots": [locked_slot("trip", start, end)]}
        )
        with pytest.raises(ValueError):
            plan_year(request, prepared_annual_calendar(balance=balance, today=date(2027, 1, 2)))


def test_annual_planning_never_uses_a_negative_allowance() -> None:
    import dataclasses

    import pytest

    calendar = prepared_annual_calendar()
    calendar = dataclasses.replace(
        calendar, context=calendar.context.model_copy(update={"allowed_negative_days": 1})
    )
    request = AnnualRequest.model_validate(
        {"year": 2027, "slots": [locked_slot("trip", "2027-08-06", "2027-08-14")]}
    )
    with pytest.raises(ValueError, match="negative"):
        plan_year(request, calendar)


def test_arranged_lock_waives_notice_and_returns_the_common_year_calendar() -> None:
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "slots": [
                locked_slot("august", "2027-08-06", "2027-08-14"),
            ],
        }
    )
    calendar = prepared_annual_calendar(
        today=date(2027, 8, 1), personal_calendar={"minimum_notice_days": 10}
    )
    outcome = plan_year(request, calendar)
    assert outcome.status == "complete"
    assert outcome.plans[0].breaks[0].notice_waived is True
    assert len(outcome.year_calendar) == 365
    assert outcome.year_calendar[0].date == date(2027, 1, 1)
    assert outcome.year_calendar[-1].date == date(2027, 12, 31)


def test_all_lock_conflicts_have_stable_slot_and_code_order() -> None:
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "reserve_days": 3,
            "slots": [
                locked_slot("august", "2027-08-06", "2027-08-14"),
            ],
        }
    )
    calendar = prepared_annual_calendar(
        balance=7,
        personal_calendar={
            "unavailable_ranges": [
                {"start_date": "2027-08-07", "end_date": "2027-08-07"},
            ]
        },
    )
    assert [item.code for item in plan_year(request, calendar).conflicts] == [
        "locked_budget",
        "locked_unavailable",
    ]
