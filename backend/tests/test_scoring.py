"""Deterministic scoring through its public domain seam."""

from datetime import date
from uuid import UUID

from vacation_window_planner.domain.contracts import (
    SearchConstraints,
    UserVacationContext,
    VacationWindow,
    WarningCode,
    YearMonth,
)
from vacation_window_planner.domain.policy import RecommendationPolicy
from vacation_window_planner.domain.scoring import score_vacation_windows


def context(balance: int, allowed_negative: int = 0) -> UserVacationContext:
    return UserVacationContext(
        session_id=UUID("00000000-0000-0000-0000-000000000001"),
        balance_days=balance,
        allowed_negative_days=allowed_negative,
        country_code="IL",
        weekend_days=frozenset({4, 5}),
    )


def constraints(length: int = 5) -> SearchConstraints:
    return SearchConstraints(months=(YearMonth(year=2027, month=1),), preferred_length_days=length)


def window(start_day: int, total: int, used: int) -> VacationWindow:
    start = date(2027, 1, start_day)
    return VacationWindow(
        start_date=start,
        end_date=date.fromordinal(start.toordinal() + total - 1),
        total_days=total,
        vacation_days_used=used,
    )


def policy() -> RecommendationPolicy:
    return RecommendationPolicy(_env_file=None)


def test_score_contains_normalized_grounded_facts() -> None:
    scored = score_vacation_windows(
        (window(3, 5, 2),), context=context(7), constraints=constraints(), policy=policy()
    )[0]

    assert scored.score == 80
    assert scored.facts.efficiency == 0.6
    assert scored.facts.duration == 5
    assert scored.facts.length_deviation == 0
    assert scored.facts.remaining_balance == 5


def test_zero_pto_exact_length_has_finite_maximum_score() -> None:
    scored = score_vacation_windows(
        (window(3, 5, 0),), context=context(0), constraints=constraints(), policy=policy()
    )[0]

    assert scored.score == 100
    assert scored.facts.efficiency == 1.0
    assert WarningCode.FULL_BALANCE in scored.warnings


def test_rank_order_is_score_descending_with_stable_date_ties() -> None:
    scored = score_vacation_windows(
        (window(10, 5, 3), window(2, 5, 1), window(1, 5, 1)),
        context=context(10),
        constraints=constraints(),
        policy=policy(),
    )

    assert [item.window.start_date for item in scored] == [
        date(2027, 1, 1),
        date(2027, 1, 2),
        date(2027, 1, 10),
    ]


def test_length_relaxation_is_scored_and_warned() -> None:
    scored = score_vacation_windows(
        (window(3, 4, 1),), context=context(7), constraints=constraints(), policy=policy()
    )[0]

    assert scored.score == 78
    assert scored.facts.length_deviation == -1
    assert scored.warnings == (WarningCode.LENGTH_RELAXED,)


def test_balance_does_not_change_score_but_full_balance_is_warned() -> None:
    candidate = window(3, 5, 2)
    full_balance = score_vacation_windows(
        (candidate,), context=context(2), constraints=constraints(), policy=policy()
    )[0]
    remaining_balance = score_vacation_windows(
        (candidate,), context=context(9), constraints=constraints(), policy=policy()
    )[0]

    assert full_balance.score == remaining_balance.score
    assert full_balance.warnings == (WarningCode.FULL_BALANCE,)
    assert remaining_balance.warnings == ()


def test_every_negative_balance_has_warning() -> None:
    scored = score_vacation_windows(
        (window(3, 5, 3),),
        context=context(2, allowed_negative=1),
        constraints=constraints(),
        policy=policy(),
    )[0]

    assert scored.facts.remaining_balance == -1
    assert scored.warnings == (WarningCode.NEGATIVE_BALANCE,)
