# Annual planning UX walkthrough

**Status:** Reviewable design for AP 00, not an implemented UI or completed visual acceptance. The [plan](annual-plans-plan.md) owns product rules and contracts; the [test strategy](annual-plans-testing.md) owns verification. The user confirmed that locks count toward the requested mix and the pool covers included future trips.

## Task structure and visual language

Add **Plan my year** beside Find dates, Compare my dates, and Saved. Saved contains separate Vacations and Annual plans lists; individual bookmarks never become a combined budget implicitly. Preserve the existing warm paper, forest green, mint, and coral design language from the [frontend design contract](frontend-design.md).

On desktop, use a concise input column and a wider results column. The form can collapse to a submitted-input summary after a successful calculation. Keep the budget summary above the annual visualization and the chronological break list below it. At 1,024 px, allow the sections to stack without horizontal page overflow. At 1,440 px, compare plan metrics side by side and show the twelve-month view in a 4 × 3 grid. No drag gesture is required.

## Screen A: build the annual request

```text
Find dates | Compare my dates | Plan my year | Saved

Plan several breaks with one leave budget
Year [2027 ▼]       Days available for these trips [18]
Keep in reserve [3]                         15 days available to allocate
Include the leave for locked trips in this pool. Past trips are not included.

[Optional description: “Keep my August trip and find ...”] [Interpret]

Your requested breaks                              Locked trips count in this mix
1. Long break    [7] to [14] days away               [Add exact dates]
2. Short break   [3] to [5] days away                [Add exact dates]
3. Short break   [3] to [5] days away                [Add exact dates]
[Add a break]    Priority when reducing: top to bottom [Move up / Move down]

Start months for new breaks: [Jan] [Feb] ... [Dec]
At least [7] dates between breaks
There must also be a working date between separate breaks.

Calendar [Israel]       Weekends [Fri] [Sat]
▼ Personal calendar rules [existing date overrides, unavailable dates, notice]

[Generate plans]
```

Display both “Days away” and “Vacation days used” consistently. Length fields count inclusive dates, including weekends and holidays. Reserve is protected within the balance, not an extra allowance. Secondary help explains how to enter a pool when an employer's displayed balance already excludes a locked future trip; the app does not infer that adjustment.

Native labeled year/month/date/number controls are sufficient. Range errors appear inline and in a summary; retain the entered values. An unfinished personal-rule edit blocks submission with Apply or Cancel. Country changes reuse the explicit keep/clear override decision. Generated months and notice controls explicitly say they apply to new breaks. Locks remain subject to unavailability and spacing.

Selecting current-year planning marks elapsed months/dates unavailable for generated starts, with a clear explanation. Changing the year does not shift or discard locks. Show their out-of-year errors until the user repairs them.

## Screen B: add a locked break

“Add exact dates” opens an inline panel for the selected slot:

```text
Keep the dates for Long break
[Enter dates] [Choose a saved vacation]

Saved: August trip — Aug 6–14, 2027
Previously calculated: 4 vacation days, under its saved calendar
This plan will recalculate its cost using Israel · Fri/Sat · current personal rules.

Start [2027-08-06]  End [2027-08-14]         9 days away
[Keep these dates] [Cancel]
```

The historical figure is informational, never a promised annual cost. A successful calculation might say “Now 5 vacation days; previously 4 under the saved calendar.” Do not show a new exact cost before the server assesses it. Keep the saved source unchanged.

If the selected dates do not fit the slot, offer visible range editing or Convert to exact-date break. The user can instead choose a different slot. Do not add another trip silently. A lock is indicated with text and an icon, plus exact dates and Edit dates / Unlock controls. Mark notice as waived for the arranged lock. Saved dates from another year remain selectable for inspection but cannot be applied as a valid lock without correction.

Removing a slot with a lock reveals a specific “Remove locked break” action. Normal count changes cannot discard it. No confirmation is needed for an ordinary reversible form edit; the lock-removal action itself is explicit.

## Screen C: review complete plans

```text
3 breaks planned                      Calculated with your submitted calendar
18 available = 8 used + 3 reserved + 7 unallocated
10 days remain, including your protected reserve

                   Most days away      Fewer leave days*      Different dates*
Days away          17                  [computed]             [computed]
Vacation days used 8                   [computed]             [computed]
Remaining          10                  [computed]             [computed]
Breaks filled      3 of 3               3 of 3                  3 of 3
                   [Selected]          [View plan]            [View plan]
*Among materially different plans; actual labels explain the returned objective.

2027 YEAR VIEW
[January] [February] [March] [April]
[May]     [June]     [July]  [August: locked range]
[September] [October] [November] [December]
Legend: Proposed break · Locked dates · Charged workday · Unavailable

Mar 5–8     Short break   4 days away · 2 vacation days · 16 remain  [Lock dates]
May 7–10    Short break   4 days away · 1 vacation day  · 15 remain  [Lock dates]
Aug 6–14    Long break    9 days away · 5 vacation days · 10 remain  [Locked]
Each break: [Charged dates and day details]

[Save this plan] [Download calendar] [Copy leave request]
```

