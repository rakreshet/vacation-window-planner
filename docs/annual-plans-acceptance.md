# Annual planning acceptance — AP 10

Measured September 26, 2026. AP 01–09 are stacked review PRs #62–#70; AP 10 completes the implementation stack without merging it. Original review base: AP 09 `1b2950b`; subsequent AP09 CI test-query fixes are incorporated through the dependent branch. The application changes and evidence in this PR are the acceptance candidate. The prerequisite Phase 0.75 stack is still required. See [progress](progress.md#annual-planning--several-vacations-one-budget) and the [approved test matrix](annual-plans-testing.md).

**Conditional release acceptance:** automated correctness, normal-request performance, resource limits and the recorded browser journeys pass. Actual calendar-file delivery from the in-app browser and imports into Google Calendar plus a second client remain unverified. This is not a claim of complete export-client acceptance.

## Fresh required checks

| Check | Result |
| --- | --- |
| `docker compose --profile test run --build --rm backend-test` | 269 passed, including PostgreSQL persistence, migrations, oracle, provider failures and concurrency; one existing Pydantic AI event-loop deprecation warning |
| `backend/.venv/bin/ruff check backend scripts/measure_annual.py` | Passed |
| `backend/.venv/bin/ruff format --check backend scripts/measure_annual.py` | Passed, 97 files |
| `cd backend && .venv/bin/mypy src` | Passed, 42 source files |
| `backend/.venv/bin/mypy --strict scripts/measure_annual.py` | Passed |
| `cd frontend && npm test` | 122 passed in 22 files |
| `npm run lint`, `npm run format:check`, `npm run build` in frontend | Passed; build includes TypeScript checking and Vite production output |

AP 10 added red/green rendered regressions for invalid reserve, invalid break bounds, server locked-date errors, empty balance, conflict repair links and unfinished personal-calendar edits. A separate failing storage regression established that an invalid saved time zone could be reopened and crash; validation now isolates that record. No backend optimizer changes or limit increases were necessary. Review also fixed the acceptance-test clock and replaced the collapsing dense fixture. AP09 CI exposed a five-second timeout in the complete saved-plan journey; scoped panel queries and a ten-second integration-test ceiling preserve its assertions while allowing slower runners.

## Performance gate

Host: Apple M5, 32 GiB RAM, macOS 26.6 arm64. Docker: 10 CPUs, 8,321,712,128 bytes allocated; Linux 6.12.76 linuxkit aarch64, Python 3.12.14. Driver: local Python 3.12.13. Calendar inputs are synthetic acceptance data for 2027, with the late-current-year fixture evaluated on September 26, 2026. IL uses Friday/Saturday; US and GB use Saturday/Sunday and their production provider calendars.

Measurements time the public annual HTTP request through persisted response and JSON decoding. Session creation is outside that timer. Each normal fixture has one first request followed by **20 warm requests**. The default cold measurements separately restart the backend before each country's first annual request; startup/readiness and session creation are outside the timer. The first request in the ordinary matrix is not described as a cold process.

The target is warm p95 <=2 seconds; all normal fixtures met it. A complete full mix is required for default/dense/locked/current-year fixtures. The deliberately infeasible reduction fixture must return a completed infeasibility proof and a nonempty reduced plan. Extreme cases must return unknown feasibility and no partial plans.

| Calendar | Fixture | Warm p95 (s) | Candidates / states / transitions | Outcome |
| --- | --- | ---: | --- | --- |
| GB | current-year | 0.338 | 982 / 24,358 / 672,868 | complete |
| GB | default | 1.717 | 3,930 / 117,485 / 3,773,542 | complete |
| GB | dense-rules | 0.729 | 3,930 / 47,208 / 1,400,694 | complete |
| GB | locked-tight-reserve | 0.076 | 1,086 / 19,509 / 112,084 | complete |
| GB | reduction | 0.011 | 31 / 4,606 / 4,608 | infeasible |
| GB | six-broad-slots-zero-cost-islands | 5.009 single run | 9,113 / 72,550 / 4,623,292 | too_broad (deadline) |
| IL | current-year | 0.353 | 982 / 25,215 / 676,369 | complete |
| IL | default | 1.515 | 3,930 / 105,193 / 3,286,105 | complete |
| IL | dense-rules | 0.739 | 3,930 / 47,858 / 1,420,143 | complete |
| IL | locked-tight-reserve | 0.090 | 1,086 / 20,119 / 125,517 | complete |
| IL | reduction | 0.015 | 31 / 4,606 / 4,608 | infeasible |
| IL | six-broad-slots-zero-cost-islands | 5.016 single run | 9,113 / 70,676 / 4,197,156 | too_broad (deadline) |
| US | current-year | 0.359 | 982 / 25,645 / 730,371 | complete |
| US | default | 1.802 | 3,930 / 122,320 / 3,959,726 | complete |
| US | dense-rules | 0.662 | 3,930 / 41,708 / 1,234,741 | complete |
| US | locked-tight-reserve | 0.094 | 1,086 / 22,033 / 131,477 | complete |
| US | reduction | 0.010 | 31 / 4,606 / 4,608 | infeasible |
| US | six-broad-slots-zero-cost-islands | 5.009 single run | 9,113 / 70,237 / 4,603,351 | too_broad (deadline) |

Fresh-process default timings: IL 1.236s, US 1.465s, GB 1.457s.

