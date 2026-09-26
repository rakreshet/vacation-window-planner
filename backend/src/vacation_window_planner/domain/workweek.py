"""Temporary country workweek defaults, isolated for later replacement."""

_ISRAEL_WEEKEND = frozenset({4, 5})
_STANDARD_WEEKEND = frozenset({5, 6})


def default_weekend_days(country_code: str) -> frozenset[int]:
    """Return nonworking weekdays (Monday=0); Israel is the sole exception."""
    return _ISRAEL_WEEKEND if country_code == "IL" else _STANDARD_WEEKEND
