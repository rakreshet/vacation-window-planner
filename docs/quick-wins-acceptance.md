# Budget playground and shareable year card acceptance

Date: 2026-10-03. Scope: QW 00–06, stacked from merged main `36a1b33`. The implementation is ready for review. PRs remain open; no merge or deployment was performed. The original checkout's unrelated local edits were preserved in a separate managed worktree.

Companions: [plan](quick-wins-plan.md), [confirmed test seams](quick-wins-testing.md), [UX](quick-wins-ux.md), [HTTP contract](quick-wins-server.md), [PR progress](progress.md#budget-playground-and-shareable-year-card).

## Verification boundary

**Native PNG file delivery remains pending at the user's explicit request:** “Leave native download verification pending.” The in-app browser rendered the generated PNG and its download action/prepared link, but its download handler did not deliver a file. Computer Use rejected Chrome access; no further native-browser attempt was made. Rendering, dimensions, content, privacy, browser adapter failures and download-trigger behavior were verified separately. This record does not claim a downloaded file was inspected.

The automated checks and remaining real-browser acceptance below are complete. This deferral replaces the original QW 05/06 native-delivery gate for this delivery, while preserving it as a follow-up check. No file was shared externally.

## Test-first implementation

All five public seams were explicitly confirmed before implementation. Each behavior was introduced after its intended focused test failed, then implemented and rerun to green; each responsibility PR contains its behavior tests. Existing annual solver and App regression tests continued to run.

| Responsibility | Observed public behavior |
| --- | --- |
| QW 01, pure comparison | Literal 3/4/5 budget jump; preserved inputs/locks/reserve; 0/366 bounds; baseline-first cumulative cap; reduced/conflict/unchanged honesty; primary-only mode preserves default annual behavior |
| QW 02, authenticated HTTP | Real PostgreSQL sessions, canonical budget/context, one calendar/date, invalid/expired/provider errors, clean retry, shared two-permit annual gate, no comparison persistence |
| QW 03, rendered playground | Explicit request, strict wire validation, scenario dates/deltas, full/reduced/capped/conflict/edge results, draft unchanged until adoption, edit/selection/navigation cancellation, recalculation required |
| QW 04, parsed SVG and PNG adapter | Selected snapshot, leap/cross-month dates, six breaks, exact locks, omissions, default privacy and optional leave totals, escaped/wrapped title, fixed dimensions, image/canvas/cancellation failures |
| QW 05, rendered sharing | Current/alternate/reduced/saved offline snapshots, renamed titles, independent privacy control, focus/Escape, explicit filename/anchor/prepared link, stale and pending invalidation, rasterization and FileReader failure/retry |
| QW 06, acceptance repair | A one-break card initially failed the public artifact assertion for “1 break”; corrected singular wording and reran green. Browser inspection showed the split preview too narrow inside the results column; stacked preview layout repaired it. |

## Fresh full checks

These commands ran on the isolated worktree, with dedicated Compose project `vacation-qw-check` and `.env.example`. The user's application database was not reset. The local symlinks reuse existing dependencies and are not committed.

| Check | Command | Result |
| --- | --- | --- |
| Backend and migration/session contracts | `docker compose -p vacation-qw-check --env-file .env.example --profile test run --build --rm backend-test` | **286 passed**; one existing Pydantic AI event-loop deprecation warning |
| Python format | `backend/.venv/bin/ruff format --check --no-cache backend` | Passed, 102 files including benchmark script |
| Python lint | `backend/.venv/bin/ruff check --no-cache backend` | Passed |
| Python typing, from backend | `.venv/bin/mypy --cache-dir=/tmp/qw-mypy-final src` | Passed, 44 source modules |
| Frontend, from frontend | `npm test` | **198 passed in 31 files** |
| Frontend lint | `npm run lint` | Passed |
| Frontend format | `npm run format:check` | Passed |
| TypeScript and production bundle | `npm run build` | Passed; build script includes TypeScript |

GitHub's backend and frontend jobs passed at the latest QW 00–05 tips before QW 06 was opened: `44e43e7`, `fed15e0`, `70a9ee8`, `7d3ca42`, `cf175c8`, `a9bc545`. QW 06 runs the same required checks through the repository CI workflow; its PR check status is the authoritative record for its latest tip. This document records the fresh local suite results without promising future runs.

## Real browser acceptance

The dedicated preview uses Compose project `vacation-qw-preview`, frontend `http://localhost:55173`, API `http://localhost:58080`, its own database, and `.env.example`. Structured features ran without an interpretation/provider key. The original application ports were preserved. The backend was stopped only for the saved-card offline check, then restored; API health reported a connected database and the frontend returned HTTP 200.

| Journey | Verified result |
| --- | --- |
| England & Wales, May 2027, one 3–14 day break, Saturday/Sunday weekend, reserve 0 | Real comparison returned budgets **3/4/5 → 6/9/10 days away**, with May 1–6 / 1–9 / 1–10 dates. The baseline card agreed with the selected annual plan. |
| Adopt budget 5 from baseline 4 | Draft changed to 5; earlier results became stale; explicit Recalculate plans returned 10 days away on May 1–10. No automatic annual generation. |
| Six locked breaks in leap year 2028, budget 18, reserve 3 | **21 days away, 9 leave used, 9 remaining.** Dates: Feb 26–Mar 2, Apr 1–3, Jun 3–5, Aug 5–7, Oct 7–9, Dec 2–4. PNG visibly included Feb 29, inclusive endpoints, lock outlines and all six rows. Opt-in leave totals matched accounting. |
| Reduced six-slot request, only first lock retained, new starts in May | **Five included breaks, 18 away, 13 used, 5 remaining, 3 reserve; Break 6 omitted.** First exact lock survived; remaining dates were May 1–3, 11–13, 21–23 and May 31–Jun 2. Card clearly disclosed the omission. |
| Saved six-break record with backend stopped | Reload, reopen, rename to “A year for friends & family,” preview and PNG preparation worked offline. Historical dates/accounting were preserved. |
| Locked-plan plateau | Budgets **17/18/19** each returned **21 away / 9 used / 6 breaks**, same exact locked dates. Neighbors said “No additional days away.” |
| Wide layout, 1440px | Three scenario columns; current results-column preview image **446.5px wide** after repair. Document width stayed 1440px. |
| Narrow layout, 1024px | Scenario cards stacked; current/saved preview image **600px wide**. Document width stayed 1024px. No horizontal overflow. |
| Keyboard and title | Escape closed preview and restored Preview year card focus. An 80-character unbroken title wrapped into 34/34/12 characters on three lines. |
| Actual rasterization | Generated PNG rendered in the browser at **1200 × 1800**, inspected for private/default, optional leave details, six-break and reduced cards. Native file delivery remains deferred as stated above. |

The card's image settings are independent of leave-request copying. Private fields, bearer tokens, server IDs, source text, personal exceptions and unselected unavailable dates are excluded. Automated parsed-artifact assertions cover those exclusions. Pending exports are canceled on close, draft edit, selection, navigation or replacement calculation; errors permit an explicit retry without claiming successful delivery.

## Measured comparison bounds

Reproduce from backend with `PYTHONPATH=src .venv/bin/python scripts/benchmark_budget_comparison.py`. Raw results are committed in [quick-wins-benchmark.json](quick-wins-benchmark.json). The script calls the public workflow, including offline calendar resolution and captured context, without HTTP or database persistence.

Host: Apple M5, macOS 26.6 arm64, Python 3.12.13. Fixed clock: October 3, 2026 at 12:00 UTC. Year 2027, available 18, reserve 3, minimum gap 7, all start months; one 7–14 day slot and two 3–5 day slots; country-default weekends and country timezones. One warm-up plus 20 measured comparisons per country; p95 is nearest-rank sample 19 of 20. Frontend checks ran concurrently during this recorded measurement.

| Calendar | Median | p95 | Maximum | Complete comparisons | Max candidates / states / transitions |
| --- | --- | --- | --- | --- | --- |
| IL | 0.806s | 2.474s | 2.583s | 20/20 | 11,790 / 64,132 / 1,879,196 |
| US | 0.826s | 1.003s | 1.095s | 20/20 | 11,790 / 66,894 / 1,978,727 |
| GB | 0.831s | 1.139s | 1.267s | 20/20 | 11,790 / 68,715 / 2,049,488 |

All **60 comparisons / 180 scenarios** completed; no measured normal scenario capped. Warm p95 met the <=5-second target for each country on this host. This is a fixed workload measurement, not a latency guarantee for every request or machine. Deterministic tests separately exercise cap exhaustion and concurrent busy/release behavior.

Limits remain **12,000 candidates, 500,000 states, 5,000,000 transitions and a five-second calculation deadline shared across the comparison**, plus the existing two-permit annual process gate. Scenario counters are cumulative snapshots; use their maximum, not their sum. No limit, migration, provider subscription or paid dependency was added.
