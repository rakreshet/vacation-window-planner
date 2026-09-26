"""Validated local-date context; trip calculations remain date-only."""

from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TIME_ZONE = "Asia/Jerusalem"


def validate_time_zone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ValueError("time_zone must be an IANA time-zone name") from error
    return value


def local_today(now: datetime, time_zone: str) -> date:
    if now.tzinfo is None:
        raise ValueError("clock must return an aware datetime")
    return now.astimezone(ZoneInfo(time_zone)).date()
