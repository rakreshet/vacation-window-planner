"""Deterministic scoring and grounded score facts."""

from dataclasses import dataclass

from vacation_window_planner.domain.contracts import (
    SearchConstraints,
    UserVacationContext,
    VacationWindow,
    WarningCode,
)
from vacation_window_planner.domain.policy import RecommendationPolicy


@dataclass(frozen=True)
class ScoreFacts:
    efficiency: float
    duration: int
    length_deviation: int
    remaining_balance: int


@dataclass(frozen=True)
class ScoredWindow:
    window: VacationWindow
    score: int
    facts: ScoreFacts
    warnings: tuple[WarningCode, ...]


def _warnings(length_deviation: int, remaining_balance: int) -> tuple[WarningCode, ...]:
    warnings: list[WarningCode] = []
    if length_deviation != 0:
        warnings.append(WarningCode.LENGTH_RELAXED)
    if remaining_balance < 0:
        warnings.append(WarningCode.NEGATIVE_BALANCE)
    elif remaining_balance == 0:
        warnings.append(WarningCode.FULL_BALANCE)
    return tuple(warnings)


def score_vacation_windows(
    windows: tuple[VacationWindow, ...],
    *,
    context: UserVacationContext,
    constraints: SearchConstraints,
    policy: RecommendationPolicy,
) -> tuple[ScoredWindow, ...]:
    """Score candidates on documented normalized features and return stable ordering."""
    scored: list[ScoredWindow] = []
    preferred = constraints.preferred_length_days

    for window in windows:
        efficiency = (window.total_days - window.vacation_days_used) / window.total_days
        duration_feature = min(window.total_days / preferred, 1.0)
        length_deviation = window.total_days - preferred
        length_fit = max(0.0, 1.0 - abs(length_deviation) / preferred)
        remaining_balance = context.balance_days - window.vacation_days_used
        normalized = (
            efficiency * policy.efficiency_weight
            + duration_feature * policy.duration_weight
            + length_fit * policy.length_fit_weight
        )
        score = round(max(0.0, min(1.0, normalized)) * 100)
        scored.append(
            ScoredWindow(
                window=window,
                score=score,
                facts=ScoreFacts(
                    efficiency=round(efficiency, 6),
                    duration=window.total_days,
                    length_deviation=length_deviation,
                    remaining_balance=remaining_balance,
                ),
                warnings=_warnings(length_deviation, remaining_balance),
            )
        )

    return tuple(
        sorted(
            scored,
            key=lambda item: (
                -item.score,
                item.window.vacation_days_used,
                item.window.start_date,
                item.window.end_date,
            ),
        )
    )
