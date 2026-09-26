"""Normalize selected months into valid future local start-date ranges."""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date

from vacation_window_planner.domain.contracts import YearMonth


class PastSearchRangeError(ValueError):
    """All selected start dates are before the injected local date."""


@dataclass(frozen=True)
class StartDateRange:
    start_date: date
    end_date: date


@dataclass(frozen=True)
class NormalizedSelectedMonths:
    start_dates: tuple[StartDateRange, ...]
    notice: str | None = None


def normalize_selected_months(
    months: tuple[YearMonth, ...], today: date
) -> NormalizedSelectedMonths:
    """Return inclusive allowed start ranges after removing past local dates."""
    ranges: list[StartDateRange] = []
    was_clipped = False

    for month in sorted(months, key=lambda item: (item.year, item.month)):
        first = date(month.year, month.month, 1)
        last = date(month.year, month.month, monthrange(month.year, month.month)[1])
        if last < today:
            was_clipped = True
            continue
        start = max(first, today)
        was_clipped = was_clipped or start != first
        ranges.append(StartDateRange(start_date=start, end_date=last))

    if not ranges:
        raise PastSearchRangeError("selected months are entirely in the past")

    notice = None
    if was_clipped:
        notice = (
            f"Past start dates were excluded; search begins on {ranges[0].start_date.isoformat()}."
        )
    return NormalizedSelectedMonths(start_dates=tuple(ranges), notice=notice)
