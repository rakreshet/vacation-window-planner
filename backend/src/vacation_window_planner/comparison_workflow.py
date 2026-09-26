"""Authenticated exact-date comparison orchestration."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Protocol
from uuid import UUID, uuid4

from vacation_window_planner.domain.calendar import CalendarProvider
from vacation_window_planner.domain.comparison import (
    ComparisonInput,
    ComparisonPolicy,
    ComparisonResult,
)
from vacation_window_planner.domain.comparison_engine import describe_window, discover_alternatives
from vacation_window_planner.domain.contracts import UserVacationContext
from vacation_window_planner.domain.local_dates import local_today


class ComparisonSnapshotWriter(Protocol):
    def save_completed(
        self,
        *,
        comparison_id: UUID,
        session_id: UUID,
        structured_input: dict[str, object],
        result: dict[str, object],
        created_at: datetime,
    ) -> None: ...


class InvalidComparisonError(ValueError):
    """The requested baseline cannot be evaluated under this policy."""


class ComparisonOriginError(ValueError):
    """The optional origin is not owned by this session."""


@dataclass(frozen=True)
class ComparisonRequest:
    context: UserVacationContext
    dates: ComparisonInput


class ComparisonWorkflow:
    def __init__(
        self,
        *,
        calendar_provider: CalendarProvider,
        policy: ComparisonPolicy,
        clock: Callable[[], datetime],
        source_search_owned: Callable[[UUID, UUID], bool],
        snapshot_writer: ComparisonSnapshotWriter,
    ) -> None:
        self._calendar_provider = calendar_provider
        self._policy = policy
        self._clock = clock
        self._source_search_owned = source_search_owned
        self._snapshot_writer = snapshot_writer

    def compare(self, request: ComparisonRequest) -> ComparisonResult:
        dates, context = request.dates, request.context
        now = self._clock()
        today = local_today(now, context.time_zone)
        if dates.source_search_id is not None and not self._source_search_owned(
            dates.source_search_id, context.session_id
        ):
            raise ComparisonOriginError("Originating search not found")
        length = (dates.end_date - dates.start_date).days + 1
        if dates.start_date < today:
            raise InvalidComparisonError("Start date must be today or later")
        if length > self._policy.max_length_days:
            raise InvalidComparisonError(
                f"Choose a break of at most {self._policy.max_length_days} days"
            )
        padding = self._policy.shift_days + self._policy.max_length_days
        if dates.end_date > date.max - timedelta(days=padding):
            raise InvalidComparisonError("Dates are too close to the calendar limit")
        calendar = self._calendar_provider.resolve(
            context.country_code,
            date.fromordinal(
                max(today.toordinal(), dates.start_date.toordinal() - self._policy.shift_days)
            ),
            dates.start_date
            + timedelta(days=self._policy.shift_days + self._policy.max_length_days - 1),
            weekend_override=context.weekend_days,
        )
        baseline = describe_window(dates.start_date, dates.end_date, calendar, context)
        saved, longer = discover_alternatives(
            baseline,
            calendar=calendar,
            context=context,
            policy=self._policy,
            today=today,
        )
        result = ComparisonResult(
            comparison_id=uuid4(),
            baseline=baseline,
            save_leave=saved,
            longer_break=longer,
            policy=self._policy,
        )
        self._snapshot_writer.save_completed(
            comparison_id=result.comparison_id,
            session_id=context.session_id,
            structured_input={
                "context": context.model_dump(mode="json"),
                "dates": dates.model_dump(mode="json"),
                "calendar": calendar.model_dump(mode="json"),
                "policy": self._policy.model_dump(mode="json"),
                "local_today": today.isoformat(),
            },
            result=result.model_dump(mode="json"),
            created_at=now,
        )
        return result
