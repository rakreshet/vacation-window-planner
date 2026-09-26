# Phase 0.75: personal calendars, opportunities, and saved options

**Status:** Design prepared for review; implementation has not started. This documentation PR does not authorize implementation. Start behavior work only after the user explicitly says the plan is ready.

**Baseline:** Phase 0 and Phase 0.5 delivered on `main`, including the documentation refresh in #49 (`b203ea6`). **Supported surface:** desktop, 1,024 px and wider; visual acceptance at 1,440 px. Mobile certification remains future scope.

**Companion documents:** [UX walkthrough](phase-0.75-ux.md), [delivery tracker](progress.md), [research](non-flight-opportunities-research.md), [PRD](prd.md), [HLD](hld.md), and [domain glossary](../CONTEXT.md).

## Outcome and scope

Help a person find vacation windows that respect their real calendar, discover useful alternatives beyond their explicit search, and retain or export a chosen option. This phase adds three capabilities to the existing Find dates and Compare my dates journeys:

1. Manual personal calendar controls shared by all calculations.
2. A separate Opportunities worth considering section produced after explicit Search.
3. Same-browser saved options, calendar-file download, and copyable leave-request details.

Annual allocation across several breaks, balance forecasting, reservations, approval workflows, accounts, public share links, cross-device recovery, connected calendars, school-calendar feeds, background scans, notifications, destinations, and flights are outside this phase. Saving several options does not combine their budgets or establish a vacation plan for the year.

## Decisions and proposed defaults

The user confirmed the first three decisions on September 26, 2026. The remaining rows are concrete design defaults proposed by this plan; they are reviewable together rather than unresolved implementation choices.

| Topic | Position | Basis |
| --- | --- | --- |
| Release scope | Personal calendars + proactive opportunities + save/export, before flight work | User confirmed |
| Persistence | Same browser, no account; export and copy included | User confirmed |
| Input and discovery | Manual calendar controls; opportunities only after explicit Search | User confirmed |
| Work calendar | Dated overrides for days off without using leave and for extra working days; retain editable weekends | Proposed default |
| Unavailability | Any intersecting date makes a suggested window ineligible, including a weekend or holiday | Proposed default |
| Notice | Whole calendar days from local today to the start of the entire window; default 0 | Proposed default |
| Company closures | A personal day off means no vacation balance is charged; mandatory leave allocation is deferred | Proposed default |
| Saving | A bookmark of an exact calculation; saving never charges, reserves, or approves leave | Proposed default |
| Ineligible baseline | Keep its accounting visible and permit saving/exporting with the recorded warnings | Proposed default |
| Reopening | Display the saved calculation; checking again is an explicit separate comparison | Proposed default |
| Opportunity scoring | Separate deterministic 50/35/15 policy, finite zero-leave handling, explicit threshold and bounded scan | Carries forward the planned Phase 1 policy |
| Existing ranking | Personal rules affect eligibility and cost; opportunity discovery never changes explicit Search ranking for the same submitted context | Preserves the existing product contract |

## Personal calendar rules

### Inputs and bounds

Extend the existing planning context with `personal_calendar`, defaulting to version 1 with empty arrays and zero notice:

| Field | Shape and meaning | Initial bound |
| --- | --- | --- |
| `date_overrides` | Inclusive start/end plus `kind = personal_day_off` or `extra_working_day` | At most 100 submitted ranges; each at most 366 dates |
| `unavailable_ranges` | Inclusive start/end dates when the person cannot take the break | At most 100 submitted ranges; each at most 366 dates |
| `minimum_notice_days` | Whole calendar days before the start of a recommended window | 0–90, default 0 |
| `schema_version` | Personal-rule representation version | 1 |

No recurring rules, free-text reasons, partial days, new countries, or new leave types. A single date is a range with identical endpoints. The existing request-body limit also applies. Validate date ordering and arithmetic overflow. Canonicalize overlapping or adjacent same-kind ranges and unavailable ranges; reject an overlap between opposing override kinds with a field-specific error. Serialize a merged run in deterministic chunks of at most 366 dates, so the canonical context remains valid under the same input bounds. Normalization must be idempotent and a create → snapshot → create round trip must succeed. Do not expand all user ranges in memory merely to validate overlaps.