The dates and totals above use fixture A below. Other columns deliberately contain no invented rankings or numbers. The UI must use actual backend plans and objective facts. The first plan is selected initially. Up to three cards are sufficient; if only one exists, show it with “No materially different plans found under these rules,” only after a completed search.

The year view presents the selected plan only. Range fill identifies the break, lock outline/icon identifies fixed dates, and a dot/pattern plus text identifies charged dates. Background calendar facts come from the resolved common calendar; never invent holiday names. Unavailable dates and past dates remain distinguishable. Use exact ISO dates internally and localized unambiguous labels on screen.

Provide a semantic month/date summary and the complete chronological list for screen-reader users. Use one focusable control per break to open its details rather than forcing users through 365 buttons. The annual graphic can be an informative companion to that list. Clicking or keyboard-selecting a break scrolls/focuses the corresponding details. Counts and constraints are never color-only or hover-only.

The chart is a budget allocation: Used + Reserved + Unallocated = Available. The separate Remaining figure includes Reserved. The chronological “remain” column applies the selected plan in date order, regardless of slot order. Do not call this an employer balance or a future entitlement forecast.

## Screen D: lock and recalculate

1. Select a complete plan and choose Lock dates on its March break. Copy that exact interval into its slot, retaining the August lock and the original mix.
2. Announce “March dates locked. Recalculate to update the other breaks.” Mark existing output Last calculation. Do not issue a request on the toggle.
3. On Recalculate, capture the draft revision. After success, keep both locks exact and show changes in unlocked intervals and aggregate leave. If the common calendar changed, a lock's cost may change even though its dates do not.
4. On conflict, keep the locks, draft and last calculation. Show the precise repair. A new calculation must not silently unlock a trip to make the result feasible.

Locking is available from the selected current plan only. Unlocked cards in an old result cannot overwrite a newer draft. Unlock an ordinary slot to make its date range variable again; an exact-date slot first asks for a generated length range. Switching plans is viewing, not locking or saving. Switching to Find dates/Compare preserves their earlier state and the annual draft independently.

Input edits disable live Save/Download/Copy and close or invalidate their previews. Saved-record actions remain bound to their historical snapshots. Late responses cannot replace a more recent result; after any input change during a request, completion stays tied to the submitted revision or is discarded, never attached to the edited draft.

## Screen E: conflicts, reductions, and resource limits

```text
We could not fit all 3 requested breaks with these rules.
Your August dates and 3-day reserve are unchanged.

Reduced plan: 2 of 3 breaks
Includes: August long break + first short break
Not included: second short break, 3–5 days
[View reduced plan] [Use this reduced mix]

[Edit budget] [Edit months] [Edit mix or spacing]
```

Only show this state after a completed infeasibility proof. A reduced plan is a coherent feasible plan and displays its own totals, year view and exact omissions. It may be saved/exported with that disclosure. Use this reduced mix creates a new draft; viewing a reduction leaves the original three-break request intact. Omission priority is the form's visible order.

For locks alone costing 5 with available 7 and reserve 3: “Your locked dates use 5 vacation days. This pool allows 4 while keeping 3 in reserve. Shortfall: 1 day.” Offer explicit field/date edits; do not make a reserve-spending or lock-dropping plan. If there are several lock errors, list them all and link to the affected rows.

For an exhaustive full-mix failure without a proved single cause: “No combination fits all of these dates, lengths, spacing and budget constraints.” Do not assert that an arbitrary extra leave day will solve it. Show an exact minimum-cost shortfall only if the backend provides the completed diagnostic.

For a cap/deadline: “We could not finish checking this request. Try fewer breaks, fewer start months, or narrower lengths.” Keep reserve and locks unchanged. No reduced result, no “impossible,” and no ranked partial set. For provider/server/busy failures, use distinct retry copy; input narrowing is not the remedy for an unavailable service.

## Screen F: interpret, review, apply

Interpret proposes changes in a review panel with before/after fields. Absent values retain the structured inputs. An explicit reserve of 0 is a change; missing reserve is not. Explain preset assumptions, such as Short = 3–5 days and Long = 7–14 days.

“My August trip” produces a Choose saved trip control. List matching dates and names locally without uploading the store. Require selection and slot assignment even if there is one match. If there is no match, keep an unresolved prompt and allow manual dates. A new mix cannot delete or reassign locks without an explicit mapping decision. Do not apply unresolved dates or invent a year.

