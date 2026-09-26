"""Snapshot-like tests for explanations grounded in score facts."""

from datetime import date, timedelta

from vacation_window_planner.domain.contracts import VacationWindow, WarningCode
from vacation_window_planner.domain.explanations import DeterministicExplanationFormatter
from vacation_window_planner.domain.scoring import ScoredWindow, ScoreFacts


def scored(
    *,
    total: int = 5,
    used: int = 1,
    score: int = 90,
    deviation: int = 0,
    remaining: int = 6,
    warnings: tuple[WarningCode, ...] = (),
) -> ScoredWindow:
    start = date(2027, 1, 3)
    return ScoredWindow(
        window=VacationWindow(
            start_date=start,
            end_date=start + timedelta(days=total - 1),
            total_days=total,
            vacation_days_used=used,
        ),
        score=score,
        facts=ScoreFacts(
            efficiency=(total - used) / total,
            duration=total,
            length_deviation=deviation,
            remaining_balance=remaining,
        ),
        warnings=warnings,
    )


def test_efficient_window_explanation_snapshot() -> None:
    explanation = DeterministicExplanationFormatter().explain(scored())

    assert explanation == (
        "5 days off use 1 vacation day, with 80% of the window uncharged. 6 vacation days remain."
    )


def test_length_relaxed_explanation_snapshot() -> None:
    explanation = DeterministicExplanationFormatter().explain(
        scored(
            total=4,
            deviation=-1,
            warnings=(WarningCode.LENGTH_RELAXED,),
        )
    )

    assert explanation.endswith("This is 1 day shorter than your preferred length.")


def test_close_tradeoff_explanation_snapshot() -> None:
    explanation = DeterministicExplanationFormatter().explain(scored(score=88), previous_score=90)

    assert explanation.endswith("This is a close trade-off with the option above.")


def test_full_balance_explanation_snapshot() -> None:
    explanation = DeterministicExplanationFormatter().explain(
        scored(total=7, used=6, remaining=0, warnings=(WarningCode.FULL_BALANCE,))
    )

    assert explanation.endswith("This uses your full available vacation balance.")


def test_negative_balance_explanation_snapshot() -> None:
    explanation = DeterministicExplanationFormatter().explain(
        scored(total=7, used=7, remaining=-1, warnings=(WarningCode.NEGATIVE_BALANCE,))
    )

    assert explanation.endswith("This uses 1 day beyond your current balance.")
