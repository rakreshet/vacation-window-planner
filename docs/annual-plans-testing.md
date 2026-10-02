# Annual planning test strategy

**Status:** Public seams and acceptance criteria approved through the merged [AP 00](annual-plans-plan.md) and the user’s subsequent instruction to implement strictly to the plan using TDD. The [UX walkthrough](annual-plans-ux.md) supplies inspectable states; the [progress table](progress.md#annual-planning--several-vacations-one-budget) records delivery.

## TDD agreement and cycle

The TDD skill requires agreement on seams before tests are written. Review these seams with the plan; if later implementation authorization does not confirm them, resolve only the changed/unclear seams before writing tests. Do not treat this docs PR or its merge as implementation authorization.

Each behavior slice is one observable failing test → verify the intended failure → minimum implementation → focused passing check. Repeat within the same PR. Do not write a bulk speculative suite, test private DP tables, mock internal annual helpers, or add tests that merely repeat the implementation. Review-stage refactors need existing behavioral coverage. Use literal expected dates/costs or an independent exhaustive oracle, not the production assessor/optimizer to compute its own expected result.

## Proposed public test seams

| Seam | What the tests observe | Dependencies/evidence |
| --- | --- | --- |
| Pure annual `plan_year` interface | Input validation, full/reduced/conflict/cap outcomes, exact whole-plan accounting, objectives, locks and deterministic facts | Fixed local date, resolved fake calendar facts, injectable work/deadline budget; real shared assessor |
| Existing shared assessment interface | Parity only if annual work changes shared date classification/indexing | Literal effective day fixtures and existing Search/Compare regression tests |
| Annual workflow and HTTP routes | Session context, request/response variants, calendar coverage, fresh costs, operational errors, snapshot-required success | Real workflow with test PostgreSQL and fake calendar/clock; no mocked optimizer |
| Annual-run repository interface | Immutable complete snapshot round trip, rollback on flush/commit, session linkage | Disposable PostgreSQL; repository read interface, not raw tables for ordinary behavior |
| Annual interpreter proposal interface | Presence-aware editable patch, strict model output, unresolved references, safe provider failure | Fake model/provider at external seam; no paid/live calls in CI |
| Browser saved-annual-plan module | Full record validation, identity, limits, read/write/remove/restore and cross-tab behavior | In-memory storage adapter plus browser localStorage journey tests |
| Plan action/export interface | Selected immutable snapshot, aggregate copy, multi-event calendar serialization, privacy defaults | Independent ICS parser and clipboard/download system adapters |
| Rendered annual/Saved/App journeys | Visible form, interpretation review, plan choice, lock/recalculate, errors, stale/late response, task restoration and keyboard actions | React Testing Library with HTTP adapter responses; live Docker journey at integrated milestones |
| Migration contract | Fresh upgrade/downgrade and schema/index/constraint correctness | Dedicated disposable `vacation_test` database; direct schema inspection allowed here |

Keep test names in the [domain language](../CONTEXT.md). Do not create a repository retrieval HTTP route solely to enable testing. Use a controlled database failure at the persistence seam to prove rollback, not a mock of the internal planner. Fix clock/time zone and monotonic work-budget behavior for reproducibility; do not make correctness depend on machine speed.

## Core behavioral matrix

| Area | Cases and independent expectation | First PR |
| --- | --- | --- |
| One budget | UX fixture A: 17 away, 8 leave, 10 remain, 3 reserve, 7 unallocated; balances 16/15/10 | AP 01 |
| Reserve | B=18/R=3/used=12 gives remaining=6, unallocated=3; no double reserve subtraction; locks costing 5 against B=7/R=3 give shortfall 1 | AP 01 |
| Lock integrity | Preserve IDs and exact dates; return all overlap/unavailable/gap reasons; future lock notice exception; reject past, underway, duplicate and cross-year locks | AP 01 |
| Calendar accounting | Extra working holiday/weekend, personal day off, ordinary weekday, overlapping raw holiday/weekend; no double charge; unavailability independent of cost | AP 01/02 |
| Bounds | Strict integers (reject booleans/fractions), max six slots, exact-date 1–28 versus generated 3–28, unique IDs, reserve<=balance, year range and sorted/canonical dates | AP 01/04 |
| Complete generation | Every allowed start/length pair, selected start-month semantics, year-end end clamp by rejection, leap day, local-today/notice inclusive edge | AP 02 |
| Separation | Exact seven-date gap passes; six fails; all-nonworking gap fails at zero minimum; no required trailing gap after final break | AP 02 |
| Joint optimization | Greedy counterexample below; complete slot assignment; all-locked/one-slot; zero-cost candidates with zero available balance | AP 02 |
| Determinism | Repeat input gives same dates/facts; nonsemantic rule ordering and equivalent slot permutations cannot manufacture different plans | AP 02/03 |
| Objectives/diversity | Literal objective optima; safe ties; one changed material interval; novelty against every prior plan; fewer than three is valid; locks do not create novelty | AP 03 |
| Reduced mixes | Full search proven infeasible first; maximize retained count then visible priority; all locks/reserve retained; omit whole unlocked slots only; lock-only permitted, empty result not a plan | AP 03 |
| Resource honesty | Exhaust each pair/state/transition/deadline cap through the public work budget; no partial plans or false infeasible result; cumulative work across alternative/diagnostic passes | AP 02/03 |
| Explanation truth | Exact cost shortfall only from completed diagnostic; combined structural conflict not falsely attributed to budget; missing slots match reduced output | AP 03 |
| Current saved dates | Historical August cost 4 reassessed to 5 under current calendar; stale saved budget/overrides never enter annual math | AP 04/05 |

Use property-based tests over small bounded calendars for invariants: no overlapping intervals, no duplicate charged date, reserve preserved, all locks unchanged, selected intervals in year, slots filled exactly once, day-detail counts and aggregate totals agree, no invalid reduced plan. Properties supplement literal fixtures and the oracle; they do not replace objective checks.

## Independent optimizer oracle

Implement a deliberately small exhaustive oracle in test support after seam approval. It enumerates all date intervals and all combinations/slot assignments for small synthetic horizons (for example, 7–21 dates, 1–3 slots), using a simple independent working/nonworking bitset and direct set operations. It must not call production generation, assessment, DP, pruning, scoring or diversity functions. Compare through `plan_year`; use unavailable dates to restrict the annual input to the oracle horizon.

Compare complete candidate feasibility, full optimum and ties, min-leave objective, the exact novelty predicate, maximum retained subset and priority, and no-plan proofs. For results with operational timestamps/IDs, compare stable semantic facts. Exhaust small input families and seeded generated cases; shrink failures and retain useful counterexamples. Tiny exact fixtures are the proof backstop; performance fixtures are separate and cannot decide correctness by timeout.

### Greedy counterexample with literal dates

Injected local today January 1, 2027; Friday/Saturday weekends; **every January date is unavailable except Jan 1–3, Jan 7–9, and Jan 20–23**, and all other months are disallowed starts. No public holidays or overrides. Two unlocked slots each require 3–4 days, gap=0 plus one effective working date, available=2 and reserve=0.

- A: Jan 20–23 is 4 days away and costs 2 (Jan 20/21).
- B: Jan 1–3 is 3 days away and costs 1 (Jan 3).
- C: Jan 7–9 is 3 days away and costs 1 (Jan 7).
- The individually longest A leaves no budget for a second break. B+C fills both slots with 6 days away for 2 leave. There is no zero-cost three-day interval inside those permitted islands.

The full-mix optimum is B+C. Production Search ranking is irrelevant. With available=1, the full mix is proven infeasible and the reduction retains the first priority slot with one three-day break costing 1; the earliest tie is Jan 1–3. With both slots locked to B and C and available=1, return a lock-budget conflict rather than a one-lock reduction.

### Red/green slices to begin with

1. AP 01: assess one exact August lock and the reserve against independently listed working dates. Then add one conflicting rule at a time through the same interface.
2. AP 02: generate one slot under a tiny available-date island. Then add the two-slot counterexample, spacing, and a deterministic cap. Each test must fail for its new behavior before implementation.
3. AP 03: make the counterexample budget insufficient; first prove full-mix failure, then add one correctly labeled reduction; then add a distinct-plan fixture and cumulative limits.
4. AP 04: submit the established fixture through authenticated HTTP and retrieve its snapshot through the repository interface. Then inject a commit failure and verify no success or persisted run.
5. AP 05+: extend one observable journey at a time. Do not assert internal React state or exact helper-call ordering.

## Integration, persistence, and interpretation

| Scenario | Required evidence |
| --- | --- |
| Session and calendar | Annual request uses its owning immutable context and IANA local date; unsupported calendar/expired token/nonzero annual allowance rejected correctly; calendar change uses a fresh session |
| Snapshot | Full/reduced/conflict/cap response equals persisted semantic output; provider calendar, coverage, budget, policy, versions, clocks and counters are recoverable |
| Failure | Validation/provider failure produces no fabricated run; flush or commit failure rolls back all run data; a subsequent clean request succeeds |
| Concurrency | Two active planning calls permitted per process; next call gets typed retryable busy; permit released on success/error/cap; deadline does not block the server indefinitely |
| Schema | Upgrade after actual stack head and downgrade cleanly against disposable PostgreSQL; no invented legacy backfill requirement |
| Interpretation | Missing reserve leaves it unchanged; explicit zero applies; unknown fields/invalid dates rejected; model cannot trigger generation or select saved records |
| Ambiguity | “My August trip” remains unresolved until local explicit selection and slot mapping; proposed mix cannot silently drop existing locks |
| Stale proposal | Edit while provider is pending; old proposal cannot overwrite current fields without fresh review |
| Privacy | Tokens and interpretation text absent from browser records/export/logs; unrelated saved entries never sent to interpretation or optimizer |

## Frontend and browser journeys

Use fixed wire fixtures derived from independent examples and runtime-schema checks for all outcome variants. Preserve existing `App.test.tsx`, `SavedJourney.test.tsx`, saved-options/export tests, and backend Phase 0/0.5/0.75 acceptance suites. Add annual tests in focused files without copying existing tests wholesale.

Required journeys:

1. Structured plan without a model key → valid complete results → select another plan → totals, list and year view agree.
2. Select saved August dates into the long slot → current cost replaces the historical cost → bookmark remains unchanged.
3. Lock a generated break → no network call until Recalculate → every lock unchanged, only unlocked dates may move → accurate running balance.
4. Change reserve/calendar/months while results or a copy preview exist → mark stale and prevent action bypass → obsolete responses ignored.
5. Infeasible mix → visibly reduced result and omissions → selecting it preserves original request → Use reduced mix creates a new explicit draft.
6. Conflicting locks, calculation limit and provider outage → distinct copy/recovery, intact draft and locks.
7. Save one whole plan → reload after server session expiry → historical offline view → explicit recalculate restores original request/time zone/lock state → Back restores prior annual workspace.
8. Duplicate/rename/remove/Undo, unsupported/corrupt record, storage denied/quota/count limit, independent multi-tab writes and same-record refresh → no false success or unrelated loss.
9. Switch annual/Search/Compare/Saved → preserve drafts/results/feedback/focus; standalone Compare never masquerades as an annual replacement.
10. Interpret → review optional fields and preset assumptions → resolve saved reference → Apply → explicit Generate; provider failure leaves structured controls usable.

Inspect live Docker journeys beginning in AP 05, with a real backend and PostgreSQL, and extend at AP 06/08/09. Test keyboard-only operation at 1,440 and 1,024 px, focus placement/return, error summaries, announcements, contrast and text equivalents for the year view. Capture named screenshots in the later acceptance record, distinguishing live evidence from automated or designed states.

## Export acceptance

Independently parse the multi-event `.ics` with existing `ical.js` support. Assert one event per selected break, all-day starts and exclusive next-day ends, stable distinct UIDs across reload/rename, tentative/transparent flags, CRLF, UTF-8 folding/escaping, correct year/leap/DST behavior and no credentials/balance by default. The frontend must never include an omitted break or use another plan's dates. Whole-plan copy contains unique charged dates and the exact aggregate cost, with reduced-plan disclosures and selectable fallback.

Real browser file delivery and import into Google Calendar desktop plus another client remain acceptance checks, not substitutes for parser tests. Existing Phase 0.75 client checks are still pending; do not claim they passed. If a client is unavailable during later implementation, document the exact unverified portion and keep release acceptance conditional rather than silently broadening claims. No calendar invitations or external messages are sent by this task.

## Performance and completeness gate

Record calendar, hardware/runtime, candidate/state/transition counts, peak process memory, complete/capped status, and cold/warm timings. Proposed release target is warm p95 <= 2 seconds for the annual request end to end on local Docker over at least 20 runs per normal fixture, with the planning engine's hard 5-second deadline exercised separately. Frontend perceived latency includes loading/retained-draft behavior. These are targets, not achieved measurements.

Benchmark IL, US and GB calendars with: the default three-slot all-month mix; six slots with broad lengths and zero-cost islands; a dense personal calendar (up to the existing range limits); locked intervals and a tight reserve; a late-current-year request; and an infeasible reduction request requiring multiple passes. Normal three-slot fixtures must complete, not merely hit a cap safely. For intentionally extreme cases, a typed cap is valid but cannot be reported as an optimized result. Validate state/work accounting and bounded concurrent load without fragile exact-time unit assertions.

If normal cases miss the target or cap out, measure before changing data structures or bounds. Optimize shared-assessment reuse and sparse states under the same oracle. Any heuristic, reduced horizon, altered length bounds, changed diversity or loss of completeness needs a revised plan and user review. Never remove bounds to obtain a benchmark pass.

## Checks and completion evidence

For AP 00: review content against the handoff and confirmed decisions, check local Markdown links/anchors and whitespace, verify the diff changes documents only, and open the planning PR against the verified stack tip. No application test run is claimed for a documentation-only change. GitHub's existing CI may still run and its actual status is recorded on the PR.

For each authorized behavior PR: use focused red/green checks while developing, then the repository's applicable required checks once ready. [README commands](../README.md#tests-and-checks) and [CI](../.github/workflows/ci.yml) are authoritative: backend pytest/PostgreSQL/migrations, Ruff format/lint and strict mypy; frontend Vitest, ESLint, Prettier, TypeScript and Vite build. Keep earlier phase regressions green. Do not repeatedly rerun unchanged passing suites without a new concern.

AP 10 records fresh results in `docs/annual-plans-acceptance.md` only when that work occurs: actual commands/commit, automated outcomes, browser screenshots/journeys, performance table, client-download/import evidence, and remaining limitations. The tracker uses In review for open implementation PRs and Done only for merged work with its definition of done satisfied. Historical test counts are never presented as new verification.