The dense fixture has 100 disjoint unavailable single dates on alternating days and 100 disjoint overrides on the intervening dates, alternating personal days off and extra working days. Every response is checked to retain 100 normalized ranges in each collection. Later dates remain open so all three requested breaks must fit. A preliminary adjacent-range fixture was replaced after review because normalization collapsed it; the table and raw evidence contain the corrected measurements. The six-slot extreme uses lengths 3–28, all months, available 366, reserve 3, and twelve seven-day personal-day-off islands. All three extremes exercised the five-second engine deadline. HTTP completion takes another 9–16 ms for outcome construction/persistence/transport; a five-second planning budget is not a five-second HTTP SLA.

Peak backend process resident memory (`/proc/1/status` `VmHWM`) was 201,252 KiB in the warm matrix. This is the process lifetime high-water mark, including earlier requests, not a separately attributable per-fixture allocation or a container memory limit. Fresh-process default high-water marks were 161,860 / 159,948 / 159,900 KiB for IL / US / GB. All measurements, every run's counters, inputs and effective policies are retained in [warm evidence](annual-evidence/performance.json) and [cold evidence](annual-evidence/performance-cold.json).

A live synchronized three-request stress check returned two `200 too_broad` responses with no plans and one `503 ANNUAL_PLANNER_BUSY`; see [concurrency evidence](annual-evidence/concurrency.json). The deterministic HTTP test separately proves permit release and clean retry. Resource-limit tests cover candidate/state/transition exhaustion and deadline behavior without machine-speed assertions. The exhaustive oracle remains the correctness gate for optimization; timing alone is not proof.

Reproduce against a disposable local Compose database after starting the app:

```sh
backend/.venv/bin/python scripts/measure_annual.py
backend/.venv/bin/python scripts/measure_annual.py --cold-restarts --output docs/annual-evidence/performance-cold.json
backend/.venv/bin/python scripts/measure_annual.py --concurrency --output docs/annual-evidence/concurrency.json
```

These commands create synthetic anonymous sessions and annual snapshots. The cold command restarts the backend, briefly interrupting local requests. `--resume` can continue the same day's interrupted matrix; use a new output file for a new candidate/runtime or date. Calendar changes may alter exact results, so examine assertions before comparing a future year. The current-year fixture is date-sensitive and may cease to fit near year-end; the recorded September run is the late-year evidence.

## Integrated behavior and accessibility

| Acceptance area | Evidence and result |
| --- | --- |
| Global optimum and exact accounting | Independent small-calendar Cartesian oracle, literal greedy counterexample, full/reduced objectives and deterministic ties; aggregate reserve and running balance fixtures |
| Calendar correctness | Shared assessment, notice, leap/year boundaries, override precedence, unavailable dates, local date and all three calendar providers |
| Lock and stale-result integrity | Rendered lock/recalculate and late-response tests; live preserved-lock evidence in [browser record](annual-plans-browser.md); edits disable current-result actions and preserve previous results as stale |
| Failure separation | Authenticated HTTP tests for validation, provider, busy and transaction failure; immutable repository round trip/rollback and migration up/down |
| Interpretation | Fake provider at the external seam; optional proposals preserve absent fields and require explicit local reference/slot resolution; no generation on Apply |
| Browser persistence | Save/rename/remove/Undo, limits, corruption, quota and cross-tab journeys; live save/reload/reopen; historical/offline behavior covered through rejected HTTP and saved snapshots |
| Error recovery | Live keyboard submit with balance 18/reserve 19 focuses the reserve and exposes linked summary + inline description; draft remains intact; [1024px capture](annual-evidence/ap10-error-1024.png) |
| Reduced plans | Live IL available 1/reserve 0: two of three breaks, seven days away, one leave day, omitted long slot explicitly named; [1024px capture](annual-evidence/ap10-reduced-1024.png) |
| Multiple lock conflicts | Live Aug 6–14 and Aug 8–10 retains both locks; reports overlap and unique five-day lock cost against one available day; [1440px capture](annual-evidence/ap10-conflict-1440.png); Enter on Edit Break 2 focuses its fieldset |
| Keyboard and responsive structure | Existing AP06 details/Back focus evidence plus AP10 error/conflict links. At 1024 and 1440, document width equals viewport width. Month summaries and chronological charged-date details give non-color equivalents; no 365-control tab sequence |
| Export/copy | Independent ICS parser covers multi-event identity, escaping/UTF-8 folding, privacy, omissions, leap/year/DST dates. Rendered denial/quota/stale-preview/pending-copy tests and live preview capture |

The screenshots were inspected for layout and legibility. Keyboard focus and semantic output were checked with browser accessibility state; this does not claim a complete screen-reader or automated WCAG audit. Reduced-motion behavior uses the existing CSS preference and immediate details scrolling. No live paid interpretation call, real calendar account import, invitation, email or external notification was performed.

## Outstanding manual export gate

AP09's real Download action in the in-app browser did not yield its documented download event, and no matching file appeared in Downloads. Both the semantic button and native accessibility action were attempted. The parser and simulated download adapter establish file content and app action behavior; they do not establish delivery through that browser host.

Before claiming full export release acceptance, download a whole plan in a supported ordinary browser and record the resulting file. Import it into a disposable Google Calendar and a second client. Confirm each inclusive interval renders as an all-day event through its correct last date, tentative/nonblocking handling where supported, no invitation/attendee, reduced-plan disclosure, default budget privacy and stable identity on repeated export. Record client/version and any deduplication behavior; do not describe repeated import as synchronization. Google Calendar was signed out during earlier verification; no credentials or account changes were attempted. See the [export criteria](annual-plans-testing.md) and [server operations](annual-plans-server.md).
