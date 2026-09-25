"""Deterministic selection of varied scored vacation windows."""

from dataclasses import dataclass

from vacation_window_planner.domain.contracts import VacationWindow, WarningCode
from vacation_window_planner.domain.scoring import ScoredWindow

MAX_VISIBLE_ALTERNATIVES = 12


@dataclass(frozen=True)
class _OutcomeKey:
    total_days: int
    vacation_days_used: int
    score: int
    warnings: tuple[WarningCode, ...]


@dataclass(frozen=True)
class EquivalentWindowGroup:
    representative: ScoredWindow
    alternative_windows: tuple[VacationWindow, ...]
    matching_window_count: int


def _group_equivalent_windows(
    scored_windows: tuple[ScoredWindow, ...],
) -> tuple[tuple[ScoredWindow, ...], ...]:
    groups: dict[_OutcomeKey, list[ScoredWindow]] = {}
    for item in scored_windows:
        key = _OutcomeKey(
            total_days=item.window.total_days,
            vacation_days_used=item.window.vacation_days_used,
            score=item.score,
            warnings=item.warnings,
        )
        groups.setdefault(key, []).append(item)
    return tuple(tuple(items) for items in groups.values())


def select_diverse_window_groups(
    scored_windows: tuple[ScoredWindow, ...],
    *,
    result_limit: int,
    near_duplicate_overlap_ratio: float,
    material_score_gap: int,
) -> tuple[EquivalentWindowGroup, ...]:
    """Choose one viable date per outcome, then expose its equivalent dates."""
    _validate_selection(result_limit, near_duplicate_overlap_ratio, material_score_gap)
    groups = _group_equivalent_windows(scored_windows)
    useful = tuple(group for group in groups if not _is_trivial_zero_pto(group[0]))
    trivial = tuple(group for group in groups if _is_trivial_zero_pto(group[0]))
    pool = useful + trivial if useful else groups
    selected: list[EquivalentWindowGroup] = []
    selected_trivial = False

    for group in pool:
        is_trivial = _is_trivial_zero_pto(group[0])
        if useful and is_trivial and selected_trivial:
            continue
        representative = next(
            (
                candidate
                for candidate in group
                if all(
                    not _is_near_duplicate(
                        candidate,
                        existing.representative,
                        near_duplicate_overlap_ratio,
                        material_score_gap,
                    )
                    for existing in selected
                )
            ),
            None,
        )
        if representative is None:
            continue
        selected.append(
            EquivalentWindowGroup(
                representative=representative,
                alternative_windows=tuple(
                    item.window for item in group if item is not representative
                )[:MAX_VISIBLE_ALTERNATIVES],
                matching_window_count=len(group),
            )
        )
        selected_trivial = selected_trivial or is_trivial
        if len(selected) == result_limit:
            break

    return tuple(selected)


def _overlap_ratio(left: ScoredWindow, right: ScoredWindow) -> float:
    overlap_start = max(left.window.start_date, right.window.start_date)
    overlap_end = min(left.window.end_date, right.window.end_date)
    if overlap_end < overlap_start:
        return 0.0
    overlap_days = (overlap_end - overlap_start).days + 1
    return overlap_days / min(left.window.total_days, right.window.total_days)


def _is_trivial_zero_pto(item: ScoredWindow) -> bool:
    return item.window.vacation_days_used == 0 and item.window.total_days <= 2


def _validate_selection(
    result_limit: int, near_duplicate_overlap_ratio: float, material_score_gap: int
) -> None:
    if result_limit < 1:
        raise ValueError("result limit must be positive")
    if not 0 <= near_duplicate_overlap_ratio <= 1:
        raise ValueError("near-duplicate overlap ratio must be between 0 and 1")
    if material_score_gap < 0:
        raise ValueError("material score gap must not be negative")


def _is_near_duplicate(
    candidate: ScoredWindow,
    existing: ScoredWindow,
    near_duplicate_overlap_ratio: float,
    material_score_gap: int,
) -> bool:
    if (
        candidate.window.start_date == existing.window.start_date
        and candidate.window.end_date == existing.window.end_date
    ):
        return True
    return (
        _overlap_ratio(candidate, existing) >= near_duplicate_overlap_ratio
        and abs(candidate.score - existing.score) < material_score_gap
    )


def select_diverse_windows(
    scored_windows: tuple[ScoredWindow, ...],
    *,
    result_limit: int,
    near_duplicate_overlap_ratio: float,
    material_score_gap: int,
) -> tuple[ScoredWindow, ...]:
    """Collapse near duplicates while preserving material ranked tradeoffs."""
    _validate_selection(result_limit, near_duplicate_overlap_ratio, material_score_gap)

    useful = tuple(item for item in scored_windows if not _is_trivial_zero_pto(item))
    trivial = tuple(item for item in scored_windows if _is_trivial_zero_pto(item))
    pool = useful + trivial if useful else scored_windows
    selected: list[ScoredWindow] = []
    selected_trivial = False

    for candidate in pool:
        is_trivial = _is_trivial_zero_pto(candidate)
        if useful and is_trivial and selected_trivial:
            continue
        if any(
            _is_near_duplicate(
                candidate, existing, near_duplicate_overlap_ratio, material_score_gap
            )
            for existing in selected
        ):
            continue
        selected.append(candidate)
        selected_trivial = selected_trivial or is_trivial
        if len(selected) == result_limit:
            break

    return tuple(selected)
