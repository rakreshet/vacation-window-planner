"""Phase 0 domain contracts at their public validation boundary."""

from datetime import date
from uuid import UUID

import pytest
from pydantic import ValidationError

from vacation_window_planner.domain.contracts import (
    Feedback,
    FeedbackValue,
    HolidayCalendar,
    Recommendation,
    SearchConstraints,
    UserVacationContext,
    VacationWindow,
    WarningCode,
    YearMonth,
)


def test_context_defaults_to_zero_negative_allowance_and_is_immutable() -> None:
    context = UserVacationContext(
        session_id=UUID("00000000-0000-0000-0000-000000000001"),
        balance_days=3,
        country_code="IL",
        weekend_days=frozenset({4, 5}),
    )

    assert context.allowed_negative_days == 0
    with pytest.raises(ValidationError):
        context.balance_days = 4


@pytest.mark.parametrize("allowance", [-1, 6, 1.5, True, "1"])
def test_context_rejects_out_of_policy_or_fractional_negative_allowance(allowance: object) -> None:
    with pytest.raises(ValidationError):
        UserVacationContext(
            session_id=UUID("00000000-0000-0000-0000-000000000001"),
            balance_days=3,
            allowed_negative_days=allowance,
            country_code="IL",
            weekend_days=frozenset({4, 5}),
        )


def test_search_requires_explicit_valid_months_and_positive_whole_length() -> None:
    search = SearchConstraints(months=(YearMonth(year=2027, month=1),), preferred_length_days=9)
    assert search.result_limit == 5
    with pytest.raises(ValidationError):
        SearchConstraints(months=(), preferred_length_days=9)


def test_search_rejects_duplicate_selected_months() -> None:
    with pytest.raises(ValidationError):
        SearchConstraints(
            months=(YearMonth(year=2027, month=1), YearMonth(year=2027, month=1)),
            preferred_length_days=9,
        )


@pytest.mark.parametrize("length,limit", [(1.5, 5), (9, 0), (True, 5)])
def test_search_rejects_fractional_or_nonpositive_limits(length: object, limit: object) -> None:
    with pytest.raises(ValidationError):
        SearchConstraints(
            months=(YearMonth(year=2027, month=1),),
            preferred_length_days=length,
            result_limit=limit,
        )


def test_calendar_has_effective_weekends_and_observed_holidays() -> None:
    calendar = HolidayCalendar(
        country_code="IL",
        weekend_days=frozenset({4, 5}),
        observed_holidays=frozenset({date(2027, 1, 1)}),
    )
    assert date(2027, 1, 1) in calendar.observed_holidays
    with pytest.raises(ValidationError):
        HolidayCalendar(country_code="IL", weekend_days=frozenset({7}))


def test_window_length_is_inclusive_and_pto_cannot_exceed_length() -> None:
    window = VacationWindow(
        start_date=date(2027, 1, 1),
        end_date=date(2027, 1, 9),
        total_days=9,
        vacation_days_used=3,
        holiday_dates=frozenset({date(2027, 1, 4)}),
    )
    assert window.total_days == 9
    with pytest.raises(ValidationError):
        VacationWindow(
            start_date=date(2027, 1, 1),
            end_date=date(2027, 1, 9),
            total_days=8,
            vacation_days_used=3,
        )


@pytest.mark.parametrize(
    "start,end,total,used,holidays",
    [
        (date(2027, 1, 9), date(2027, 1, 1), 9, 3, frozenset()),
        (date(2027, 1, 1), date(2027, 1, 9), 9, 10, frozenset()),
        (date(2027, 1, 1), date(2027, 1, 9), 9, 3, frozenset({date(2027, 1, 10)})),
    ],
)
def test_window_rejects_inconsistent_dates_and_counts(
    start: date, end: date, total: int, used: int, holidays: frozenset[date]
) -> None:
    with pytest.raises(ValidationError):
        VacationWindow(
            start_date=start,
            end_date=end,
            total_days=total,
            vacation_days_used=used,
            holiday_dates=holidays,
        )


def test_recommendation_serializes_stable_score_and_warning_fields() -> None:
    recommendation = Recommendation(
        window=VacationWindow(
            start_date=date(2027, 1, 1),
            end_date=date(2027, 1, 9),
            total_days=9,
            vacation_days_used=3,
        ),
        rank=1,
        score=84,
        explanation="Nine days away for three vacation days.",
        remaining_balance=0,
        warnings=(WarningCode.FULL_BALANCE,),
    )

    assert recommendation.model_dump(mode="json") == {
        "window": {
            "start_date": "2027-01-01",
            "end_date": "2027-01-09",
            "total_days": 9,
            "vacation_days_used": 3,
            "holiday_dates": [],
        },
        "rank": 1,
        "score": 84,
        "explanation": "Nine days away for three vacation days.",
        "remaining_balance": 0,
        "warnings": ["full_balance"],
    }


def test_feedback_accepts_only_simple_thumbs_values() -> None:
    feedback = Feedback(
        session_id=UUID("00000000-0000-0000-0000-000000000001"),
        recommendation_id=UUID("00000000-0000-0000-0000-000000000002"),
        value=FeedbackValue.THUMBS_UP,
    )
    assert feedback.model_dump(mode="json")["value"] == "thumbs_up"
    with pytest.raises(ValidationError):
        Feedback(
            session_id=UUID("00000000-0000-0000-0000-000000000001"),
            recommendation_id=UUID("00000000-0000-0000-0000-000000000002"),
            value="maybe",
        )