Past exceptions may remain in a saved context and are ignored when outside a calculation's coverage; creating a fresh session from an old saved context must not fail solely because its exception dates have passed. If the country changes with overrides present, require a visible choice to keep or clear those date-specific overrides before submission. Preserve unavailable ranges and notice. Never silently transplant or delete the exception list.

### Cost and eligibility are separate

For every date inside the inclusive window, determine the effective cost in this order:

1. An explicit extra working day consumes one vacation day, even on a normal weekend or public holiday.
2. An explicit personal day off consumes zero vacation days.
3. An observed public holiday consumes zero vacation days.
4. A selected weekend weekday consumes zero vacation days.
5. Every remaining date consumes one vacation day.

Opposing overrides are invalid input, so precedence is not used to silently resolve user conflicts. Removing an override restores the provider/workweek rule. To work on a public holiday, the user adds an extra working day; this phase does not introduce a separate holiday-exclusion mechanism with different weekend semantics. The form explicitly explains that an extra working day overrides both holidays and weekends.

Unavailability does not change charged dates. A recommendation is eligible only when all three conditions hold: no unavailable date intersects it; its start is at least `local_today + minimum_notice_days`; its cost fits balance plus the existing explicit allowed-negative allowance. Apply these rules to zero-leave windows too. Capture local today once per operation, in the session's existing IANA time zone.

Search and opportunity candidates and comparison alternatives must be eligible. Compare's exact baseline remains visible when it violates these rules, with all applicable reasons. Existing hard validation for past baseline starts, reversed dates, and the comparison length limit remains. The old `feasible` comparison field now reflects all eligibility reasons; empty personal rules preserve its existing meaning and output.

Keep full-balance and allowed-negative warnings independently of unavailable/notice reasons. A blocked window is not necessarily over budget. Company shutdowns charged to leave are ordinary working dates for cost purposes; this phase neither reserves nor deducts their cost outside the selected window.

## Backend design

### Chosen module and alternatives considered

Use one pure window-assessment module beneath the existing Search and Compare workflows. Its interface is conceptually:

```text
prepare_calendar(base_calendar, planning_context, coverage, local_today)
    -> PreparedCalendar
assess_window(start_date, end_date, prepared_calendar, detail = summary | days)
    -> AssessmentSummary | WindowAssessment
```

This is an interface sketch, not implementation code. The module hides override normalization/precedence, day classification, cost, unavailability, notice, and balance eligibility. It accepts resolved provider facts and an injected local date; it performs no network or database work. Coverage is explicit; evaluating outside it is an error. Preserve sparse provider facts and interval rules internally rather than materializing every date between widely separated search months. Summary mode returns counts, window, eligibility/reasons, and warnings without charged-date/day-detail arrays; use it for candidate enumeration. Days mode adds exact charged dates and day rows for the baseline and displayed options, using the same classification implementation.

The existing `evaluate_window` interface may remain as a compatibility projection, but must delegate to the same accounting implementation. Search generation and comparison discovery must not independently reimplement eligibility or day classification. Enumeration and ranking remain separate because Search fit, comparison gains, and opportunities have different meanings.

Three designs were compared using the design skill:

| Design | Benefit | Decision |
| --- | --- | --- |
| Immutable session context plus a shared pure assessor | Reuses the current ownership and new-session-on-context-change model; centralizes calculation changes | Choose this, without a new revision table |
| Rules repeated on each Search/Compare request | Flexible per-request scenarios; reproducible when carefully snapshotted | Defer: duplicates confirmed context across request paths in this release |
| One command module replacing Search and Compare orchestration | Makes callers simple and hides all workflow details | Defer: broad refactor of working workflows adds little to the selected scope |

Calendar math is an in-process dependency. Keep the existing `PythonHolidaysCalendarProvider` and `FakeCalendarProvider` adapters at the provider seam. PostgreSQL snapshot writers remain workflow dependencies with database integration coverage. No new provider protocol, account system, or generic rule engine is needed.

