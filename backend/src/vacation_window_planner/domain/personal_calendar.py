"""Canonical, bounded personal calendar rules, without expanding date ranges."""

from datetime import date
from typing import Literal, Self

from pydantic import Field, StrictInt, field_validator, model_validator

from vacation_window_planner.domain.values import DomainValue


class DateRange(DomainValue):
    start_date: date
    end_date: date

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def local_date_only(cls, value: object) -> date:
        if type(value) is date:
            return value
        if isinstance(value, str) and len(value) == 10:
            parsed = date.fromisoformat(value)
            if parsed.isoformat() == value:
                return parsed
        raise ValueError("use a local date in YYYY-MM-DD format")

    @model_validator(mode="after")
    def bounded_range(self) -> Self:
        if not 0 <= (self.end_date - self.start_date).days < 366:
            raise ValueError("date range must contain 1 through 366 dates")
        return self


class DateOverride(DateRange):
    kind: Literal["personal_day_off", "extra_working_day"]


def _merge_ranges[T: DateRange](ranges: tuple[T, ...]) -> tuple[T, ...]:
    merged: list[T] = []
    for item in sorted(ranges, key=lambda item: item.start_date):
        if merged and item.start_date.toordinal() <= merged[-1].end_date.toordinal() + 1:
            previous = merged.pop()
            merged.append(
                previous.model_copy(update={"end_date": max(previous.end_date, item.end_date)})
            )
        else:
            merged.append(item)
    chunks: list[T] = []
    for item in merged:
        start = item.start_date.toordinal()
        end = item.end_date.toordinal()
        while start <= end:
            chunk_end = min(start + 365, end)
            chunks.append(
                item.model_copy(
                    update={
                        "start_date": date.fromordinal(start),
                        "end_date": date.fromordinal(chunk_end),
                    }
                )
            )
            start = chunk_end + 1
    return tuple(chunks)


class PersonalCalendar(DomainValue):
    schema_version: Literal[1] = 1
    date_overrides: tuple[DateOverride, ...] = Field(default=(), max_length=100)
    unavailable_ranges: tuple[DateRange, ...] = Field(default=(), max_length=100)
    minimum_notice_days: StrictInt = Field(default=0, ge=0, le=90)

    @field_validator("schema_version", mode="before")
    @classmethod
    def integer_version(cls, value: object) -> object:
        if type(value) is not int:
            raise ValueError("schema version must be an integer")
        return value

    @field_validator("date_overrides")
    @classmethod
    def canonical_overrides(cls, value: tuple[DateOverride, ...]) -> tuple[DateOverride, ...]:
        for index, left in enumerate(value):
            for right in value[index + 1 :]:
                if (
                    left.kind != right.kind
                    and left.start_date <= right.end_date
                    and right.start_date <= left.end_date
                ):
                    raise ValueError("opposing date overrides overlap")
        return tuple(
            sorted(
                (
                    *_merge_ranges(tuple(r for r in value if r.kind == "personal_day_off")),
                    *_merge_ranges(tuple(r for r in value if r.kind == "extra_working_day")),
                ),
                key=lambda r: (r.start_date, r.end_date, r.kind),
            )
        )

    @field_validator("unavailable_ranges")
    @classmethod
    def canonical_unavailable(cls, value: tuple[DateRange, ...]) -> tuple[DateRange, ...]:
        return _merge_ranges(value)
