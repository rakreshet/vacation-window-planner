"""Authenticated exact-date comparison orchestration."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from uuid import UUID, uuid4

from vacation_window_planner.domain.calendar import CalendarProvider
from vacation_window_planner.domain.comparison import (
    ComparisonInput,
    ComparisonPolicy,
    ComparisonResult,
)
from vacation_window_planner.domain.comparison_engine import describe_window
from vacation_window_planner.domain.contracts import UserVacationContext
from vacation_window_planner.domain.local_dates import local_today


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
    ) -> None:
        self._calendar_provider = calendar_provider
        self._policy = policy
        self._clock = clock
        self._source_search_owned = source_search_owned

    def compare(self, request: ComparisonRequest) -> ComparisonResult:
        dates, context = request.dates, request.context
        today = local_today(self._clock(), context.time_zone)
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
            dates.start_date,
            dates.end_date,
            weekend_override=context.weekend_days,
        )
        return ComparisonResult(
            comparison_id=uuid4(),
            baseline=describe_window(dates.start_date, dates.end_date, calendar, context),
            policy=self._policy,
        )