### Assessment and response contract

`WindowAssessment` carries the existing window facts, exact `charged_dates`, remaining balance, eligibility, structured reasons, warnings, and ordered `day_details`. Each day records its date, charged flag, effective kind, raw holiday/weekend facts, and unavailable flag. Effective kinds are `working_day`, `weekend`, `public_holiday`, `personal_day_off`, and `extra_working_day`.

Eligibility reason codes are `unavailable_dates`, `insufficient_notice`, and `over_budget`, in that display order. Include relevant intersecting dates and earliest permitted start as structured facts. Return all reasons, not only the first. Preserve provider holiday dates and raw weekend membership as source facts, but use the effective kind and charged flag for current rendering. A forced-working Saturday must never be labeled a free weekend.

Add these fields without removing current result fields:

| Surface | Addition |
| --- | --- |
| `POST /sessions` request | Optional `personal_calendar`; missing means empty rules |
| Search/Compare response | `calculation_context`: sanitized canonical planning context, calculation timestamp, local today, and accounting version; no token or source text |
| Search recommendation | When action details are requested, `assessment` for its representative, plus `alternative_assessments` for each returned `alternative_window`, matched by exact dates |
| Compared baseline/alternative | Nested `assessment` carrying day details and reasons, preserving current window/delta fields; existing `feasible` equals `assessment.eligible` |
| `POST /recommendations` request | `include_opportunities` and `include_action_details`, both default false for legacy callers; the new UI submits both true |
| Search response | Optional separate `opportunities` result; absent when not requested |

Produce detailed assessments only for returned dates, not every enumerated candidate. The existing Search limit is five cards by default and twelve disclosed equivalent dates per card; these defaults are not hard request bounds. Before expanding action details, sum total days across all returned representatives and disclosed alternatives. If this exceeds 6,000, fail the explicit request with `422 ACTION_DETAILS_TOO_LARGE` and an instruction to reduce length/result count; return no partial explicit or opportunity result. Apply this only when `include_action_details = true`, preserving old request behavior. Opportunity details have their own bounded maximum of five windows × 28 days and do not consume that explicit budget. Snapshots and serialization tests must prove summaries, grouped dates, and detailed assessments agree. No new broad Search or calendar-preview endpoint is required.

Concrete wire shapes (all dates are ISO local dates; date arrays are sorted and unique):

| Type | Fields/invariants |
| --- | --- |
| `calculation_context` | `{accounting_version: "phase075-v1", calculated_at: UTC timestamp, local_today: date, planning: {balance_days, allowed_negative_days, country_code, weekend_days, time_zone, personal_calendar}}`; no session ID |
| `WindowAssessment` | `{window, charged_dates, remaining_balance, eligible, eligibility_reasons, warnings, day_details}`; charged count equals window cost; details cover every inclusive date once |
| `DayDetail` | `{date, charged: boolean, kind, is_public_holiday: boolean, is_weekend: boolean, unavailable: boolean}`; kind is the effective classification described above |
| Eligibility variants | `{code: "unavailable_dates", dates: [...]}`; `{code: "insufficient_notice", earliest_start_date: date}`; `{code: "over_budget", required_days: integer, permitted_days: balance + allowed_negative}` |
| Opportunity envelope | `{status, items, policy, start_horizon: {start_date, end_date}, evaluated_pair_count}`; policy includes version `phase075-opportunity-v1` and all effective bounds, normalizers, weights and threshold |
| Opportunity item | `{opportunity_id, window, assessment, score, raw_points, score_breakdown, explanation, criteria_differences}`; ID is deterministic from its dates and policy version within the Search snapshot; assessment always detailed |
| Score breakdown | `{efficiency: {points, max_points}, length: {points, max_points}, low_leave_use: {points, max_points}}`; total points equals raw points |
| Criteria differences | `{code: "start_month_outside_selection", actual_month: {year, month}}` and/or `{code: "length_outside_tolerance", actual_days, minimum_days, maximum_days}` |

