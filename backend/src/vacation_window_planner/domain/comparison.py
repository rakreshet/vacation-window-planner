"""Exact-date comparison contracts and server-owned discovery bounds."""

from datetime import date
from enum import StrEnum
from typing import Self
from uuid import UUID

from pydantic import Field, StrictInt, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from vacation_window_planner.domain.contracts import DomainValue
from vacation_window_planner.domain.evaluation import WindowEvaluation


class ComparisonInput(DomainValue):
    start_date: date
    end_date: date
    source_search_id: UUID | None = None

    @model_validator(mode="after")
    def ordered_dates(self) -> Self:
        if self.end_date < self.start_date:
            raise ValueError("end date must not precede start date")
        return self


class ComparisonPolicy(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="COMPARISON_", extra="forbid", frozen=True)

    version: str = Field(default="phase05-v1", min_length=1)
    shift_days: int = Field(default=21, ge=0, le=60)
    extra_days: int = Field(default=7, ge=0, le=14)
    max_length_days: int = Field(default=28, ge=1, le=90)
    result_limit: int = Field(default=3, ge=1, le=5)
    generation_cap: int = Field(default=2000, ge=1, le=5000)


class ComparisonWarning(StrEnum):
    FULL_BALANCE = "full_balance"
    NEGATIVE_BALANCE = "negative_balance"
    OVER_BUDGET = "over_budget"


class ComparedWindow(WindowEvaluation):
    weekend_dates: tuple[date, ...]
    feasible: bool
    warnings: tuple[ComparisonWarning, ...] = ()


class ComparisonDelta(DomainValue):
    extra_days: StrictInt
    vacation_days_saved: StrictInt
    start_shift_days: StrictInt
    end_shift_days: StrictInt


class ComparisonAlternative(DomainValue):
    evaluation: ComparedWindow
    delta: ComparisonDelta
    explanation: str


class ComparisonResult(DomainValue):
    comparison_id: UUID
    baseline: ComparedWindow
    save_leave: tuple[ComparisonAlternative, ...] = ()
    longer_break: tuple[ComparisonAlternative, ...] = ()
    policy: ComparisonPolicy
    notices: tuple[str, ...] = ()
