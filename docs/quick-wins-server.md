# Budget comparison HTTP contract

QW 02 adds authenticated `POST /annual-plans/budget-comparison`. The body is the existing annual request; the bearer session supplies the baseline available leave, calendar, personal rules and time zone. Optional interpretation is not involved.

The response contains `input`, `baseline_days`, sanitized `calculation_context`, and ascending `scenarios`. Each scenario contains `available_days` and the existing annual `outcome` with at most one primary plan. All scenarios use the same captured local date and resolved calendar. Scenario accounting uses that scenario's balance; the outer context records the baseline balance.

The baseline is evaluated first, followed by valid lower and upper budgets. One shared `WorkBudget` preserves the current annual candidate/state/transition caps and five-second calculation deadline. Counters in each outcome are cumulative at its completion. Completed scenarios survive exhaustion in a later scenario; capped scenarios have unknown feasibility and no partial plans. The same two-permit process gate protects annual planning and comparisons.

| HTTP | Code or domain outcome | Meaning |
| --- | --- | --- |
| 200 | complete / infeasible / conflict / too_broad per scenario | Bounded hypothetical outcomes; compare full mixes only when complete |
| 401 | INVALID_SESSION / SESSION_EXPIRED | Missing or inactive bearer context |
| 422 | INVALID_ANNUAL_PLAN | Shape or context failure, with field paths |
| 422 | UNSUPPORTED_CALENDAR | Calendar is outside supported scope |
| 503 | CALENDAR_UNAVAILABLE | Calendar resolution or coverage failed |
| 503 | ANNUAL_PLANNER_BUSY | Annual/comparison permits are occupied; retry explicitly |

Comparison is ephemeral: no annual run ID or database row is created. It neither changes the immutable session nor the annual request. Adopting a budget requires a draft edit and an ordinary annual generation, which retains its existing persistence contract. Browser saves and year cards continue to use selected annual snapshots.

The HTTP tests use real PostgreSQL session creation, fixed external calendars/clocks, malformed-body validation, anonymous-context rules, provider failure/retry and shared annual/comparison concurrency. The pure comparison tests cover scenario accounting and capped/reduced truth.
