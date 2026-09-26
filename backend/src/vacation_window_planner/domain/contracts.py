"""Immutable Phase 0 vacation-planning values."""

from datetime import date
from enum import StrEnum
from typing import Self
from uuid import UUID

from pydantic import Field, StrictInt, field_validator, model_validator

from vacation_window_planner.domain.local_dates import DEFAULT_TIME_ZONE, validate_time_zone
from vacation_window_planner.domain.personal_calendar import PersonalCalendar
from vacation_window_planner.domain.values import DomainValue as DomainValue


class UserVacationContext(DomainValue):
    session_id: UUID
    personal_calendar: PersonalCalendar = Field(default_factory=PersonalCalendar)
    time_zone: str = DEFAULT_TIME_ZONE

    _validate_time_zone = field_validator("time_zone")(validate_time_zone)

    balance_days: StrictInt
    allowed_negative_days: StrictInt = Field(default=0, ge=0, le=5)
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    weekend_days: frozenset[StrictInt]

    @field_validator("weekend_days")
    @classmethod
    def weekend_days_must_be_weekdays(cls, value: frozenset[int]) -> frozenset[int]:
        if any(day < 0 or day > 6 for day in value):
            raise ValueError("weekend days must use Monday=0 through Sunday=6")
        return value


class YearMonth(DomainValue):
    year: StrictInt = Field(ge=1, le=9999)
    month: StrictInt = Field(ge=1, le=12)


class SearchConstraints(DomainValue):
    months: tuple[YearMonth, ...] = Field(min_length=1)
    preferred_length_days: StrictInt = Field(gt=0)
    result_limit: StrictInt = Field(default=5, gt=0)

    @field_validator("months")
    @classmethod
    def months_must_be_unique(cls, value: tuple[YearMonth, ...]) -> tuple[YearMonth, ...]:
        keys = {(item.year, item.month) for item in value}
        if len(keys) != len(value):
            raise ValueError("selected months must be unique")
        return value


class HolidayCalendar(DomainValue):
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    weekend_days: frozenset[StrictInt]
    observed_holidays: frozenset[date] = Field(default_factory=frozenset)

    @field_validator("weekend_days")
    @classmethod
    def weekend_days_must_be_weekdays(cls, value: frozenset[int]) -> frozenset[int]:
        if any(day < 0 or day > 6 for day in value):
            raise ValueError("weekend days must use Monday=0 through Sunday=6")
        return value


class VacationWindow(DomainValue):
    start_date: date
    end_date: date
    total_days: StrictInt = Field(gt=0)
    vacation_days_used: StrictInt = Field(ge=0)
    holiday_dates: frozenset[date] = Field(default_factory=frozenset)

    @model_validator(mode="after")
    def dates_and_counts_must_agree(self) -> Self:
        if self.end_date < self.start_date:
            raise ValueError("end date must not precede start date")
        if self.total_days != (self.end_date - self.start_date).days + 1:
            raise ValueError("total days must count both window endpoints")
        if self.vacation_days_used > self.total_days:
            raise ValueError("vacation days used cannot exceed total days")
        if any(day < self.start_date or day > self.end_date for day in self.holiday_dates):
            raise ValueError("holiday dates must fall within the window")
        return self


class WarningCode(StrEnum):
    FULL_BALANCE = "full_balance"
    NEGATIVE_BALANCE = "negative_balance"
    LENGTH_RELAXED = "length_relaxed"


class ScoreComponent(DomainValue):
    points: float = Field(ge=0)
    max_points: float = Field(ge=0)


class ScoreBreakdown(DomainValue):
    leave_efficiency: ScoreComponent
    time_away: ScoreComponent
    length_fit: ScoreComponent


class Recommendation(DomainValue):
    window: VacationWindow
    rank: StrictInt = Field(gt=0)
    score: StrictInt = Field(ge=0, le=100)
    explanation: str = Field(min_length=1)
    remaining_balance: StrictInt
    warnings: tuple[WarningCode, ...] = ()
    alternative_windows: tuple[VacationWindow, ...] = Field(
        default=(), exclude_if=lambda value: not value
    )
    matching_window_count: StrictInt = Field(default=1, ge=1, exclude_if=lambda value: value == 1)
    score_breakdown: ScoreBreakdown | None = Field(
        default=None, exclude_if=lambda value: value is None
    )


class FeedbackValue(StrEnum):
    THUMBS_UP = "thumbs_up"
    THUMBS_DOWN = "thumbs_down"


class Feedback(DomainValue):
    session_id: UUID
    recommendation_id: UUID
    value: FeedbackValue
