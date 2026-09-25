"""Grounded explanation formatting with an optional phrasing seam."""

from typing import Protocol

from vacation_window_planner.domain.contracts import WarningCode
from vacation_window_planner.domain.scoring import ScoredWindow


def _days(value: int, noun: str = "day") -> str:
    return f"{value} {noun if abs(value) == 1 else noun + 's'}"


class ExplanationFormatter(Protocol):
    """Optional phrasing seam; inputs contain all facts a formatter may claim."""

    def explain(self, item: ScoredWindow, previous_score: int | None = None) -> str: ...


class DeterministicExplanationFormatter:
    """Format concise explanations without introducing unverified facts."""

    def explain(self, item: ScoredWindow, previous_score: int | None = None) -> str:
        used = item.window.vacation_days_used
        sentences = [
            f"{_days(item.window.total_days)} off use {_days(used, 'vacation day')}, "
            f"with {round(item.facts.efficiency * 100)}% of the window uncharged."
        ]

        if WarningCode.NEGATIVE_BALANCE in item.warnings:
            sentences.append(
                f"This uses {_days(abs(item.facts.remaining_balance))} beyond your current balance."
            )
        elif WarningCode.FULL_BALANCE in item.warnings:
            sentences.append("This uses your full available vacation balance.")
        else:
            sentences.append(f"{_days(item.facts.remaining_balance, 'vacation day')} remain.")

        if WarningCode.LENGTH_RELAXED in item.warnings:
            difference = abs(item.facts.length_deviation)
            direction = "longer" if item.facts.length_deviation > 0 else "shorter"
            sentences.append(f"This is {_days(difference)} {direction} than your preferred length.")

        if previous_score is not None and 0 <= previous_score - item.score <= 2:
            sentences.append("This is a close trade-off with the option above.")

        return " ".join(sentences)