Apply accepted changes returns to the editable form and marks results stale. Generate plans is a separate action. Discard keeps the earlier draft unchanged. If the draft changed while interpretation was running, show that the proposal is outdated and require a fresh review instead of overwriting edits. The form works normally without an interpretation key.

## Screen G: save, reopen, and export

Saved → Annual plans shows name, plan year, number of breaks, used/remaining/reserve values, and calculation date. Label reduced plans. Explain once that storage belongs to this browser/profile and can be removed by clearing browser data. Opening a record is offline and displays a historical calculation without claiming the old balance is current.

Recalculate this plan opens a separate draft with its original request and recorded locks. Generated dates are not all converted to locks. Keep the saved snapshot and the previously active workspace intact. If dates are now past, submission points to the affected fields; historical viewing/copying/export still works. Back restores the earlier workspace and invoking focus.

Save/rename/remove/Undo report success only after storage succeeds. A duplicate save preserves the existing name. Corrupt or unsupported items have their own recovery row and explicit Remove; other items remain usable. A quota error keeps direct Copy/Download available.

Download exports the selected plan, one event per break. Copy preview lists inclusive dates, charged working dates, aggregate leave used, calculation date, and reduced-plan omissions. “Include budget and reserve” is off by default. No unrelated unavailable dates, credentials or interpretation text appear. Calendar files are tentative snapshots, not invitations, approvals, or synchronized calendars. If clipboard access fails, retain selectable text and no false Copied message.

## Independently worked fixtures

These examples use an injected local today of January 1, 2027, a fake holiday provider with no public holidays, and Friday/Saturday weekends. They are accounting/interaction fixtures, not claims about real 2027 holiday calendars or optimizer winners.

| Fixture | Exact expected facts |
| --- | --- |
| A: budget 18, reserve 3; personal day off May 10; selected intervals Mar 5–8, May 7–10, Aug 6–14; August locked | March: 4 away, charged Mar 7/8 (2). May: 4 away, charged May 9 (1). August: 9 away, charged Aug 8/9/10/11/12 (5). Total 17 away, 8 leave, 10 remaining, 3 reserve, 7 unallocated. Running balances 16, 15, 10. |
| B: historical saved August interval had personal day off Aug 12, annual calendar does not | Saved cost 4; annual August cost 5. Only dates/label are imported. The saved record stays at its historical 4. |
| C: same August lock, balance 7, reserve 3 | Spendable 4 versus locked cost 5; conflict shortfall 1; no generated or reduced plan may spend reserve or drop August. |
| D: Friday/Saturday gap between Jan 3–7 and Jan 11–15, minimum gap 0 | They have a working Jan 10 between them, so the working-date gap passes. Jan 3–7 and Jan 10–14 do not: Jan 8/9 are the only intervening dates and both are nonworking. |
| E: Jan 3–7 and Jan 15–19, minimum gap 7 | Jan 8–14 are seven intervening dates and include working dates, so spacing passes. Jan 14 start has only six intervening dates and fails. |
| F: unavailable Aug 7 inside the August lock | Cost remains 5; lock conflicts despite Aug 7 being nonworking. Removing an unrelated unlocked break cannot repair it. |
| G: local today Aug 1, notice 10, lock Aug 6–14 | Future lock remains valid under the notice exception, visibly disclosed. A generated Aug 6 start is too early. |
| H: exact Dec 28, 2027–Jan 3, 2028 lock in a 2027 plan | Reject as cross-year. Never clip to Dec 31 or alter its length/cost silently. |

The [test strategy](annual-plans-testing.md) adds a deliberately tiny optimizer oracle fixture and precise reduced-plan cases.

## State and accessibility acceptance

| State | Required interaction/evidence |
| --- | --- |
| Empty or invalid form | Labels, helper text and linked error summary; preserve input and focus first invalid field |
| Complete plans | Keyboard selection of cards, meaningful comparison table headings, totals before visualization |
| Locked/recalculated | Exact dates visible in list and year view; textual lock state and announced cost/date deltas |
| Reduced | Persistent reduced label, omitted slots, original request accessible, explicit Use reduced mix |
| Stale/submitting | No current-result actions or preview bypass; pending status announced without stealing focus |
| Conflict/cap/service failure | Distinct copy and repairs; original draft and locks preserved |
| Saved/offline | Snapshot age visible; no automatic request; recalculation/Back preserves suspended workspace |
| Storage/clipboard failure | No false success, intact records and selectable preview |
| All-locked or zero leave | One valid plan, finite totals, no artificial alternatives or zero-division score |

At AP 05/06 inspect the real Docker app at 1,440 px and 1,024 px; capture form, full plans, expanded charged dates, locks, reduced plans, stale and error states. Check keyboard-only actions, focus restoration, reduced motion, contrast, and meaning without color. AP 08/09 extend evidence to reload, saved/offline, quota/error recovery and actual downloads. This document's diagrams do not count as rendered acceptance.
