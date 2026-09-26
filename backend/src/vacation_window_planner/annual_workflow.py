from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime
from threading import BoundedSemaphore
from typing import Annotated, Protocol
from uuid import UUID, uuid4

from pydantic import Field, TypeAdapter

from vacation_window_planner.domain.annual import (
    AnnualPolicy,
    AnnualRequest,
    CompleteAnnualResult,
    ConflictedAnnualResult,
    IncompleteAnnualResult,
    InfeasibleAnnualResult,
    plan_year,
    validate_annual_inputs,
)
from vacation_window_planner.domain.assessment import prepare_calendar
from vacation_window_planner.domain.calculation_context import CalculationContext, capture_context
from vacation_window_planner.domain.calendar import CalendarProvider
from vacation_window_planner.domain.contracts import UserVacationContext
from vacation_window_planner.domain.local_dates import local_today
from vacation_window_planner.domain.values import DomainValue


class AnnualRunContext(DomainValue):
    run_id: UUID
    calculation_context: CalculationContext


class CompleteAnnualRun(CompleteAnnualResult, AnnualRunContext):
    pass


class InfeasibleAnnualRun(InfeasibleAnnualResult, AnnualRunContext):
    pass


class ConflictedAnnualRun(ConflictedAnnualResult, AnnualRunContext):
    pass


class IncompleteAnnualRun(IncompleteAnnualResult, AnnualRunContext):
    pass


type AnnualRun = Annotated[
    CompleteAnnualRun | InfeasibleAnnualRun | ConflictedAnnualRun | IncompleteAnnualRun,
    Field(discriminator="status"),
]


class AnnualSnapshotWriter(Protocol):
    def save_completed(
        self,
        *,
        run_id: UUID,
        session_id: UUID,
        structured_input: dict[str, object],
        result: dict[str, object],
        created_at: datetime,
    ) -> None: ...


@dataclass(frozen=True)
class AnnualPlanningRequest:
    context: UserVacationContext
    input: AnnualRequest


class AnnualPlannerBusy(RuntimeError):
    pass


class AnnualCalculationGate:
    def __init__(self) -> None:
        self._permits = BoundedSemaphore(2)

    @contextmanager
    def acquire(self) -> Iterator[None]:
        if not self._permits.acquire(blocking=False):
            raise AnnualPlannerBusy("Annual planner is busy; try again")
        try:
            yield
        finally:
            self._permits.release()


PROCESS_ANNUAL_GATE = AnnualCalculationGate()


class AnnualWorkflow:
    def __init__(
        self,
        *,
        calendar_provider: CalendarProvider,
        policy: AnnualPolicy,
        clock: Callable[[], datetime],
        snapshot_writer: AnnualSnapshotWriter,
        gate: AnnualCalculationGate = PROCESS_ANNUAL_GATE,
    ) -> None:
        self._calendar_provider = calendar_provider
        self._policy = policy
        self._clock = clock
        self._snapshot_writer = snapshot_writer
        self._gate = gate

    def plan(self, request: AnnualPlanningRequest) -> AnnualRun:
        with self._gate.acquire():
            return self._calculate_and_save(request)

    def _calculate_and_save(self, request: AnnualPlanningRequest) -> AnnualRun:
        context, inputs = request.context, request.input
        now = self._clock()
        today = local_today(now, context.time_zone)
        validate_annual_inputs(inputs, context, today)
        coverage = (date(inputs.year, 1, 1), date(inputs.year, 12, 31))
        calendar = self._calendar_provider.resolve(
            context.country_code,
            *coverage,
            weekend_override=context.weekend_days,
        )
        prepared = prepare_calendar(calendar, context, coverage, today)
        outcome = plan_year(inputs, prepared, policy=self._policy)
        calculation_context = capture_context(context, now, today)
        result: AnnualRun = TypeAdapter(AnnualRun).validate_python(
            {
                **outcome.model_dump(),
                "run_id": uuid4(),
                "calculation_context": calculation_context,
            }
        )
        self._snapshot_writer.save_completed(
            run_id=result.run_id,
            session_id=context.session_id,
            created_at=now,
            structured_input={
                "input": inputs.model_dump(mode="json"),
                "calculation_context": calculation_context.model_dump(mode="json"),
                "calendar": calendar.model_dump(mode="json"),
                "coverage": {
                    "start_date": coverage[0].isoformat(),
                    "end_date": coverage[1].isoformat(),
                },
                "policy": self._policy.model_dump(mode="json"),
            },
            result=result.model_dump(mode="json"),
        )
        return result
