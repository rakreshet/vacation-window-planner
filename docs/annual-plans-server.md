# Annual planning server contract

AP 04 exposes `POST /annual-plans` using the existing bearer-session context. The body is the canonical annual input described in [the approved plan](annual-plans-plan.md#http-and-wire-contracts); balance, calendar, personal rules and time zone belong to the immutable session. A changed common context requires a new session. Structured annual planning has no interpretation-provider dependency.

Every successful HTTP response includes a fresh `run_id`, sanitized calculation context and the discriminated annual outcome. The server captures UTC time once and derives local today from that session's time zone. It validates year, pool, reserve, allowance and locked-date eligibility before resolving the provider calendar. Exact costs always use that common calendar.

## Persistence

Migration `20260926_09` follows the verified `20260926_08` head and creates `annual_plan_runs`: UUID primary key, indexed session foreign key with cascade deletion, timestamp and non-null input/result JSON. No historical backfill is needed for the undeployed database.

`AnnualRunRepository.save_completed` owns the snapshot transaction: insert, flush and commit must all succeed before returning. A failure rolls back and maps to a retryable HTTP error. The stored input includes canonical slots, calculation context, resolved holiday facts, full-year coverage and effective policy. The exact returned result stores algorithm/accounting versions, counters and every output fact. New submissions create new rows; existing runs are never updated. Repository reads require the session ID. There is no public read-by-ID endpoint.

## Operational outcomes

| HTTP | Code/status | Meaning |
| --- | --- | --- |
| 200 | `complete`, `infeasible`, `conflict`, `too_broad` | An evaluable, persisted domain outcome; a cap is not infeasibility |
| 401 | `INVALID_SESSION`, `SESSION_EXPIRED` | Missing or inactive bearer session |
| 422 | `INVALID_ANNUAL_PLAN` | Invalid shape or context; field paths identify repairs |
| 422 | `UNSUPPORTED_CALENDAR` | Unsupported country calendar |
| 503 | `CALENDAR_UNAVAILABLE` | Calendar resolution/coverage failed; no fabricated run |
| 503 | `ANNUAL_PLANNER_BUSY` | Two annual requests already hold this process's permits; retry later |
| 503 | `PERSISTENCE_ERROR` | Snapshot flush/commit failed; no successful result returned |

The process-wide guard uses two nonblocking permits and releases on every exit, including errors and capped calculations. Each process has its own guard; multiple server workers multiply total deployment concurrency. No background queue or automatic retry exists.

The `ANNUAL_POLICY` environment setting accepts a JSON object of work limits (`candidate_limit`, `state_limit`, `transition_limit`, `time_limit_seconds`). Omitted values use `annual-v1` defaults. Startup validation permits lowering limits, rejects zero/negative values and values above approved bounds. Do not raise these bounds or change completeness claims without measured evidence and plan review. Request logging retains method/path/status/duration, not bodies, tokens or interpretation text.

## Verification

The AP 04 tests use authenticated HTTP and disposable PostgreSQL to compare returned and restored snapshots, cover all four outcomes, immutable resubmission and session ownership, and exercise HTTP commit failure plus repository flush/commit rollback and clean retry. Controlled provider and concurrent calls verify error separation and the two-permit limit. Migration checks inspect non-null columns, the indexed foreign key and cascade behavior, and upgrade/downgrade the new revision. Earlier phase acceptance remains part of the full backend suite.
