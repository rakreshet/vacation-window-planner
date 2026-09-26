"""Diversity selection over scored vacation windows."""

from datetime import date, timedelta

from vacation_window_planner.domain.contracts import VacationWindow
from vacation_window_planner.domain.diversity import select_diverse_windows
from vacation_window_planner.domain.scoring import ScoredWindow, ScoreFacts


def scored(start_day: int, total: int, used: int, score: int) -> ScoredWindow:
    start = date(2027, 1, start_day)
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
            length_deviation=0,
            remaining_balance=10 - used,
        ),
        warnings=(),
    )


def select(*items: ScoredWindow, limit: int = 5) -> tuple[ScoredWindow, ...]:
    return select_diverse_windows(
        items,
        result_limit=limit,
        near_duplicate_overlap_ratio=0.8,
        material_score_gap=5,
    )


def test_identical_windows_collapse_to_first_ranked_result() -> None:
    first = scored(1, 5, 2, 90)
    duplicate = scored(1, 5, 2, 90)

    assert select(first, duplicate) == (first,)


def test_adjacent_high_overlap_window_is_suppressed() -> None:
    first = scored(1, 5, 2, 90)
    adjacent = scored(2, 5, 2, 89)

    assert select(first, adjacent) == (first,)


def test_material_score_tradeoff_preserves_near_duplicate() -> None:
    first = scored(1, 5, 1, 95)
    adjacent = scored(2, 5, 3, 88)

    assert select(first, adjacent) == (first, adjacent)


def test_stable_ties_preserve_input_order() -> None:
    first = scored(1, 3, 1, 80)
    second = scored(10, 3, 1, 80)

    assert select(first, second) == (first, second)


def test_result_limit_is_applied_after_diversity() -> None:
    items = tuple(scored(day, 3, 1, 90 - day) for day in (1, 8, 15))

    assert select(*items, limit=2) == items[:2]


def test_trivial_zero_pto_weekends_do_not_crowd_out_longer_breaks() -> None:
    weekend_one = scored(1, 2, 0, 100)
    weekend_two = scored(8, 2, 0, 99)
    useful_break = scored(15, 7, 3, 90)

    assert select(weekend_one, weekend_two, useful_break, limit=2) == (
        useful_break,
        weekend_one,
    )