Search's existing `window`, remaining balance, and warnings must equal their assessment projections. Compare's existing window/charged dates/balance and feasible field must equal its nested assessment projections; keep existing budget-warning codes and add no misleading over-budget warning for notice/unavailability alone. No second top-level Compare day-detail representation is added. New frontend renderers prefer nested assessments and retain legacy rendering when absent; new Save/Export actions require the detailed shape.

For example, a five-day baseline whose fifth date is a personal day off and whose third date is unavailable has `vacation_days_used = 4`, `remaining_balance = 4` for balance 8, `eligible = false`, and `eligibility_reasons = [{code: "unavailable_dates", dates: ["2027-01-05"]}]`. If notice also excludes the start, append its reason. It must not acquire an over-budget reason merely because it is ineligible.

Structured errors distinguish malformed rules (`422 INVALID_PERSONAL_CALENDAR` with field paths), unsupported calendar, arithmetic/coverage failures, expired session, source ownership, and the existing generation-cap errors. User infeasibility is a valid assessment, not an HTTP failure. Do not expose private exception messages as user copy.

### Persistence and compatibility

- Add one non-null JSON `personal_calendar` column to anonymous sessions, with a server default equivalent to empty version-1 rules. The migration backfills existing rows and has a tested downgrade. Use this repository's existing UUID/JSON conventions.
- Sessions remain immutable planning contexts. Changing balance, calendar, weekends, time zone, or personal rules creates a new session when the person submits a calculation. There is no session-update endpoint or independent rules revision table.
- Search/comparison JSON snapshots include canonical rules, resolved provider calendar with explicit coverage, captured local today, accounting and policy versions, and authoritative returned assessments. Preserve the old outputs; do not migrate historical recommendations by recomputing them.
- Add a nullable JSON `opportunities` column to `searches`, storing its status, policy, requested coverage, candidate counts, and exact output in the same transaction as explicit results. Record resolved provider calendar/coverage when resolution succeeded; it is null only for a typed resolution failure. Store a machine reason for failed/capped scans and no partial items. It is not an ordinary recommendation row and does not receive the existing thumbs-feedback identity.
- A successful response requires complete snapshot persistence. Normalize both repository flush failures and transaction commit failures to the recoverable persistence error; current Search commit handling needs this explicit hardening in P075 05. A failed commit must leave neither explicit nor opportunity output committed and must not produce a success response.
- Omitted personal rules and `include_opportunities = false` preserve legacy Search/Compare behavior. Additive response metadata does not reinterpret old snapshots. Unknown saved/browser or accounting versions are handled explicitly rather than coerced.
- Deploy backend additions before frontend controls. Do not enable a new rule input while its renderer still equates all infeasibility with budget or all weekends with free days.

## Proactive opportunities

### Trigger, bounds, and failure isolation

Run only after an explicit, valid Search when requested. Interpret, typing, opening the app, visiting Saved options, and editing comparison dates never trigger discovery. A successful explicit Search with zero results may still return opportunities. A failed or capped explicit Search returns its existing error; do not replace it with opportunities.

Initial independently versioned policy:

| Setting | Default | Validation |
| --- | --- | --- |
| Start horizon | Local today through local today + 364 days, inclusive | 30–365 days |
| Candidate length | 4–28 inclusive calendar days | Minimum at least 3, maximum at most 28; min <= max |
| Result count | 3 | 1–5 |
| Candidate-generation cap | 12,000 start/length pairs | 1–20,000 |
| Weights | Efficiency 0.50, length 0.35, low leave use 0.15 | Nonnegative, sum to 1 |
| Efficiency saturation | 5 days off per vacation day | Positive |
| Length saturation | 14 days off | Positive |
| Leave-cost saturation | 14 vacation days | Positive |
| Inclusion threshold | 60 points out of 100 | 0–100 |
| Near-duplicate overlap | 0.80 of the shorter window | (0, 1] |

