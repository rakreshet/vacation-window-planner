"""Measure fixed normal comparisons through the public workflow, without persistence."""

import json
import platform
import statistics
from collections import Counter
from datetime import UTC, datetime
from time import perf_counter
from uuid import UUID

from vacation_window_planner.annual_workflow import AnnualPlanningRequest
from vacation_window_planner.budget_comparison_workflow import BudgetComparisonWorkflow
from vacation_window_planner.domain.annual import AnnualRequest
from vacation_window_planner.domain.annual_budget import AnnualPolicy
from vacation_window_planner.domain.calendar import PythonHolidaysCalendarProvider
from vacation_window_planner.domain.contracts import UserVacationContext
from vacation_window_planner.domain.workweek import default_weekend_days


def main() -> None:
    now = datetime(2026, 10, 3, 12, tzinfo=UTC)
    request = AnnualRequest.model_validate(
        {
            "year": 2027,
            "reserve_days": 3,
            "minimum_gap_days": 7,
            "slots": [
                {"slot_id": "long", "min_days": 7, "max_days": 14},
                {"slot_id": "short-1", "min_days": 3, "max_days": 5},
                {"slot_id": "short-2", "min_days": 3, "max_days": 5},
            ],
        }
    )
    workflow = BudgetComparisonWorkflow(
        calendar_provider=PythonHolidaysCalendarProvider(),
        policy=AnnualPolicy(),
        clock=lambda: now,
    )
    records = []
    for country, zone in [
        ("IL", "Asia/Jerusalem"),
        ("US", "America/New_York"),
        ("GB", "Europe/London"),
    ]:
        context = UserVacationContext(
            session_id=UUID(int=1),
            balance_days=18,
            country_code=country,
            time_zone=zone,
            weekend_days=default_weekend_days(country),
        )
        job = AnnualPlanningRequest(context=context, input=request)
        workflow.compare(job)
        seconds = []
        outcomes: Counter[str] = Counter()
        counters = []
        for _ in range(20):
            start = perf_counter()
            outcome = workflow.compare(job)
            seconds.append(perf_counter() - start)
            outcomes["/".join(scenario.outcome.status for scenario in outcome.scenarios)] += 1
            counters.append(
                {
                    name: max(
                        getattr(scenario.outcome.counters, name) for scenario in outcome.scenarios
                    )
                    for name in ["candidates", "states", "transitions"]
                }
            )
        records.append(
            {
                "country": country,
                "runs": 20,
                "median_seconds": statistics.median(seconds),
                "p95_seconds": sorted(seconds)[18],
                "max_seconds": max(seconds),
                "outcomes": dict(outcomes),
                "maximum_counters": {
                    name: max(item[name] for item in counters) for name in counters[0]
                },
            }
        )
    print(
        json.dumps(
            {
                "python": platform.python_version(),
                "platform": platform.platform(),
                "year": 2027,
                "balance": 18,
                "reserve": 3,
                "gap": 7,
                "results": records,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
