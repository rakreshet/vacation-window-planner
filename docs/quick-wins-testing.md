# Budget playground and year card test strategy

Date: 2026-10-03. Companion: [implementation plan](quick-wins-plan.md). Implementation is authorized. The user explicitly confirmed all five public seams on October 3, 2026: “Use the recommended coverage and continue.” Behavioral implementation uses these confirmed interfaces.

## Confirmed public seams

| Seam | What tests observe | External dependencies allowed to vary |
| --- | --- | --- |
| `plan_year` and `compare_annual_budgets` | Primary/default outcomes, three fixed budgets, invariant inputs, exact costs, honest full/reduced/conflict/cap results | Fixed calendar, captured today and injected work-budget clock |
| Authenticated `POST /annual-plans/budget-comparison` | Session ownership/context, wire shape, one calendar/date, validation/provider/busy errors and clean retry | Real test session persistence, fake calendar/provider failure, controlled clock/concurrency |
| Rendered Annual workspace and App journeys | Explicit comparison, readable scenarios, no draft mutation until adoption, cancellation/stale states, prior-flow regressions | HTTP and browser storage only |
| `yearCardSvg(snapshot, options)` | Independently parsed artifact dates/content, selected plan, omissions, privacy and valid escaped XML | Fixed validated snapshot and options |
| Rendered year-card preview plus browser PNG/download adapter | Current/saved/offline behavior, opt-in details, focus, pending/invalidation/failure, delivered PNG | Browser image/canvas/file APIs; verify real rendering/download separately |

No tests for private DP, graph, scenario-builder, React-state or drawing helpers. No implementation-call ordering assertions. A fake external provider may expose the requested coverage as evidence of the provider contract; internal module calls are not mocked.

## Red green sequence

For each new behavior: write one test at its confirmed seam; run it and observe its intended failure; implement only that behavior; rerun to green; select the next slice based on that result. Keep tests and implementation in the same responsibility PR. Do not write the entire matrix first. Covered refactoring belongs to the later review stage.

Begin QW 01 with a literal synthetic calendar: Saturday/Sunday weekends, May 3 2027 nonworking, one 3–14 day May break, budgets 3/4/5 and no reserve. Expected first plans are May 1–6 (6 away/3 leave), May 1–9 (9/4), May 1–10 (10/5). These independently worked values do not call production assessment to derive expectations. Then add one invariant/edge/outcome at a time.

## Behavior matrix

| Area | Required cases | PR |
| --- | --- | --- |
| Objective reuse | Primary-only result equals default first plan under literal fixtures; default still returns existing diverse objectives; no primary-only novelty work claimed | QW 01 |
| Budgets | 3/4/5 jump; a plateau; zero and 366 boundaries; reserve excludes an invalid neighbor; all-locked dates unchanged | QW 01 |
| Invariants | Same slots, reserve, months, spacing, holiday/weekend/personal rules, today and locks; original request/context unchanged | QW 01 |
| Truth | Lower-budget infeasibility/reduction explicitly omits slots; locked shortfall is conflict; baseline-first cumulative cap retains complete earlier scenario, caps later ones without partial plans | QW 01 |
| HTTP | Valid bearer context; missing/expired session; invalid year/allowance/reserve/body; unsupported or unavailable calendar; captured local midnight; sanitized response | QW 02 |
| Resource workflow | Same annual gate, busy error/release/clean retry; resolved calendar once; one shared calculation budget; comparison does not create annual rows through the existing repository read seam | QW 02 |
| Playground | Explicit button only; Most days away explanation; all valid scenarios; full-mix deltas only; reduced/conflict/too-broad/error states; edge labels and unchanged result | QW 03 |
| Adoption and stale | Compare does not change draft/result/saves; adoption changes only budget and requires Generate; edit/select/navigation aborts or invalidates old work; obsolete response ignored | QW 03 |
| Artifact | Leap year, cross-month dates, every selected inclusive date once, exact locks, six breaks, reduced omissions, calculation date/timezone, selected alternate plan | QW 04 |
| Artifact privacy | Default omits all leave figures/private fields; opt-in includes correct totals/reserve; title escaped as XML text; no external image/font/script/link dependencies | QW 04 |
| Preview/export | Readable text equivalent; correct selected snapshot and filename; no export before ready; close/Escape restores focus; stale/replaced preview disabled; denied/null canvas/image error reports failure | QW 05 |
| Saved | Offline current snapshot render, historical disclosure, renamed title, unchanged stored record, switching saved/current plans cannot export the earlier capture | QW 05 |
| Acceptance | Real HTTP comparison, adoption/generation, current/saved PNG files, 1024/1440px layout and keyboard flow, existing journeys and no calendar-download controls | QW 06 |

Use existing backend annual fixtures and tiny independent examples. Extend optimizer oracle checks only where the new primary-only mode changes observable behavior. Do not create a second solver oracle or compare two copies of the same calculation. Parse SVG through a DOM/XML parser and inspect literal content/date labels; pixel/font/layout correctness needs actual browser rendering.

## Checks and evidence

At each relevant PR tip: backend pytest with disposable PostgreSQL, Ruff format/lint and mypy; frontend Vitest, ESLint, Prettier, TypeScript and Vite build as defined in `.github/workflows/ci.yml`. Use focused tests for each red/green cycle, then applicable full checks for the PR. Do not repeatedly rerun unchanged passing suites.

Use an isolated Compose test project; never reset the user's running database. Record failures and fixes, command results, commit and actual counts in the eventual `quick-wins-acceptance.md`. Historical annual acceptance is context, not fresh verification.

For comparison performance, record runtime/hardware, IL/US/GB calendar, three-slot inputs, warm timings (20 runs per normal fixture), complete/capped result and cumulative candidates/states/transitions. Target warm p95 <=5 seconds under existing five-second calculation budget. Extreme requests should cap honestly; concurrency should release permits on success/failure. Do not use exact elapsed-time assertions in unit tests.

Inspect real preview and downloaded PNG, including six-break/reduced/default-private/opt-in cards, in a browser. Verify image dimensions, legibility and inclusive endpoints. Record delivery separately from mocked anchor/canvas behavior. User sharing the downloaded file is outside the acceptance action; do not send it externally.