These are tunable product starting values, not empirically validated travel-quality scores. A candidate may end up to 27 days after the final permitted start. Resolve calendar coverage through that end. Notice can move the earliest start forward but never extends the horizon. Count every enumerated start/length pair before eligibility filtering; default worst case is 365 × 25 = 9,125 pairs, so the default scan completes under its independent cap. Guard date overflow explicitly.

The opportunity result has `status = complete | too_broad | unavailable` and an `items` array; `complete` with an empty array is a valid no-opportunity result. A recognized opportunity cap or provider failure returns an empty section with its status while preserving complete explicit results. Introduce a narrow `CalendarResolutionUnavailable` provider error for a supported calendar whose data cannot be resolved; the fake can produce it deterministically. Unsupported country/calendar remains an input error and does not become an empty opportunities section. Unexpected programming errors propagate through ordinary error handling. Failed resolution snapshots record requested coverage and null resolved facts; cap snapshots retain successfully resolved facts. Never emit partially ranked opportunity items. Shared malformed input fails before either calculation; persistence still commits the complete explicit and opportunity-status snapshot atomically.

### Exact scoring, eligibility, and variety

For total days `T` and vacation days used `P`, calculate bounded features:

```text
efficiency = min(T / P, 5) / 5 when P > 0; otherwise 1
length = min(T / 14, 1)
low_leave_use = 1 - min(P / 14, 1)
raw_points = 100 * (0.50 * efficiency + 0.35 * length + 0.15 * low_leave_use)
```

Gate on unrounded `raw_points >= threshold`. Display the nearest integer using half-up rounding; return component points and raw points for inspectable explanation. Weight or normalization changes can change scores; threshold-only changes cannot. Stable ordering is raw points descending, total days descending, vacation days used ascending, then start/end ascending. Tests use independent literal examples: 9 days/3 leave gives approximately 64.285714 points and display 64; 7/5 gives approximately 41.142857 and display 41. A zero-leave 4-day break scores 75. Ordinary 2-day weekends are outside the scan.

Apply the same personal calendar, balance, negative allowance, unavailable dates, and notice rules as explicit Search. A candidate must also have a genuine criteria difference: its start month is outside the selected months, or its length is outside the entire preferred-length tolerance interval used by Search. This excludes every in-criteria window, including equivalent dates not disclosed by the UI.

Suppress exact and near duplicates of every returned explicit representative and disclosed alternative. Then greedily select opportunities in stable score order, suppressing another option when the inclusive intersection divided by the shorter length is at least 0.80. Do not compare opportunity points with Search scores. This phase deliberately favors distinct date choices over multiple overlapping opportunities.

Each item contains its assessment, opportunity score/breakdown, deterministic reason facts, and explicit criteria differences. Example copy: “9 days off using 3 vacation days. Starts outside your selected month.” Never imply that leave-efficient dates are cheaper travel, approved leave, or availability verified beyond the user's entered rules.

## Frontend state and saved options

### Drafts and calculated results

Keep an editable planning draft separate from each immutable submitted result. Extend the existing shared planning fields rather than building a separate calendar form for each task. Interpret merges only the fields it owns and must preserve personal calendar controls; the model must not invent exception dates or run Search.

Editing any calculation input marks that task's result stale. Keep the prior result available as “Last calculation,” hide obsolete suggestion actions, and require Search/Update comparison. Disable Compare-from-result, Save, Export, and Copy on stale live results; existing saved snapshots remain usable. Close/invalidate open live-result action previews on input edits, resubmission, or result replacement so an already-open Copy button cannot bypass stale handling. Saved-item previews remain bound to their immutable records. A submitted request captures its context and a request revision; late responses cannot overwrite a newer result or attach a result to a different draft. Search/Update is disabled while a date-rule row has unapplied edits; Apply or Cancel is explicit.

Search-to-Compare copies the submitted context and exact selected dates, including grouped alternatives and opportunities. Preserve the Search draft, results, feedback, scroll, and focus. Retain `source_search_id` only while its owning session/context is still used. Editing context creates a new session and omits the origin. Comparison with notice/block violations shows exact accounting and eligible alternatives. Define three entry intents: manual opens a draft; live-result Compare is the existing explicit action that calculates on entry; saved-record Check only opens a draft. Track the return target and suspend any prior Compare draft, baseline/reset dates, results, stale state, and focus until the saved-check flow is left, including through task navigation.

