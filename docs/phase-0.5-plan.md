# Phase 0.5: compare vacation dates

**Status:** Proposed product and implementation plan, for review before implementation

**Starting point:** PR #34 (`codex/phase0-accurate-no-account-copy`)

**Delivery:** A new stack of small PRs based on #34 and then on each preceding Phase 0.5 PR. Nothing in this plan requires merging the Phase 0 stack into `main` first.

## Product outcome

Help someone decide whether the dates they have in mind are a good use of their vacation balance. They can start with dates they chose or with any date option in the existing search results. The app calculates exactly which days consume vacation balance, then shows nearby alternatives that either:

1. Give the **same length of break for fewer vacation days**; or
2. Give a **longer break for no more vacation days**.

The comparison explains the change in dates, vacation days used, total days off, and remaining balance. It does not claim the person is available to travel on an alternative date. The current Search, ranked results, grouped alternative dates, interpretation, and feedback remain available with their present behavior.

This phase focuses on one break. Annual leave allocation, destinations, flights, booking, calendar export, accounts, and the previously planned broad proactive opportunity scan are outside Phase 0.5. A bounded nearby-date view belongs to comparison; it is not a replacement for the later proactive scan across a wider future horizon.

## Decisions made in the design discussion

- Both entry points lead to one comparison experience: **Compare nearby dates** on a result and **Compare dates I have in mind** from the planning workspace.
- Moving a break keeps its length fixed by default. A person can deliberately change either endpoint to explore a different length.
- The product offers two distinct improvement goals rather than one opaque “best” alternative: save vacation days at the same length, or gain days off for no more vacation days.
- The existing explicit Search remains the primary discovery path. Comparison is an additional task, with its own explicit action.

## User journeys and interaction contract

### A. From a recommendation

1. Search exactly as in Phase 0. Each ranked card and each disclosed matching date can open **Compare nearby dates**.
2. The chosen dates become the visible **Your dates** baseline. The current search inputs supply balance, calendar, and weekend pattern. If the person changes those inputs in comparison, the frontend creates a new anonymous session for that context while retaining the original Search response and session token. The saved Search snapshot is never rewritten.
3. The comparison opens with a compact date calendar and a side-by-side summary. Working days charged to the balance, nonworking days, and observed holidays have distinct labels and patterns. The calendar is informative; the metrics are readable without interpreting color.
4. Two clearly named groups show nearby improvements, each with its exact difference from the baseline. Selecting an option updates the side-by-side view while preserving **Your dates** and a one-action return to the original.
5. Moving the date range as a unit preserves length. Editing start or end is an intentional length change. The UI distinguishes edited inputs from the last calculated comparison and uses an explicit **Update comparison** action. Preset shift controls are explicit actions too.
6. Closing comparison returns to the intact search results, scroll position, and feedback state.

### B. From dates already in mind

1. Choose **Compare dates I have in mind** without entering a search month or ideal trip length.
2. Enter inclusive start and end dates plus the shared vacation balance, country calendar, allowed-negative setting, and weekend pattern. AI interpretation is optional and is not required for this path.
3. Submit **Compare dates**. The exact baseline is shown even when it exceeds the available balance, with a clear warning; suggested alternatives must obey the allowed balance policy.
4. The same workspace, labels, improvement goals, and adjustment controls from journey A apply.

The two entry points share one comparison component and one backend contract. Switching between Find dates and Compare my dates preserves each form's draft values within the current page session. A comparison request does not rerun Search or alter its result order.

## UX quality bar

