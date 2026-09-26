from datetime import date
from uuid import UUID

import pytest

from vacation_window_planner.domain.assessment import assess_window, prepare_calendar
from vacation_window_planner.domain.contracts import HolidayCalendar, UserVacationContext


def test_personal_days_and_extra_work_override_the_base_calendar() -> None:
    context = UserVacationContext.model_validate(
        {
            "session_id": str(UUID(int=1)),
            "balance_days": 8,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {
                "date_overrides": [
                    {
                        "start_date": "2027-01-07",
                        "end_date": "2027-01-07",
                        "kind": "personal_day_off",
                    },
                    {
                        "start_date": "2027-01-08",
                        "end_date": "2027-01-08",
                        "kind": "extra_working_day",
                    },
                ]
            },
        }
    )
    calendar = HolidayCalendar(country_code="IL", weekend_days=frozenset({4, 5}))
    prepared = prepare_calendar(
        calendar, context, (date(2027, 1, 1), date(2027, 1, 9)), date(2027, 1, 1)
    )
    result = assess_window(date(2027, 1, 1), date(2027, 1, 9), prepared, detail="days")
    assert result.charged_dates == tuple(date(2027, 1, d) for d in (3, 4, 5, 6, 8))
    assert result.remaining_balance == 3
    assert result.eligible
    assert result.day_details[7].kind == "extra_working_day"
    assert result.day_details[7].is_weekend


def test_ineligible_baseline_keeps_cost_and_all_reasons() -> None:
    context = UserVacationContext.model_validate(
        {
            "session_id": str(UUID(int=1)),
            "balance_days": 2,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {
                "unavailable_ranges": [{"start_date": "2027-01-02", "end_date": "2027-01-02"}],
                "minimum_notice_days": 7,
            },
        }
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=frozenset({4, 5})),
        context,
        (date(2027, 1, 1), date(2027, 1, 9)),
        date(2027, 1, 1),
    )
    result = assess_window(date(2027, 1, 1), date(2027, 1, 9), prepared, detail="days")
    assert result.window.vacation_days_used == 5
    assert not result.eligible
    assert [reason.model_dump(mode="json") for reason in result.eligibility_reasons] == [
        {"code": "unavailable_dates", "dates": ["2027-01-02"]},
        {"code": "insufficient_notice", "earliest_start_date": "2027-01-08"},
        {"code": "over_budget", "required_days": 5, "permitted_days": 2},
    ]
    assert result.day_details[1].unavailable
    assert not result.day_details[1].charged


def test_summary_matches_details_and_keeps_balance_warnings_when_blocked() -> None:
    context = UserVacationContext.model_validate(
        {
            "session_id": str(UUID(int=1)),
            "balance_days": 4,
            "allowed_negative_days": 1,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {
                "unavailable_ranges": [{"start_date": "2027-01-02", "end_date": "2027-01-02"}],
            },
        }
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=frozenset({4, 5})),
        context,
        (date(2027, 1, 1), date(2027, 1, 9)),
        date(2027, 1, 1),
    )
    detailed = assess_window(date(2027, 1, 1), date(2027, 1, 9), prepared, detail="days")
    summary = assess_window(date(2027, 1, 1), date(2027, 1, 9), prepared, detail="summary")
    assert summary.model_dump() == detailed.model_dump(exclude={"charged_dates", "day_details"})
    assert summary.warnings == ("negative_balance",)
    assert [r.code for r in summary.eligibility_reasons] == ["unavailable_dates"]


@pytest.mark.parametrize(
    "start,end",
    [
        (date(2026, 12, 31), date(2027, 1, 2)),
        (date(2027, 1, 9), date(2027, 1, 10)),
        (date(2027, 1, 2), date(2027, 1, 1)),
    ],
)
def test_assessment_rejects_windows_outside_explicit_coverage(start: date, end: date) -> None:
    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=8, country_code="IL", weekend_days=frozenset({4, 5})
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=context.weekend_days),
        context,
        (date(2027, 1, 1), date(2027, 1, 9)),
        date(2027, 1, 1),
    )
    with pytest.raises(ValueError, match="coverage|precede"):
        assess_window(start, end, prepared)


def test_preparation_reports_notice_date_overflow() -> None:
    context = UserVacationContext.model_validate(
        {
            "session_id": str(UUID(int=1)),
            "balance_days": 8,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {"minimum_notice_days": 1},
        }
    )
    with pytest.raises(ValueError, match="notice"):
        prepare_calendar(
            HolidayCalendar(country_code="IL", weekend_days=context.weekend_days),
            context,
            (date.max, date.max),
            date.max,
        )


@pytest.mark.parametrize(
    "start,end,cost,warning",
    [
        (date(2027, 1, 7), date(2027, 1, 7), 1, ("full_balance",)),
        (date(2027, 1, 8), date(2027, 1, 9), 0, ()),
    ],
)
def test_notice_boundary_applies_to_zero_leave_windows(
    start: date,
    end: date,
    cost: int,
    warning: tuple[str, ...],
) -> None:
    context = UserVacationContext.model_validate(
        {
            "session_id": str(UUID(int=1)),
            "balance_days": 1,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {"minimum_notice_days": 7},
        }
    )
    prepared = prepare_calendar(
        HolidayCalendar(country_code="IL", weekend_days=context.weekend_days),
        context,
        (date(2027, 1, 1), date(2027, 1, 9)),
        date(2027, 1, 1),
    )
    result = assess_window(start, end, prepared)
    assert result.window.vacation_days_used == cost
    assert result.warnings == warning
    assert result.eligible == (start == date(2027, 1, 8))


def test_extra_work_on_holiday_preserves_provider_fact_and_charges_once() -> None:
    day = date(2027, 1, 8)
    context = UserVacationContext.model_validate(
        {
            "session_id": str(UUID(int=1)),
            "balance_days": 8,
            "country_code": "IL",
            "weekend_days": [4, 5],
            "personal_calendar": {
                "date_overrides": [
                    {"start_date": day, "end_date": day, "kind": "extra_working_day"},
                ]
            },
        }
    )
    calendar = HolidayCalendar(
        country_code="IL", weekend_days=context.weekend_days, observed_holidays=frozenset({day})
    )
    result = assess_window(day, day, prepare_calendar(calendar, context, (day, day), day))
    assert result.window.vacation_days_used == 1
    assert result.window.holiday_dates == frozenset({day})
    assert result.day_details[0].model_dump() == {
        "date": day,
        "charged": True,
        "kind": "extra_working_day",
        "is_public_holiday": True,
        "is_weekend": True,
        "unavailable": False,
    }


def test_last_supported_date_does_not_require_next_day_arithmetic() -> None:
    context = UserVacationContext(
        session_id=UUID(int=1), balance_days=1, country_code="IL", weekend_days=frozenset()
    )
    calendar = HolidayCalendar(country_code="IL", weekend_days=frozenset())
    result = assess_window(
        date.max, date.max, prepare_calendar(calendar, context, (date.max, date.max), date.max)
    )
    assert result.charged_dates == (date.max,)
    assert result.warnings == ("full_balance",)