### Saved-option record and browser module

Use a bounded localStorage adapter behind one browser saved-options module, with an in-memory test adapter. One namespaced key per item keeps an update/removal from rewriting every other item. Use storage events to refresh another open tab. Each item is an independent bookmark; cross-tab edits to the same item use last successful write, a documented scope limit.

Records contain literal `schema_version: 1`, a capture ID and export UID, user-editable name (default dates; at most 80 characters), save timestamp, source kind, exact dates, immutable assessment, sanitized submitted planning context, calculation timestamp/local date, accounting version, and applicable policy/reason metadata. Exclude bearer tokens, server ownership identifiers, raw interpretation text, and unrelated result cards. Escape user titles in every display/export context.

Derive one deterministic capture ID from a versioned canonical serialization of exact dates, canonical context, accounting version, and accounting result, excluding source surface, rank, server identifiers, timestamps, editable name, and score/explanation metadata. Use its SHA-256 digest for the storage key and export UID, and retain that UID in the record. A repeat save reports “Already saved” and preserves the existing name. Same dates with materially different context/accounting may be saved as separate records. Concurrent identical saves address the same key; truly concurrent edits to that record remain last-write-wins. UID remains stable across live export, Save, reload, and rename. Permit up to 50 records and at most 64 KiB of serialized UTF-8 data per record; validate dates, counts, arrays, and schema before writing. Reject oversized captures without truncating their accounting; exporting/copying the live result remains possible. Quota or unavailable-storage errors retain existing records and never report success. Simultaneous new saves of different items in separate tabs may briefly exceed the count cap; block further new saves until the count is below 50, without deleting records.

