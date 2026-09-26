# Annual planning: several vacations, one leave budget

**Status:** AP 00, planning for review. This PR contains documentation only. Plan approval or merge does not authorize implementation; wait for the user's explicit instruction before writing code or tests. Do not auto-merge.

**Phase name:** Annual planning, task prefix **AP**. It follows the Phase 0.75 foundation and precedes travel enrichment. Phase 1 keeps its existing flight scope and identifiers.

**Verified baseline, September 26, 2026:** `origin/main` is `20df229`; planning PR [#50](https://github.com/rakreshet/vacation-window-planner/pull/50) is merged. Implementation PRs #51–#60 remain open. This planning branch starts at the verified #60 tip, `aaabf4e`, and targets `codex/phase075-10-acceptance`, so its review diff contains only these documents. Recheck ancestry and retarget after that stack lands; never merge it automatically. The [Phase 0.75 acceptance record](phase-0.75-acceptance.md) retains its pending browser-download and real calendar-client checks.

**Companions:** [UX walkthrough](annual-plans-ux.md), [test strategy](annual-plans-testing.md), [progress and PR map](progress.md#annual-planning--several-vacations-one-budget), [domain glossary](../CONTEXT.md). This document owns the proposed annual contracts. The older phase documents retain their own release scope.

## Product outcome and decisions

Given “I have 18 days available; keep three in reserve, preserve my August trip, and find one longer break plus a couple of short ones,” return a few feasible **whole plans**. Each plan coordinates all breaks against one calendar and one budget. Show a year view, exact charged dates, leave used, remaining balance, and protected reserve. Locking dates and explicitly recalculating may change only the unlocked breaks.

The optimizer chooses compatible combinations. Neither Search's ranked cards nor saved options form an adequate candidate shortlist. Saving a plan remains a planning action, with no employer-side deduction or approval.

| Decision | Position | Authority |
| --- | --- | --- |
| Horizon | One calendar year | User confirmed in handoff |
| Input | Structured controls plus optional interpretation into editable proposals | User confirmed in handoff |
| Impossible mix | Explain the conflict and offer explicitly reduced plans when feasible | User confirmed in handoff |
| Locks and reserve | Preserve exact locked dates; never spend the reserve automatically | User confirmed in handoff |
| Mix includes locks | The locked August break fills one requested slot; it is not an extra fourth trip | User confirmed September 26, 2026 |
| Budget | Leave available for the included future trips; no past trips, accrual, carryover, or full-year entitlement ledger | User confirmed September 26, 2026 |
| Saved dates | Reassess their cost under the annual plan's current common calendar | User confirmed in handoff |
| Delivery | Docs and planning PR now; stacked behavior PRs with TDD only after explicit authorization | User instruction |
| Remaining choices | Concrete defaults below are proposals for this PR's review, not separately confirmed requirements | Proposed |

Accounts, public sharing, cross-device recovery, calendar connections, notifications, travel data, household calendars, partial days, negative balances, approval states, and leave forecasting are outside this release. Keep the existing browser-only model. Desktop support remains 1,024 px and wider, with visual acceptance at 1,440 px.

## Product rules proposed for review

### Year, balance, and mix

- Offer the current local year and the next two calendar years. Default to the next year, visibly editable; an ongoing-year plan uses only its remaining eligible dates. Capture local today once in the submitted IANA time zone. Reject a past year. A future-year budget is the user's supplied amount, not an accrual prediction.
- Every break lies entirely between January 1 and December 31 of that year. Reject cross-year locks; do not clip them. Generated breaks may end in a later month, but not a later year. Leap day is an ordinary valid date when present.
- `available_days` is the single pool covering **all** included trips, locked and generated. Each included trip is charged once. The form explains: if an HR balance already excludes an included locked trip, enter a pool that includes that trip's allocated days. Do not infer earlier deductions from a bookmark or add its historical cost back automatically.
- Whole-day available balance is 0–366; reserve is 0–available balance, default 0 until set. Zero balance is valid when the requested breaks cost zero. Annual planning does not inherit Search's allowed-negative allowance. Importing context with an allowance displays the change to zero before submission; Search itself is unchanged.
- Represent the mix as 1–6 explicit slots. Default three slots: one long break (7–14 inclusive calendar days), two short breaks (3–5 days). Labels and ranges are visible; ranges are editable within 3–28, with minimum <= maximum. Counts in the UI create/remove slots rather than a second count representation. A slot has a stable ID and can carry one lock.
- Selecting saved or manual dates requires choosing the slot they fill. If their length does not fit, offer an explicit range edit or conversion to an exact-date slot. Exact-date slots are locked and may be 1–28 days. Unlocking an exact-date slot requires choosing a generated length range first. A new seventh slot is rejected; a lock is never silently replaced by changing a count.
- Allowed months apply to **starts of generated breaks**, default all twelve. Ends can extend into the next month. Locked dates are visible exceptions to this preference; changing months cannot move them. Empty months with unfilled slots is an input error. For an all-locked plan, months are irrelevant.
- Proposed spacing is at least 7 intervening calendar dates between any two breaks, editable from 0–60. Even at 0, there must be at least one effective working date strictly between breaks. This prevents an uninterrupted period off from being split into artificial short vacations. Spacing applies equally to locks; it never counts days inside either break.
- Minimum notice applies to newly generated breaks. A future locked break is already arranged, so notice is waived for it and disclosed. Past or already-started locks are rejected; there is no partial accounting of a trip underway. Unavailable dates remain hard constraints even for locks and even when nonworking.

### Accounting invariants

For balance `B`, reserve `R`, and chronologically ordered breaks `W1 ... Wn`:

```text
spendable_days = B - R
charged_dates = sorted union of effective working dates inside all selected breaks
total_leave_used = count(charged_dates)
remaining_days = B - total_leave_used
unallocated_days = remaining_days - R
balance_after_break_i = B - count(charged dates through break i)
```

A feasible plan has nonoverlapping breaks, obeys spacing and hard calendar constraints, fills its declared slots, and satisfies `total_leave_used <= spendable_days`. Reserve is part of remaining balance; never subtract it twice. With B=18, R=3, and total leave=12, remaining=6 and unallocated=3. The balance after each break is a deduction schedule under one supplied pool, not a projection of future accrual.

Total days away means the distinct dates **inside selected breaks**, not all weekends/holidays in the year. Since breaks cannot overlap, per-break costs and lengths sum to the union totals. Revalidate those equalities at result construction. Do not sum existing individual-window `remaining_balance` values or display them as a plan running balance.

### Locks and conflicts

Changing the calendar, weekends, overrides, unavailable dates, balance, or reserve recalculates the cost of every lock. Retain lock IDs and exact start/end dates through every calculation. A saved option contributes dates and an optional local label only; its old context and cost are not optimizer inputs. Before calculation, show that annual calendar rules will determine the new cost. After calculation, the UI may compare the local historical figure with the new authoritative cost, explicitly labeled.

| Conflict | Result and repair |
| --- | --- |
| Reversed dates, range/count bounds, unsupported year, missing slot assignment | Field-specific input error; keep the draft |
| Duplicate/overlapping locks | Name both slots and dates; ask for an explicit edit/removal; do not merge locks |
| Locks violate spacing or have no effective working date between them | Explain the gap rule; edit dates or explicitly combine into one slot |
| Lock intersects unavailable dates | List the intersecting dates and slot; edit the lock or unavailable range |
| Lock is past or crosses the year | Explain the exact restriction; change the year/dates or remove it |
| Locks alone use more than B−R | Show locked cost, spendable pool, and shortfall; no reduced plan can omit the lock or spend R |
| Full mix has no feasible combination | Return a proven full-mix conflict plus any computed reduced plans; state each omitted slot |
| Candidate/state/work/time limit | “We could not finish checking this request”; no infeasibility or optimality claim and no partial ranked plans |

Return all independently established lock reasons in stable slot/date/code order. A lock conflict prevents optimizer discovery, but its literal accounting stays available. Broad mix conflicts must not invent a unique root cause: combined lengths, spacing, dates, and budget can interact. An exact minimum-cost solve with the budget bound removed may prove a budget shortfall; label that number only when that solve completes. Otherwise explain that no combination satisfies the entered constraints, with editable controls and the observed omitted slots, without claiming a minimal repair.

### Full, reduced, and different plans

The initial objectives use literal facts, without a synthetic percentage score:

1. **Most days away:** maximize total selected days; then minimize leave; then ascending canonical date tuples.
2. **Use fewer leave days:** minimize leave while filling the same mix; then maximize total selected days; then the same date tie-break.
3. **Different dates:** maximize total selected days among remaining materially different plans, then minimize leave and break date ties.

Offer at most three plans. Plan 2 and plan 3 are constrained to be materially different from every already selected plan. Define that as at least one unlocked break whose overlap with **each** unlocked break in the earlier plan is less than 50% of the shorter interval. Locks do not contribute to this diversity check. This avoids filling cards with one-day shifts and can legitimately yield fewer than three plans. It is a deliberate, reviewable default; seasonal distribution is not a separate objective in v1.

Labels describe the optimization domain: the first plan is optimal under its stated objective and bounds; subsequent plans are optimal subject to the diversity restrictions. If the cheapest overall plan duplicates the first, say “Uses fewer leave days among different plans,” not “the cheapest plan possible.” Show actual metric differences and do not manufacture a favorable delta. An all-locked request returns one assessed plan.

Only after a completed full-mix feasibility search proves failure may reduction omit unlocked slots. Never change a retained slot's length range, dates/month preference, spacing, reserve, calendar, or locks. Rank reductions by maximum fulfilled slot count, then preserve earlier slots in the visible list (default long before shorts), then apply the objectives above. “Priority when reducing” is visible and editable by Move up/down; it is not an undisclosed weight. Generate alternatives for the best retained-slot set. Include an explicit omitted-slot list and full original input in every reduced result. A lock-only reduction is valid if locks remain; an empty plan is never a suggestion. If no nonempty reduction exists, return a complete no-plan result.

Selecting a reduced plan does not rewrite the original request. “Use this reduced mix” explicitly copies its retained slots into a new draft, preserving locks and reserve, and requires Generate plans again. Display the original mismatch until that action is taken.

## Backend design

### Existing behavior inspected and reuse decisions

| Existing module | Annual role |
| --- | --- |
| `domain/assessment.py`, `domain/personal_calendar.py` | Reuse effective day classification, exact charged dates, coverage, and normalized personal rules. Distinguish annual budget and the locked-notice exception from individual-window eligibility. |
| `domain/generator.py` | Its complete start/length enumeration is a useful pattern, but the Search interface accepts one preferred length/tolerance and allows end spillover. Annual generation stays inside the annual module with year and slot rules; it never consumes ranked Search output. |
| `domain/calculation_context.py` | Reuse sanitized common calendar context and accounting version. Add an annual envelope for budget/reserve, policy and optimizer versions; do not overload `remaining_balance`. |
| `comparison_workflow.py`, `workflow.py`, `repositories/` | Reuse injected clock/provider, immutable anonymous session context, atomic snapshot writing, and typed HTTP errors. |
| `interpreter.py` | Reuse provider selection and optional availability. Its existing defaulted Search fields are not safe as an annual patch contract. Use a separate annual proposal. |
| `models.py`, existing Alembic migrations | Follow this repository's UUID, foreign-key, JSON and timestamp conventions for a new immutable run record. |

Do not refactor Search, opportunities, or comparison for symmetry. Any shared change needs a demonstrated annual requirement and regression coverage. There are no deployed legacy rows to backfill merely for compatibility.

### Module interface and candidate completeness

One pure annual module hides enumeration, locking, compatibility, optimization, reduction, diversity, and factual explanations behind this proposed interface:

```text
plan_year(annual_request, prepared_calendar, annual_policy, work_budget)
    -> AnnualPlanningOutcome
```

It receives immutable facts and a captured local date. It does not call a model, database, browser store, or holiday provider. `work_budget` bounds deterministic work and supplies a monotonic deadline check; business dates still come only from captured local today. The workflow resolves one calendar covering the entire selected year before calling it. No external optimization library or new solver adapter is required for the proposed algorithm.

Enumerate every distinct legal start/end pair for the union of the unlocked slot length ranges and selected start months. Enforce future/notice clipping and December 31 before assessment. At most 366 × 26 = 9,516 start/length pairs exist for lengths 3–28 before end clipping. Assess each distinct interval once, record all slots it can fill, and reject candidates conflicting with locks or hard calendar rules. Keep structurally valid candidates whose cost exceeds the current pool for the optional budget diagnostic; feasible-plan selection enforces the spendable pool. Zero-cost candidates are ordinary candidates. Do not pre-trim to the best N per slot or apply Search/opportunity scores. Count attempted pairs before eligibility filtering.

Use the shared assessor for candidate cost and detailed final output. Apply annual aggregate affordability separately; its existing individual `eligible`/`remaining_balance` fields are not annual decisions. For locks, retain unavailable-date reasons and waive only the notice reason after future/year validation. If measurement justifies a calendar index, derive prefix counts from the assessor's effective day facts and verify parity at the public assessment/annual seams. Such an index may speed interval sums and gap checks; it must not become an independent working-day classifier. Final selected intervals are assessed in detail and checked against the optimizer summaries.

### Exact combination selection

Use a sparse chronological dynamic program over the bounded candidate graph, with locked intervals prevalidated and present in every result:

1. Precharge the locks once, remove their filled slots, and filter generated candidates against every lock, including required separation on either side.
2. A state records a date cursor, filled unlocked-slot bitmask, leave spent, and diversity flags for up to two earlier selected plans. Keep the best prefix total days and deterministic date tie-break for that state.
3. At each cursor, either advance without a break, or take a candidate starting there that fills one unfilled compatible slot and fits the residual budget. Taking a candidate moves the cursor to its first compatible successor start according to both gap rules. Year-end terminal states do not require a gap after the last break.
4. A full terminal has every slot filled. Different slot masks and spent amounts remain distinct; no greedy choice of an individually best window is safe. A candidate sets a novelty flag when it satisfies the diversity predicate against the corresponding earlier plan. Final alternatives require all requested flags.
5. Optimize the terminal objective lexicographically. With cursor/mask/spend/diversity equal, a higher-time-away prefix dominates a lower one for both full objectives; identical metrics use canonical dates. Do not discard states merely because one spends less while filling different slots or has different novelty flags.
6. For reduced discovery, allow nonempty terminal subsets containing every lock and rank them by the declared fulfilled-count/priority rule. For a budget diagnostic, rerun without the spendable bound, with total spend still bounded by at most six 28-day breaks.

Exchangeable slots are canonically assigned by chronological interval within identical range/lock constraints, using original slot order to break ties. Plan identity and diversity are based on interval sets and effective constraints, never on arbitrary slot permutations. Zero-cost intervals still advance the date cursor, so no free-window loop exists. The test oracle must check objectives, infeasibility, reductions, novelty and tie behavior independently.

The proof obligation is coverage of every legal nonoverlapping combination via a chronological path, and safe dominance only when all future-relevant state is equal. AP 02 must document that argument alongside tiny exhaustive-oracle results. If the measured DP cannot meet the bounds, revise the design with evidence; do not silently substitute a heuristic and retain an exact claim.

### Resource policy and guarantees

| Policy value | Initial proposed limit |
| --- | --- |
| Slots / lengths | 6 total; generated 3–28 dates; locked 1–28 |
| Candidate attempts | 12,000 distinct start/length pairs |
| Sparse states | 500,000 created states summed across all objective, reduction and diagnostic passes |
| Transitions | 5,000,000 evaluated transitions across the entire request |
| Wall budget | 5 seconds for the pure planning call, using an injected monotonic deadline |
| Results / detail | 3 plans; at most 3 × 6 × 28 = 504 selected day rows, plus one common year calendar of at most 366 day rows |
| Concurrency | At most 2 active annual calculations per backend process; reject excess with a retryable busy response, no unbounded queue |

Version these defaults as `annual-v1`, record effective limits and counters, and validate settings at startup. Bounds are proposed starting points, not measured performance claims. Count rejected transitions as work too. Apply a single cumulative budget, including optional objectives and reductions; do not reset it for each pass. Full terminal accounting and output construction remain bounded.

`complete` means the requested calculation and all presented objective selections finished over the complete enumerated domain. `infeasible` is a completed feasibility proof, possibly with reduced alternatives. `conflict` means validated locks cannot coexist. `too_broad` means the work cap/deadline ended calculation; it returns no plans or claim about feasibility. Calendar/provider and persistence failures are separate operational failures. If a later alternative pass hits a cap, discard the partial set and return `too_broad` rather than presenting it as complete. Record a machine limit reason for diagnosis.

### HTTP and wire contracts

Use the existing session creation path, with `balance_days = available_days` and `allowed_negative_days = 0`. `POST /annual-plans` uses the bearer session; balance, country, weekend pattern, time zone and personal rules come from that session. There is no second balance field in the request. Reject a nonzero allowance for annual planning with an explicit error. A changed common context creates a new session on submission; a slot/reserve-only edit can reuse its session.

| Contract | Proposed fields and invariants |
| --- | --- |
| Request | `year`, `reserve_days`, ordered `slots`, `allowed_start_months`, `minimum_gap_days`; strict integers/date-only strings; forbid unknown fields |
| Slot | `slot_id`, `min_days`, `max_days`, optional `locked_dates`; unique stable IDs; an exact-date slot has equal bounds matching its lock length |
| Outcome envelope | `run_id`, discriminant `status`, canonical input, calculation context, effective annual policy, counters, `plans`, exact `locked_assessments`, typed `conflicts`, and full-mix feasibility state (`feasible`, `infeasible`, `not_evaluated`, or `unknown`) |
| Common year calendar | One ordered effective-day table for the year, including charged/holiday/weekend/unavailable facts from the shared assessor; supplies the annual view without a second frontend calendar calculator |
| Plan | Deterministic `plan_id`, objective label/facts, `fulfillment = full | reduced`, retained/omitted slot IDs, chronological breaks, aggregate accounting, and warnings |
| Break | Slot ID, locked flag, exact window, charged dates and effective day details, leave used, and `balance_after_break`; no misleading individual remaining balance |
| Aggregate | Available, reserved, spendable, total leave, remaining, unallocated, total days away, and sorted unique charged dates |
| Conflict | Discriminated code, affected slot IDs/field paths, and relevant dates/counts; deterministic copy from facts, no LLM explanation |

`complete` has full plans and full-mix `feasible`; `infeasible` has full-mix `infeasible` and zero or more reduced plans; `conflict` has no plans and full-mix `not_evaluated`; `too_broad` has no plans and `unknown`. When a failed later pass discards results, the public status remains unknown by policy, even if some earlier feasibility work completed. Invalid shape, past/underway/out-of-year locks, and length bounds are `422 INVALID_ANNUAL_PLAN` before optimization; in-year locks with overlap, gap, unavailability or budget conflicts get the evaluable outcome above, including their literal assessments. Use existing 401 session errors; unsupported calendar remains 422; provider unavailability, busy calculation and persistence failure are distinct retryable 503 codes. Do not expose raw exceptions.

No read-by-public-ID endpoint, background job, or automatic recalculation is required. Resubmission is a new immutable run, and prior results are unchanged. IDs are correlation/identity values, not credentials. Backend types remain strict Pydantic models; the new frontend HTTP path validates the discriminated response at runtime rather than casting untrusted JSON.

### Persistence and orchestration

Add one `annual_plan_runs` table with UUID ID, session foreign key/index, `created_at`, non-null structured-input JSON and result JSON. Use one migration after the verified stack's migration head, with fresh-schema upgrade/downgrade checks. Snapshot resolved holiday facts/coverage, common personal rules, captured UTC time/local today, canonical slots/locks, balance/reserve, policy/algorithm/accounting versions, limit outcome/counters, and exact returned plans.

Persist every evaluable outcome (`complete`, `infeasible`, `conflict`, `too_broad`) atomically before returning 200. No fabricated calendar snapshot on provider failure; validation/provider failures return their error without a run. Flush and commit failures roll back and return `503 PERSISTENCE_ERROR`. Use the same repository read seam for snapshot round-trip and rollback tests; no new public retrieval route solely to support tests. Run records follow anonymous-session ownership/expiry and existing deletion semantics; browser saves provide user-facing durability separately.

Interpretation text and local saved-option titles are not included in run inputs or request logs. Keep existing body-size and session protections. Extend application wiring only where this workflow requires it; structured planning works without any model key.

### Natural-language interpretation

Add `POST /annual-plans/interpret` using the configured interpretation provider, separate from `/interpret`. Input is at most 4,000 characters plus the current year/local date context, not the entire saved-options store. The output is an editable **patch**, with absent fields truly absent. Proposed fields may include year, available days, reserve, slot mix/ranges, allowed months, gap, and explicitly stated dates. It never computes costs, claims feasibility, calls planning, or silently adjusts the common calendar.

Use optional schema fields plus presence-aware serialization; `0` and `[]` are explicit values, not “missing.” Distinguish supplied values from unresolved references. Preserve structured fields that are absent from the patch, including personal rules. Present all proposed changes before Apply; replacing the mix requires visibly mapping/preserving existing locks, and cannot delete them automatically. Applying a proposal marks results stale but does not submit.

“My August trip” produces an unresolved saved-trip reference. The browser offers matching saved dates for explicit selection and slot assignment; even one match requires confirmation. “One longer break plus a couple of short ones” proposes the visible preset ranges and count of two shorts, labeled as assumptions. An ambiguous year or date stays unresolved; no invented date. A stale interpretation response cannot overwrite intervening edits. Provider failure leaves the structured form usable, and no model prompt/output is a runtime instruction.

## Frontend design

Add **Plan my year** to the current task navigation and separate **Vacations / Annual plans** views within Saved. Preserve Find dates, comparison, feedback, their drafts and focus return. The annual workspace owns its draft and request revision; copy shared calendar inputs on entry, but subsequent annual edits do not mutate another task's draft.

Proposed modules are an `AnnualPlanWorkspace`, typed annual client/contracts, annual draft/patch handling, `AnnualPlanResults`, an accessible `AnnualYearView`, and browser saved-plan/action modules. These are responsibilities, not a mandate to create a file or abstraction for every row. Reuse `PlanningFields`/`PersonalCalendarFields` with explicit annual labels and no allowed-negative control. Keep a small annual interface around all optimizer behavior; React never calculates leave cost or chooses combinations.

| State | Behavior |
| --- | --- |
| Draft | Editable mix, common calendar, locks, reserve and gap; no requests on typing, Interpret Apply, navigation, or lock toggles |
| Submitting | Capture draft revision/context; disable duplicate submission and live-result actions; cancel/ignore obsolete responses |
| Current result | Select one of up to three complete plan cards; show budget totals, year view, list and per-break charged dates |
| Dirty result | Keep “Last calculation” visible; disable live Save/Copy/Download and conflict-sensitive actions until Generate/Recalculate |
| Lock from result | Copy only that plan's selected exact interval into its slot, retain all existing locks, mark dirty, announce “Dates locked; recalculate to update the other breaks” |
| Recalculated | Show date/cost differences from the previously selected plan, unchanged lock dates, and new aggregate totals |
| Error/conflict/cap | Preserve draft, locks and last result; render outcome-specific recovery; do not treat service failure as infeasibility |
| Saved snapshot | Read-only historical result with recorded context/date; offline view/export/copy; Recalculate opens a separate editable draft |

Lock toggles are draft edits, not implicit calculations. Unlocking ordinary slots retains their length ranges. Removing a locked slot requires an explicit Remove locked break action; ordinary mix reduction must stop at the affected lock. Manual editing of locked dates is explicit and creates a new draft, never a mutation by the optimizer. Carry the current request revision through all async actions and close live action previews when input changes.

Compare whole plans through a shared metric table and one selected year view. Do not offer isolated “Compare nearby dates” as though its standalone budget represented a feasible annual replacement. A future swap feature must rerun the annual planner; it is outside v1.

### Browser saving, reopening, and actions

- Use a separate `SavedAnnualPlansStore`, namespaced `vacation-window:annual:v1:`, with a browser-storage adapter and an in-memory test adapter. Keep existing saved-option records and semantics unchanged.
- A record holds one selected plan, original canonical request including locks and omitted slots, common context/year-calendar facts, exact accounting, calculation timestamp, policy/accounting/schema versions, sanitized identity, saved time and editable name. Do not save all alternative plans by default. Exclude tokens, server run/session IDs, raw interpretation text, and unrelated saved records.
- Use a deterministic SHA-256 identity over versioned canonical input, calendar context, selected intervals/accounting and fulfillment metadata, excluding timestamps/name/rank. Repeat save reports Already saved and preserves the name. Different calendar accounting or reserve/mix can produce a distinct capture. Plan-level and per-break export IDs derive from that saved identity and exact interval; rename/reload/repeat export keep them stable.
- Proposed limits: 20 annual records, 256 KiB UTF-8 per record, 80-character name. Validate the full discriminated schema and accounting invariants on write/read; never truncate day details. Quota, blocked storage, corruption and unsupported versions produce item-level recovery without deleting other records. Removal has Undo with truthful failure handling. Same-item cross-tab edits use last successful write; concurrent new records may briefly exceed the count cap, with subsequent saves blocked and no automatic deletion.
- Reopen reads the saved calculation without a backend call. Recalculate opens a separate draft initialized with its recorded context/time zone and original request; review current budget/calendar explicitly. Preserve only the locks recorded by the user. Do not automatically lock every generated break or accept an omitted slot. The original saved record is unchanged; past/year-invalid inputs get a clear error on explicit submission. Restore the previous annual workspace on Back.
- Copy preview lists all included breaks and unique charged dates with aggregate leave used. Offer an optional “Include budget and reserve” checkbox, off by default. Export one `.ics` file with one tentative, transparent all-day event per selected break using existing date/escaping/folding rules. Do not sum independent single-window export summaries into annual balance claims. No attendees, requests, or writes to external calendars.
- Export and copy bind to the selected immutable current/saved plan, never a mutable draft. Reduced plans clearly state which requested breaks are omitted in the preview/copy and event description. Preserve selectable-text fallback when clipboard access fails. Download is not recovery/synchronization; v1 has no editable JSON import/export.

The [UX document](annual-plans-ux.md) specifies inspectable screens, concrete fixtures, accessibility, and recovery copy. The [test strategy](annual-plans-testing.md) owns the proposed public seams and acceptance matrix.

## Ordered dependent PR breakdown

Each behavior PR is based on the previous PR branch; all dependencies below are therefore included transitively. Do not create the implementation branches in AP 00. After explicit implementation authorization, recheck the base stack and either start AP 01 from the merged plan on current main or stack it on this reviewed plan branch. Keep base links and the [tracker](progress.md#annual-planning--several-vacations-one-budget) current when predecessors land. No speculative PR numbers or auto-merges.

| Task | Deliverable and definition of done | Direct dependency | Red → green evidence in that PR |
| --- | --- | --- | --- |
| AP 00 | This BE/FE/UX plan, test strategy, domain terms, dependent sequence and progress table are reviewable in a docs-only PR | P075 10 branch tip | Document/link/diff checks only; no feature tests or code |
| AP 01 | Exact locked-only annual assessment through the annual public interface, with strict inputs, one pool/reserve, gap/year rules and detailed conflict facts | AP 00 + explicit authorization | Worked charged-date fixture, reserve accounting, overlapping/blocked/past locks, notice exception and all-locked result |
| AP 02 | Complete unlocked candidate discovery and exact full-mix optimizer, first objective, deterministic limits and DP proof | AP 01 | Tiny exhaustive oracle, greedy counterexample, inclusive year/gap, zero cost and cap-vs-infeasible tests; first measured performance baseline |
| AP 03 | Different full plans, reduced mixes, truthful diagnostics and the complete annual outcome contract | AP 02 | Objective/tie/diversity oracle, slot-permutation stability, maximum retained mix, immutable locks/reserve, cumulative budget exhaustion |
| AP 04 | Authenticated annual workflow/HTTP, provider and clock wiring, immutable PostgreSQL snapshots and bounded concurrency | AP 03 | Real HTTP→PostgreSQL round trip, strict wire shapes, session/context/allowance rules, every outcome, provider error and flush/commit rollback; migration up/down |
| AP 05 | First full browser journey: structured annual workspace, slots, calendar, reserve, manual/saved locks, result totals/list and conflict/reduction states | AP 04 | Rendered behavioral tests plus real browser→API→PostgreSQL journey using the worked fixture; save/copy controls still hidden |
| AP 06 | Year view, whole-plan comparison, lock/unlock/recalculate, deltas and preserved task/draft navigation | AP 05 | Keyboard and visual checks, stable locks, fresh costs after calendar edits, stale/late responses, separate Search/Compare state; integrated recalculation |
| AP 07 | Optional typed annual interpretation and review/apply flow with explicit reference resolution | AP 06 | Fake model-provider proposals, absent-vs-explicit values, lock mapping, ambiguous saved trip, concurrent edits and provider outage; no automatic calculation |
| AP 08 | Save/reopen whole plans in this browser with original request, immutable accounting and explicit recalculation | AP 07 | Storage adapter and rendered journeys for identity, validation, reload/session expiry, quota/corruption/undo/multi-tab, preserved workspace and unchanged bookmarks |
| AP 09 | Whole-plan calendar download and leave-request copy, including reduced-plan disclosures | AP 08 | Independent multi-event ICS parse, exact dates/UIDs/totals, escaping, privacy defaults, clipboard denial, stale preview and real download/import evidence |
| AP 10 | Integrated acceptance, performance/resource tuning if proven necessary, accessibility and operational documentation | AP 09 | Full agreed matrix, measured normal/worst-bound timings, fresh backend/frontend checks, browser evidence and acceptance record with unresolved limitations |

AP 01–03 are public-domain vertical slices: each test exercises a useful annual result rather than private enumeration tables. AP 04 integrates all server behavior. AP 05 begins live integrated journeys; acceptance is not deferred wholesale to AP 10. Public feature visibility follows completed capability: structured annual planning after AP 05, year/lock refinements after AP 06, optional interpretation after AP 07, saving after AP 08, export/copy after AP 09.

## Delivery and review gate

Use the TDD skill's one-behavior cycle: agree the public seams in this plan, write one failing behavioral test, verify the failure, implement the minimum behavior, rerun, then select the next slice. Do not write all tests first or add implementation in this planning PR. Refactoring belongs to the covered review stage, with meaningful names and focused functions.

This PR asks reviewers to assess the confirmed decisions, proposed bounds/defaults, optimizer proof/completeness contract, test seams, and UX flow. Implementation still requires a later explicit instruction. Merge marks AP 00 delivered only; all AP 01–10 remain Planned until authorized and actually delivered. Full quality commands and release evidence are specified in the [test strategy](annual-plans-testing.md); old 220/75 test counts are historical, not fresh verification of this plan.
