from dataclasses import replace

from pydantic import Field, StrictInt

from vacation_window_planner.domain.annual import (
    AnnualOutcome,
    AnnualRequest,
    plan_year,
    validate_annual_inputs,
)
from vacation_window_planner.domain.annual_budget import (
    DEFAULT_ANNUAL_POLICY,
    AnnualPolicy,
    WorkBudget,
)
from vacation_window_planner.domain.assessment import PreparedCalendar
from vacation_window_planner.domain.values import DomainValue


class BudgetScenario(DomainValue):
    available_days: StrictInt = Field(ge=0, le=366)
    outcome: AnnualOutcome


class BudgetComparisonOutcome(DomainValue):
    input: AnnualRequest
    baseline_days: StrictInt = Field(ge=0, le=366)
    scenarios: tuple[BudgetScenario, ...]


def compare_annual_budgets(
    request: AnnualRequest,
    calendar: PreparedCalendar,
    *,
    policy: AnnualPolicy = DEFAULT_ANNUAL_POLICY,
    work_budget: WorkBudget | None = None,
) -> BudgetComparisonOutcome:
    validate_annual_inputs(request, calendar.context, calendar.local_today)
    budget = work_budget or WorkBudget(policy)
    baseline = calendar.context.balance_days
    scenarios: list[BudgetScenario] = []
    for available in (baseline, baseline - 1, baseline + 1):
        if not request.reserve_days <= available <= 366:
            continue
        context = calendar.context.model_copy(update={"balance_days": available})
        outcome = plan_year(
            request,
            replace(calendar, context=context),
            policy=policy,
            work_budget=budget,
            include_alternatives=False,
        )
        scenarios.append(BudgetScenario(available_days=available, outcome=outcome))
    return BudgetComparisonOutcome(
        input=request,
        baseline_days=baseline,
        scenarios=tuple(sorted(scenarios, key=lambda scenario: scenario.available_days)),
    )