- The workspace has a predictable reading order: **Your dates** and its exact cost first, then the two improvement groups, then the detailed day-by-day view. On wide screens the baseline stays in view beside the selected alternative; on narrow screens the same information stacks without hiding the baseline behind a tab.
- Lead with the concrete outcome: **“Same 8 days off, 2 fewer vacation days”** or **“2 more days off, no extra vacation days.”** Dates and calendar context immediately support the claim. Show the 0–100 Search score only on Search cards; do not reuse it for comparison, where the user's goal and baseline are different.
- Keep **Your dates** visible while exploring suggestions. Never silently replace the baseline or make a selected alternative appear to have been the person's original choice.
- Explain charged dates, not only totals. Use date-only values, inclusive endpoints, and the same effective weekend and observed-holiday calendar as Search. Name an observed holiday only if the provider supplies a verified name; otherwise label it “Public holiday.”
- Show the size of the move (for example, “starts 3 days later”) so a large shift cannot masquerade as a small improvement. State that work and personal availability on suggested dates have not been checked.
- Show the best few *distinct* alternatives in each group; do not fill the view with adjacent near duplicates. If there is no improvement within the bounded neighborhood, say so plainly and keep the exact baseline useful.
- Design desktop and mobile deliberately, including the shared input form and existing Search results needed to reach comparison. Calendar cells, date inputs, and alternative cards must work with keyboard, touch, and screen readers. Do not require drag gestures. Test focus return, announcements for recalculation, contrast, and reduced motion.
- Preserve the Phase 0 visual language while giving comparison a clear visual identity: a persistent baseline, emphasized deltas, and a legible day-by-day strip. Review real rendered states before calling the UI complete.

## Calculation and API design

### One source of truth for day accounting

Extract a pure exact-window evaluator from the current generator's inline day-counting logic. Given inclusive start/end dates and an effective calendar, it returns total days, charged working dates, observed holiday dates, vacation days used, and remaining balance. Search generation and comparison both call it. Keep the existing Phase 0 scorer, ranking, and generator safety behavior unchanged.

An exact baseline is evaluated even if it uses more leave than permitted, so the person learns its real cost. Such a baseline is labeled over budget, not presented as a feasible recommendation. Alternatives must be future dated and within the current balance plus the explicit allowed-negative allowance. A negative remaining balance always carries the existing warning semantics.

### Bounded alternative discovery

Use a separately versioned comparison policy. Proposed POC defaults, to be verified with representative calendars:

| Bound | Initial value | Reason |
| --- | --- | --- |
| Baseline length | 1–28 inclusive days | Covers common single breaks while limiting input and rendering cost |
| Start-date movement | Up to 21 days earlier or later | “Nearby” is large enough to encounter adjacent holiday patterns |
| Extra length | Up to 7 days, maximum 28 total | Finds a meaningful extension without turning comparison into broad search |
| Display | Up to 3 distinct options per improvement goal | Keeps the decision readable |

The exact values are policy settings, not scientifically established preferences. Candidate enumeration is bounded before scoring and never returns a partial shortlist as “best.” Search candidates must be on or after the user's current local date; a baseline whose start is in the past receives a clear validation error. Cross-month and cross-year dates are allowed. A shorter or longer range the user enters manually is evaluated exactly, even when it is outside the original Search length tolerance.

For **same length, fewer vacation days**, consider the baseline's exact length at nearby start dates and require strictly lower vacation-day use. For **longer, no more vacation days**, consider 1–7 extra days at nearby starts and require vacation-day use no greater than the baseline. Both groups enforce the allowed balance, remove the baseline, and deduplicate identical windows. Rank each group first by the stated gain, then by smaller date movement, then by stable date order; select distinct outcomes so one holiday pattern does not occupy every slot. If an option both lengthens the break and saves leave, show both gains in its explanation. Do not use the Phase 0 0–100 score to rank these goal-specific groups.

### Contract and persistence

Add authenticated `POST /comparisons`. The request includes exact baseline start/end dates and, optionally, the originating Search ID for traceability; it does **not** require a selected month, preferred length, or client-supplied comparison bounds. The server loads the effective context from the anonymous session and owns the policy limits. If a Search ID is supplied, the server verifies session ownership. The response contains the exact baseline, its feasibility status and charged-day detail, two named alternative collections, deltas relative to the baseline, effective policy version, and notices. Use typed request/response models and machine-readable error codes. The server remains authoritative for all leave calculations.

