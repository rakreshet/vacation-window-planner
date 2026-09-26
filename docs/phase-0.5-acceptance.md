# Phase 0.5 acceptance record

Reviewed on September 26, 2026 against the final Phase 0.5 stack. Delivery remains in open PRs; use the [progress table](progress.md) for review and merge order.

## Automated gates

- Backend: **151 tests pass**, including the existing Phase 0 acceptance suite, shared accounting, local-date boundaries, comparison contracts, bounded discovery, PostgreSQL snapshots, and migration upgrade/downgrade. Ruff format/lint and strict source typing pass.
- Frontend: **28 tests pass**, plus ESLint, Prettier, TypeScript, and the Vite production build. Existing interpretation, explicit Search, score explanations, grouped results, and feedback tests remain green.
- The new HTTP acceptance journey uses the production session/Search/comparison/feedback services against disposable PostgreSQL. It proves that both entry paths produce the same baseline and alternatives, another session cannot claim a Search origin, comparison snapshots round-trip, and the original Search and feedback are unchanged.
- The holiday-discovery regression places a holiday outside the baseline and verifies that nearby alternatives include it. Candidate generation resolves the full neighborhood before evaluating alternatives.
- Frontend tests cover baseline preservation during selection, the accessible comparison table and exact charged-day labels, fixed-length shifts, deliberate endpoint edits, stale suggestions, reset, no improvement, over-budget baselines, expired-session recovery, non-JSON service failures, changed context, and focus return.

Behavior changes were developed in vertical red/green slices at the plan's approved seams. The non-JSON failure test first reproduced the raw parser-error message, then passed after safe retry messaging was added. Integration acceptance checks supplement those slices against real persistence.

One existing dependency warning remains: Pydantic AI calls `asyncio.get_event_loop()` without a current loop in an interpreter test. It does not fail the suite and does not involve comparison requests.

## Rendered and live journey review

The local Compose app used PostgreSQL and the production offline Israeli holiday provider. The supported-surface review used the Codex in-app browser at 1,440 × 1,000 pixels. Exploratory 360 × 800 checks below occurred before the user clarified desktop-only delivery; they are recorded as observations, not a mobile support commitment. No further mobile refinement or certification is in scope.

| Journey/state | Observed result |
| --- | --- |
| Manual dates, January 3–7, 2027; balance 8; Friday/Saturday weekends | Baseline: 5 total days, 5 vacation days, balance 3. Same-length alternative January 1–5: 3 vacation days. Longer alternative January 1–9: 9 total days for 5 vacation days. |
| Select a saving on desktop | The original dates remain beside the selected alternative; comparison table, date movement, and individually labeled charged/weekend dates agree. |
| Selected comparison at 360 pixels | Baseline, selected alternative, metrics, date controls, and day cells stack legibly; document width equals viewport width. |
| Search on mobile; expand matching dates; save positive feedback; compare January 5–9 | Comparison opens the exact grouped dates and correctly reports no improvement in the neighborhood. |
| Shift one day, then return to Search | Both endpoints move together. Suggestions disappear until explicit update. Returning restores the exact originating button, expanded matching dates, scroll position, and selected feedback. |
| Primary Search-card comparison | Opens the same workspace and calculates immediately from the confirmed Search context. |
| Keyboard selection | Enter selects an alternative and moves focus to the selected comparison details. Controls retain visible focus outlines. |
| Existing Search on desktop | Hero, planning form, optional interpretation, and result entry points remain present. |

Visual review found and corrected a fixed-width Search results heading that overflowed the mobile viewport. It also moved selected comparison details ahead of the suggestion groups so they appear immediately beside the baseline. Primary-button colors and focus outlines were strengthened; explicit JavaScript smooth scrolling was removed so the reduced-motion stylesheet governs scrolling.

Accessibility checks cover keyboard interaction, semantic heading order, labeled controls, status/error announcements, semantic comparison tables, and text labels independent of color. A full screen-reader/device certification was not performed.

## Representative calendar and response-time check

Fifteen sequential requests went through local HTTP, the production calendar adapter, and PostgreSQL snapshot commits: five requests for each range below. Balance was 8, allowance 0, Friday/Saturday weekends, and `Asia/Jerusalem` time zone. These are local observations, not a production latency promise.

| Baseline dates in 2027 | Baseline vacation days | Same-length / longer options | Median | Maximum |
| --- | --- | --- | --- | --- |
| January 3–7 | 5 | 2 / 3 | 8.8 ms | 15.5 ms |
| April 25–29 | 4; observed holiday April 28 | 2 / 3 | 7.8 ms | 47.4 ms |
| September 30–October 4 | 2; observed holidays October 2–3 | 0 / 0 | 6.7 ms | 7.4 ms |

The January example finds 2 saved vacation days or 4 additional days off. The April example finds 2 saved vacation days or 5 additional days off. The autumn example keeps the exact baseline useful while accurately showing no nearby improvement. The 21-day shift, 7-day extension, 28-day maximum length, and 3-options-per-group defaults remain unchanged. Bounds and their deployment settings are documented in the [runbook](runbook.md#phase-05-exact-date-comparison).

## Scope of this delivery

Search is still the default discovery task. Comparison adds a second task for a single break, preserves per-task drafts during the current page session, and uses explicit recalculation. Reloading the page starts a fresh anonymous frontend session, as in Phase 0. Suggestions describe vacation-day use; personal availability is not checked. Flights, destinations, booking, accounts, saved-trip retrieval, and broad proactive opportunity scans remain outside this phase.


## Architecture for future mobile support

Desktop is the supported experience. Keep mobile work focused on future presentation changes:

- `PlanningFields` and the shared planning model serve both journeys; validation and session context do not depend on viewport size.
- `ComparisonWorkspace` owns request/draft/recalculation behavior. `ComparisonResults` and `WindowSummary` render the same typed server data for any layout.
- Exact accounting, feasibility, candidate discovery, and deltas stay in backend domain modules. A new layout must not duplicate those calculations.
- Baseline and alternative regions, semantic metrics, and day labels use flexible CSS layouts. Existing breakpoint groundwork remains, but there is no separate mobile state machine, API, or forked component tree.

A future mobile project can adapt navigation, density, date controls, and layout and then add device-specific acceptance checks without replacing the core behavior.

## Calendar follow-up (P05 F02)

Adds U.S. federal holidays and England & Wales bank holidays to the shared Search/Compare calendar selector. See the [runbook](runbook.md#supported-holiday-calendars) for precise scope, official fixture sources, and API compatibility.

- TDD: production U.S. and England & Wales calendar tests failed before support was enabled; UI options/default-weekend and custom-weekend tests failed before their implementation.
- Backend: 157 tests passed with disposable PostgreSQL; Ruff formatting/lint and mypy passed. The existing Pydantic AI deprecation warning remains.
- Frontend: 36 tests passed; ESLint, Prettier, TypeScript, and Vite production build passed. Both manual comparison and Search-to-Compare journeys cover all three calendars.
- Live desktop check: U.S. July 2027 Search returned July 3–5 at zero vacation days. Opening Compare retained that cost and showed July 5 as a public holiday.
- Live desktop check: switching the comparison to England & Wales for August 27–30, 2027 returned four total days and one vacation day used; August 30 was shown as a public holiday. The expanded settings fit the desktop layout with the scope label visible.
- Local frontend API health check passed after rebuilding both app services. Existing database volumes were retained.
