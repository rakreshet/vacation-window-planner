"""Deterministic selection of varied scored vacation windows."""

from dataclasses import dataclass

from vacation_window_planner.domain.contracts import VacationWindow
from vacation_window_planner.domain.scoring import ScoredWindow


@dataclass(frozen=True)
class EquivalentWindowGroup:
    representative: ScoredWindow
    alternative_windows: tuple[VacationWindow, ...]
    matching_window_count: int


def group_equivalent_windows(
    scored_windows: tuple[ScoredWindow, ...], *, visible_alternatives: int = 12
) -> tuple[EquivalentWindowGroup, ...]:
    """Group equally valuable dates before the shortlist consumes result slots."""
    groups: dict[tuple[int, int, int, tuple[object, ...]], list[ScoredWindow]] = {}
    for item in scored_windows:
        key = (
            item.window.total_days,
            item.window.vacation_days_used,
            item.score,
            item.warnings,
        )
        groups.setdefault(key, []).append(item)

    return tuple(
        EquivalentWindowGroup(
            representative=items[0],
            alternative_windows=tuple(item.window for item in items[1 : visible_alternatives + 1]),
            matching_window_count=len(items),
        )
        for items in groups.values()
    )


def _overlap_ratio(left: ScoredWindow, right: ScoredWindow) -> float:
    overlap_start = max(left.window.start_date, right.window.start_date)
    overlap_end = min(left.window.end_date, right.window.end_date)
    if overlap_end < overlap_start:
        return 0.0
    overlap_days = (overlap_end - overlap_start).days + 1
    return overlap_days / min(left.window.total_days, right.window.total_days)


def _is_trivial_zero_pto(item: ScoredWindow) -> bool:
    return item.window.vacation_days_used == 0 and item.window.total_days <= 2


def select_diverse_windows(
    scored_windows: tuple[ScoredWindow, ...],
    *,
    result_limit: int,
    near_duplicate_overlap_ratio: float,
    material_score_gap: int,
) -> tuple[ScoredWindow, ...]:
    """Collapse near duplicates while preserving material ranked tradeoffs."""
    if result_limit < 1:
        raise ValueError("result limit must be positive")
    if not 0 <= near_duplicate_overlap_ratio <= 1:
        raise ValueError("near-duplicate overlap ratio must be between 0 and 1")
    if material_score_gap < 0:
        raise ValueError("material score gap must not be negative")

    useful = tuple(item for item in scored_windows if not _is_trivial_zero_pto(item))
    trivial = tuple(item for item in scored_windows if _is_trivial_zero_pto(item))
    pool = useful + trivial if useful else scored_windows
    selected: list[ScoredWindow] = []
    selected_trivial = False

    for candidate in pool:
        is_trivial = _is_trivial_zero_pto(candidate)
        if useful and is_trivial and selected_trivial:
            continue
        should_skip = False
        for existing in selected:
            if (
                candidate.window.start_date == existing.window.start_date
                and candidate.window.end_date == existing.window.end_date
            ):
                should_skip = True
                break
            if (
                _overlap_ratio(candidate, existing) >= near_duplicate_overlap_ratio
                and abs(candidate.score - existing.score) < material_score_gap
            ):
                should_skip = True
                break
        if should_skip:
            continue
        selected.append(candidate)
        selected_trivial = selected_trivial or is_trivial
        if len(selected) == result_limit:
            break

    return tuple(selected)