The service reuses the existing calendar provider and anonymous session authorization. It saves an immutable comparison input/output snapshot tied to the anonymous session, separately from Search snapshots and feedback. Persist the effective calendar and comparison policy needed to reproduce an output. Do not store new personal data beyond dates and current planning inputs. An expired session yields a recoverable error; the frontend can retain the unsent draft and create a new session when the person explicitly retries.

Use the person's local calendar date consistently for future-date checks in both paths. Phase 0 currently derives `today` from an injected UTC clock. Add an optional validated IANA time-zone name to anonymous session creation, supplied by the browser, and derive `today` from the injected clock in that zone. Existing clients without this field use the supported calendar's documented default zone (Israel: `Asia/Jerusalem`). This changes the future-date boundary only when UTC and the effective local date differ; test that case explicitly. It does not introduce time-of-day or trip time-zone calculations.

## Edge cases to resolve in code and copy

| Situation | Expected behavior |
| --- | --- |
| Same dates as baseline | Never listed as an alternative; “0 saved” is not a gain |
| Baseline costs more than balance plus allowance | Show its exact cost and over-budget status; only feasible nearby alternatives may be suggested |
| Baseline uses zero vacation days | No “fewer days” group; a longer break using zero may qualify |
| No nearby improvement | Keep the day-by-day baseline and state that none was found within the shown search radius |
| An alternative starts outside the original selected month | Allowed, labeled as a nearby date change; original Search results remain unchanged |
| A holiday or workweek override changes | Recalculate baseline and alternatives together; discard stale comparison results until Update comparison completes |
| Calendar or comparison service unavailable | Keep entered dates and original Search results; show a recoverable error |
| A grouped Search card has other matching dates | Each displayed date is independently selectable as the comparison baseline |
| Exact dates cross a month/year boundary or a daylight-saving change | Use inclusive local **dates**; no hour arithmetic |
| Several alternatives have the same gain | Prefer a smaller move and then stable date order; retain meaningful variety |

## Ordered PR breakdown

Each task gets one stacked PR by default. Do not assign PR numbers until they exist. Keep each tip runnable and run the normal backend and frontend quality gates. The first Phase 0.5 task PR follows this planning branch, which itself is based on PR #34. Record each real PR and its status in the [delivery progress tracker](progress.md).

### Test-first delivery rule

For each behavior PR, pick one observable behavior, write a failing test at a confirmed public seam, implement only enough to pass it, and repeat for the next behavior. Review and refactor after the red-to-green cycles. Keep the test and implementation together in that PR. Expected date counts and deltas come from independently worked calendar examples, not from duplicating the implementation's calculation in the test. Do not postpone the first end-to-end test until the final PR; add journey coverage as soon as a journey becomes usable. P05 01 is a design artifact, so its review gate is a realistic clickable or inspectable walkthrough rather than a code test.

**Proposed test seams to confirm before implementation:** the public exact-window evaluator and existing Search workflow; `POST /sessions`, `/recommendations`, and `/comparisons`; the comparison snapshot repository's public operations; and the rendered Search and comparison journeys. Tests should assert public outputs and user-visible behavior, using fake calendars or provider boundaries as needed, without mocking private helpers or querying storage as a substitute for the service interface. Migration tests are the exception that directly inspect schema behavior.