Saved records survive normal reloads independently of server-session expiry. Browser data can be cleared or unavailable, and private browsing is not durable; explain this once in the Saved options view. Unsupported schema or accounting versions and corrupt records produce a recoverable item-level message and an explicit Remove action; never recalculate or reset the store silently. This release has no JSON import, synchronization, account recovery, or automatic snapshot upgrades that recalculate dates. [MDN browser storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

### Reopen and check again

Add Saved options as a third task alongside Find dates and Compare my dates. Opening a saved item displays its captured cost, rules, warnings, and calculation date without any network request. It must not be presented as a fresh recommendation.

“Check these dates” opens a separate Compare draft initialized from the saved context. The user reviews balance/rules and explicitly submits, creating a fresh anonymous session without an original Search ID. The saved record remains intact; a subsequent Save captures a new result. Preserve the prior Find dates/Compare drafts when entering this path and restore them on Back.

Opening a Compare draft is allowed even for dates that later fail its current limits; explicit submission performs authoritative server validation and retains the editable draft on error. Saved viewing makes no backend request and must not pretend to know a currently configured limit from an old snapshot. Use the saved context's IANA time zone when initializing this draft, rather than silently regenerating the browser zone; extend the frontend planning draft/restore mapping accordingly. Existing past-start and maximum-length rules remain, with clear error messages on calculation. Viewing, copying, and exporting the historical snapshot remain possible. Unsaved planning edits do not survive a reload; saved items contain the context needed to resume deliberately.

## Export and copy contract

Offer Save, Download calendar, and Copy leave request on each current representative, each disclosed equivalent date, each opportunity, the comparison baseline, and comparison alternatives. Never substitute the group's representative dates when the user selected another date. Normalize all these sources into the same immutable action snapshot; export/copy read that snapshot, not the current draft. They do not make provider calls or require a still-active anonymous session.

Calendar download is one `.ics` event for the complete inclusive vacation window. Use all-day DATE values, `DTSTART = start`, and exclusive `DTEND = end + 1 day`; include a stable UID for that action snapshot, UTC DTSTAMP, VERSION 2.0, and PRODID. Use tentative status and transparent availability because this is a planning option. The description contains exact charged dates, leave cost, recorded calculation date, and applicable planning warnings. It omits balance, other unavailable ranges, account/session tokens, and raw text. There are no attendees, invitation sending, or booking/approval claims.

Follow RFC 5545 for CRLF, text escaping, UTF-8-safe line folding, and date overflow handling; validate with an independent parser and real calendar imports at acceptance. Repeated-import behavior depends on the calendar client and is not promised as synchronization. [RFC 5545](https://www.rfc-editor.org/info/rfc5545/)

Copy leave request produces readable plain text: complete break dates, exact working dates to request, total vacation days, recorded calculation date, and planning warnings. For zero leave, say no vacation days are required under the recorded calendar. Keep “not an approval” clear in the preview. A denied clipboard operation opens selectable text; successful copy alone may show a success message. No email, calendar write, or manager request is sent by the app.

## Ordered PR breakdown

Use one task ID per PR, tests with behavior in the same PR, no predicted PR numbers, and a green mainline at each merge. The [tracker](progress.md#phase-075--personal-calendars-opportunities-and-saved-options) owns live status. Dependencies below are explicit; start from current `main` after the design PR is approved and merged, then normally land one PR at a time. A stack is optional and follows the existing repository process.

| Task | Deliverable | Depends on | Acceptance evidence in that PR |
| --- | --- | --- | --- |
| P075 00 | Versioned product/backend/frontend plan and inspectable UX walkthrough | — | Decision record, independently worked fixtures, review of states and PR dependencies; documentation only |
| P075 01 | Shared calendar normalization and window assessment | 00 | Golden/property tests for override precedence, conflicts, normalized-rule round trips, blackout intersections, notice, inclusive dates, summary/detail parity, complete reasons, and empty-rule parity with Search/Compare |
| P075 02 | Personal context persistence and typed calculation results | 01 | Session JSON migration/default/backfill; canonical create/snapshot/create round trip; HTTP validation; response metadata and bounded Compare day details/reasons; snapshot facts; renderer compatibility before new controls |
| P075 03 | Personal calendar controls in Find and Compare | 02 | Manual override/unavailability/notice editor, country-change decision, preserved Interpret fields, correct day rendering, stale actions and origin ownership; first full personal-calendar journey against backend/PostgreSQL |
| P075 04 | Opportunity policy, scoring, and complete bounded detection | 01 | Literal scoring examples, threshold independence, zero-leave minimum, notice/budget/block eligibility, full tolerance exclusion, variety, deterministic ordering, cap and overflow cases |
| P075 05 | Opportunity workflow and atomic snapshots | 02, 04 | Request flag, response status, nullable JSON migration, complete/empty/capped/typed-provider-unavailable cases, nullable failed-resolution facts, separate budgets, unchanged explicit results, and flush/commit rollback tests |
| P075 06 | Separate opportunities section and comparison entry | 03, 05 | Criteria-difference copy, independent score labeling, empty/failure presentation, captured context, preserved results/focus, and integrated Search-to-opportunity-to-Compare journey |
| P075 07 | Complete action snapshots for every visible date | 02, 05 | Add Search action-details flag and 6,000-date budget; exact representative/grouped/opportunity/baseline/alternative accounting and sanitized metadata; all summaries match; one frontend normalization module, no duplicate leave math |
| P075 08 | Same-browser Saved options journey | 03, 06, 07 | Browser adapter/record validation; deterministic identity, reload/session expiry, quota/corruption/version errors, removal/undo and multi-tab refresh; saved-to-Compare time zone, entry intent, restoration and server validation |
| P075 09 | Calendar export and leave-request copy | 07, 08 | Independent ICS parse, exclusive end, cross-year/DST/Unicode/escaping, zero leave, ineligible warnings, exact grouped dates, live/save/reload/rename UID stability, stale-preview invalidation and clipboard fallback; integrated actions |
| P075 10 | Full acceptance, accessibility, performance, and operational documentation | 03, 06, 08, 09 | All acceptance rows below, real Docker/PostgreSQL journey, 1,440 px visual evidence, keyboard review, representative browser imports, regression CI, measured scan timings, runbook and acceptance record |

PR 02 updates the existing comparison renderer to use new effective day details and reason codes before PR 03 exposes rule entry. PR 07 completes portable action data across every returned Search date and workflow; it does not introduce a second accounting implementation. Feature visibility follows completed slices: calendar controls after 03, opportunities after 06, saved actions after 08, export/copy after 09. The UI begins sending `include_opportunities = true` in PR 06 and `include_action_details = true` in PR 07, only after each corresponding backend contract exists.

### Test-first delivery and review

Carry forward Phase 0.5's one-behavior red/green loop. For implementation, the proposed public test seams are the prepared-calendar/window-assessment interface, existing Search/Compare workflows, opportunity detector, authenticated HTTP routes, session/search/comparison repositories, saved-options module, action-snapshot/export module, and rendered journeys. These seams are part of this plan's review; no tests or implementation are being written now. Migration tests may inspect schema directly; normal behavior tests should use the public interface and independently worked expectations.

Each behavior PR includes its applicable backend/frontend tests and existing formatting, lint, typing, and build checks. Use a fixed clock, real test PostgreSQL for repository/HTTP integration, fake calendars for known dates, and fake/disabled interpretation providers. Start integrated journey coverage in PR 03 and extend it in 06/08/09; PR 10 is not the first end-to-end check.

## Acceptance and completion gate

| Area | Required evidence |
| --- | --- |
| Existing users | Empty personal rules preserve current Search ranking/grouping and exact-date comparison counts; old requests omit new fields successfully |
| Day accounting | Extra working weekend/holiday consumes leave; personal day off does not; no date is double charged; UI, saved details, and export agree |
| Hard constraints | Blocks on nonworking dates still exclude suggestions; notice boundary is inclusive; Compare preserves the baseline and lists every reason |
| State integrity | Interpret preserves new fields; edits never search; stale actions cannot capture mixed contexts; late responses and Back navigation preserve the correct draft/result |
| Opportunities | Separate full scan; explicit criteria and rank untouched; zero-result Search may show opportunities; errors/caps never return partial opportunity rankings |
| Complete snapshots | Context, provider facts, coverage, versions, local date, policy, and output persist atomically; response and stored facts agree |
| Saved options | All visible dates save correctly; reload works after server expiry; no token is stored; no leave is deducted; malformed/unsupported/quota states are recoverable |
| Export/copy | Parser tests and real Google Calendar desktop plus one other supported calendar import verify all-day end dates and readable text; clipboard fallback works |
| Accessibility | All controls/actions work with keyboard; focus return and live announcements work; rules and effective day types are clear without color |
| Visual quality | Review Find dates, rule editor, stale Search, blocked/notice Compare, populated/empty/unavailable opportunities, saved detail/empty/corrupt state, and export preview at 1,440 px |
| Performance | Record candidate counts and wall times for all three calendars and a worst-bound default scan; target p95 <= 2 seconds for Search with opportunities in a warm local Docker app over at least 20 measured runs per fixture; record hardware and failures |
| CI and handoff | Existing backend/frontend CI passes; add a Phase 0.75 acceptance record with actual evidence and remaining limitations; tracker marks Done only after merge |

The performance target is a release target to measure, not a claim about current runtime. If missed, optimize the shared accounting and bounded enumeration or revise policy bounds with documented result effects; never silently return partial best results. Desktop calendar import checks must distinguish parser compliance from client-specific rendering.

## Relationship to Phase 1

Move the existing planned opportunity work into this phase without marking it delivered. P1 09 maps to P075 04; P1 10–12 to P075 04; P1 13 to P075 06; opportunity workflow/persistence from P1 14 to P075 05/10. P1 14 retains a later regression gate once actual travel adapters exist. This phase proves no-flight operation without introducing a fake flight seam solely to test its absence.

Flight contracts, destination matching, live providers, and travel results remain P1 01–08. The PRD/HLD/task index and progress table must point to this plan as the authoritative opportunity specification, avoiding duplicate active implementations or contradictory status claims.
