from collections.abc import Callable
from datetime import date, datetime

from vacation_window_planner.annual_workflow import (
    PROCESS_ANNUAL_GATE,
    AnnualCalculationGate,
    AnnualPlanningRequest,
)
from vacation_window_planner.domain.annual import validate_annual_inputs
from vacation_window_planner.domain.annual_budget import AnnualPolicy
from vacation_window_planner.domain.assessment import prepare_calendar
from vacation_window_planner.domain.budget_comparison import (
    BudgetComparisonOutcome,
    compare_annual_budgets,
)
from vacation_window_planner.domain.calculation_context import CalculationContext, capture_context
from vacation_window_planner.domain.calendar import CalendarProvider
from vacation_window_planner.domain.local_dates import local_today


class BudgetComparisonRun(BudgetComparisonOutcome):
    calculation_context: CalculationContext


class BudgetComparisonWorkflow:
    def __init__(
        self,
        *,
        calendar_provider: CalendarProvider,
        policy: AnnualPolicy,
        clock: Callable[[], datetime],
        gate: AnnualCalculationGate = PROCESS_ANNUAL_GATE,
    ) -> None:
        self._calendar_provider = calendar_provider
        self._policy = policy
        self._clock = clock
        self._gate = gate

    def compare(self, request: AnnualPlanningRequest) -> BudgetComparisonRun:
        with self._gate.acquire():
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
            outcome = compare_annual_budgets(inputs, prepared, policy=self._policy)
            return BudgetComparisonRun(
                **outcome.model_dump(),
                calculation_context=capture_context(context, now, today),
            )