| Order | Task | Deliverable and main acceptance evidence |
| --- | --- | --- |
| 1 | P05 01 — Comparison UX prototype | Produce reviewable desktop/mobile wireframes, screen copy, calendar/day-type language, keyboard path, and states for no improvement, over budget, and failures. Walk both entry journeys with realistic date fixtures before backend contract and frontend implementation. |
| 2 | P05 02 — Shared exact-window accounting | Extract one pure evaluator for Search and comparison. Golden and property tests prove unchanged Phase 0 results, observed holidays, weekend overrides, inclusive edges, cross-year dates, and zero-PTO windows. |
| 3 | P05 03 — Local-date context | Add optional validated IANA time zone to anonymous sessions, a documented calendar-zone fallback for old clients, and shared local-date clipping. Migration and fixed-clock tests cover midnight boundaries and unchanged date-only accounting. |
| 4 | P05 04 — Comparison policy and contracts | Versioned bounds, typed baseline/alternative/delta models, validation, and deterministic goal-specific ordering rules. Contract tests cover invalid ranges and stable serialization. No endpoint or UI yet. |
| 5 | P05 05 — Exact baseline service and API | Authenticated `POST /comparisons` evaluates arbitrary valid future dates, including an over-budget baseline, without Search month/length inputs. API tests cover authorization, Search-origin ownership, errors, empty groups, and unchanged `/recommendations`. |
| 6 | P05 06 — Comparison snapshots | Add a migration and repository for immutable comparison inputs, effective calendar/policy, and outputs. Migration up/down and PostgreSQL tests prove reproducibility and session isolation. |
| 7 | P05 07 — Nearby improvement discovery | Add both bounded candidate groups, deterministic ranking, variety, explanations, and cap behavior. Fixed-calendar tests cover all edge cases above, especially zero-PTO and no-improvement cases. |
| 8 | P05 08 — Shared frontend context and both entry points | Keep Search as the default task. Add Compare my dates without requiring month/length and Compare nearby dates on every visible Search date, including grouped alternatives. Component tests prove draft retention, session-context changes, no implicit Search, and intact feedback. |
| 9 | P05 09 — Comparison workspace | Build responsive baseline/alternative layout, date and day-type view, explicit shift/edit/update actions, two goal groups, deltas, no-improvement and error states. Accessibility and interaction tests cover keyboard, focus, screen reader labels, and stale-result handling. |
| 10 | P05 10 — End-to-end experience and hardening | Exercise manual and Search-origin journeys against the real backend and PostgreSQL, verify both paths use the same accounting, review 1,440-pixel desktop and 360-pixel mobile states across Search and comparison, measure response time, and fix UX or regression gaps. Phase 0 acceptance tests remain green. |

P05 07 may be split into separate backend PRs for the two improvement goals if review size warrants it; each would keep a typed complete response and tests. P05 08–09 can be split along user-visible vertical slices if the frontend diff becomes too large. The stack order remains the dependency order above.

## Exit gate and product review

- A person can compare dates they entered or dates opened from any visible Search option without losing the original search or its feedback state.
- Exact dates and every displayed delta match the effective calendar and leave balance. The two improvement groups satisfy their literal promises.
- A person can answer, from the UI alone: which dates changed, how many days off they gain, how many vacation days they save or spend, and which exact dates are charged.
- No-improvement, over-budget, zero-PTO, expired-session, provider failure, and changed-input states are understandable and recoverable.
- Desktop and mobile views pass a deliberate visual review; keyboard and screen reader navigation do not depend on the graphical calendar.
- Existing Phase 0 API, interpretation, ranking, grouped results, feedback, and test journeys keep working.
- The plan's 21-day and 7-day defaults are checked against representative real holiday cases before release; any change is documented with its effect on suggestions and response time.

## Stress test of the proposal

- **Could this just be another ranked search?** No. Search answers an open-ended question from month and preferred length; comparison evaluates one exact baseline and communicates the gain from nearby changes. Separate contracts and presentation keep those meanings clear.
- **Could “better” be misleading?** Yes, because we do not know school, work, or family constraints. The UI calls alternatives “nearby improvements in vacation-day use,” shows the date movement, and never asserts personal availability.
- **Could an infeasible baseline disappear?** It must not. Its exact cost is central to the value of the comparison. Feasibility and recommendation eligibility are separate.
- **Could the two paths disagree about charged days?** The shared pure evaluator and cross-path golden tests are required before building the new API.
- **Could a visually rich calendar hide the answer?** The outcome sentence, numeric deltas, explicit charged-day list, and accessible comparison table all work without color or gesture interpretation.
- **Could this expand into Phase 1 opportunity detection?** The bounded neighborhood is anchored to the person's chosen dates. Broad out-of-criteria discovery remains a separately planned feature.

No critical product decision is currently pending. This proposed plan should be reviewed before implementation; implementation can refine policy bounds with test evidence without changing the agreed two-goal product behavior.
