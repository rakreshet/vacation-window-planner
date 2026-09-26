# Phase 0.75 UX walkthrough

**Status:** Inspectable design for review, not an implemented or visually certified UI. Product/backend contracts and PR dependencies are in the [plan](phase-0.75-plan.md). User-confirmed scope is manual personal calendars, opportunities after Search, and same-browser saving/export/copy without accounts.

## Information architecture

Retain the warm paper, forest green, mint, and coral visual language and the desktop canvas from the [frontend design contract](frontend-design.md). Add Saved options as a third task. Find dates remains the default. The planning form stays familiar; optional calendar rules live in a disclosed section below calendar/weekends and above Search.

Main order: submitted search context, explicit results, a separate opportunities section. Saved options is a focused task, not another set of recommendations or an annual plan. Keep comparison's original baseline and two improvement groups.

## Screen A: planning and calendar controls

```text
Vacation Window Planner             Find dates | Compare my dates | Saved options (2)

Build your search
[Optional description and Interpret]
Balance [8]  Allowed negative [0]  Calendar [Israel]
Weekends [Fri] [Sat]    Month [January 2027]    Preferred length [5]

▼ Your calendar rules                                      2 date changes · 1 unavailable range
  Days off without using vacation balance
  Jan 7, 2027                                             [Edit] [Remove]
  [+ Add days off]

  Extra working days
  Jan 8, 2027                                             [Edit] [Remove]
  These dates use vacation balance, even on a weekend or public holiday.
  [+ Add working days]

  Dates you cannot take a break
  Jan 2, 2027                                             [Edit] [Remove]
  Any break crossing these dates will be excluded from suggestions.
  [+ Add unavailable dates]

  Minimum notice [0] calendar days before the break starts

[Search]
Also checks for useful opportunities beyond your selected month or length.
```

An Add/Edit row uses labeled native start/end date fields and Apply/Cancel controls inline. A single day uses the same date twice. Apply changes the draft only. Disable Search/Update while a row has unapplied edits and show “Apply or cancel this date change first”; never submit while silently ignoring visible edits. A compact list shows exact ranges and their meanings; avoid an interactive year grid or drag-only editing for this small ruleset. Expand the relevant section on validation errors and focus the first erroneous field.

Opposing date changes show “These dates are marked both working and off. Choose one.” Keep both drafts visible for correction. Duplicate same-kind ranges merge after validation, with a brief announcement; unavailable dates may overlap either type because they mean something different.

Changing country with date overrides opens an inline choice: “Keep these date changes for the new calendar?” [Keep changes] [Clear date changes]. Until selected, calculation actions are disabled; reverting the country cancels that pending decision. Existing custom weekends, unavailable dates, and notice are preserved. Do not add a modal confirmation to ordinary field edits.

Interpret never modifies the rule section. If it changes country, use the same keep/clear decision. A valid form is always usable without interpretation credentials.

## Screen B: results and opportunities

```text
Your results                     Calculated with Israel · Fri/Sat · your calendar rules
[Explicit Search cards, scores, grouped dates and feedback]
Each exact date: [Compare nearby dates] [Save] [Download calendar] [Copy leave request]

Opportunities worth considering
These start outside your selected month or have a different length.

┌ Dates and total days off ────────────────────────────────────────────────┐
│ 9 days off · 3 vacation days · 5 remain                                  │
│ Starts outside your selected month                                     │
│ A longer break for relatively few vacation days                         │
│ Opportunity score 64  [How this is calculated]                          │
│ [Compare nearby dates] [Save] [Download calendar] [Copy leave request]    │
└────────────────────────────────────────────────────────────────────────┘
```

The 9/3 card is a scoring illustration, not a dated holiday recommendation. Real cards obtain all dates, totals, explanations, and differences from the backend. Opportunity scores are explicitly labeled and never placed in the Search rank sequence. Show up to three distinct opportunities by default. The year-long scan is described in secondary text, with the configured actual horizon available on demand.

For a complete empty scan: “No additional opportunities stood out under your current calendar rules.” For a capped/unavailable scan: “Your search results are ready. We could not finish checking additional opportunities.” Never describe an incomplete scan as finding none. Retry occurs on an explicit Search; do not add a hidden background retry.

Search results remain useful when the opportunity section fails. When explicit Search returns no results, preserve that empty-state explanation and show any qualifying opportunities below it, clearly outside the original criteria.

Grouped alternatives have their own exact-date action row. Disclosing dates does not trigger a calculation. Long action rows may wrap on desktop, but the primary Compare action should remain visually strongest and keyboard order should follow date, facts, then actions.

## Screen C: comparison with personal constraints

```text
← Back to my results

YOUR DATES                              NEARBY POSSIBILITIES
Jan 3–7, 2027                           Same length, less leave
5 days off · 4 vacation days             [Eligible alternatives only]
4 vacation days remain                  Longer break, no extra leave
                                        [Eligible alternatives only]
These dates overlap a date you marked unavailable: Jan 5.
This break starts before your earliest date: Jan 8.

[Save for later] [Download calendar] [Copy leave request]
These actions keep this calculation; they do not approve leave.

DAY BY DAY
Jan 3  Vacation day        Jan 4  Vacation day       Jan 5  Vacation day · Unavailable
Jan 6  Vacation day        Jan 7  Personal day off · No vacation day used
```

Fixture here: injected local today January 1, 2027; Friday/Saturday weekends; no base holidays; balance 8; personal day off January 7; unavailable January 5; minimum notice 7. Both reasons are visible although the cost fits the balance. The reasons do not replace the exact accounting.

For an extra working day on a normal weekend, show “Extra working day · Uses 1 vacation day,” with “Normally weekend” in secondary detail. Raw holiday/weekend membership never wins over the effective charged classification. Keep the existing comparison baseline/selection/reset behavior, with one explicit Update comparison action.

Use “Suggestions respect the calendar rules you entered; other commitments and employer approval have not been checked.” Replace the old blanket statement that personal availability has not been checked, since some entered constraints now are checked.

## Screen D: Saved options

```text
Saved options                                                  2 saved in this browser
Saved here only. Clearing browser data can remove these options. Calendar files are snapshots.
Saving an option does not reserve or deduct vacation days.

January break                       Jan 1–9, 2027 · 9 days off · 5 vacation days
Calculated Sep 26, 2026             [Open] [Rename] [Remove]

[Selected saved option]
January break
Saved calculation · Balance and calendar may have changed since Sep 26, 2026
9 days off · 5 vacation days used · 3 remained in this calculation
[Day-by-day facts] [Calendar rules used]
[Check these dates] [Download calendar] [Copy leave request]
```

An empty list explains how to save from Find dates or Compare. Save feedback changes the exact action to Saved and announces success only after storage succeeds. A repeated save opens or points to the existing record; it does not duplicate it or overwrite the user's name.

Opening a record works without the backend and without restoring credentials. Checking dates opens an independent Compare draft containing the saved context and its time zone; show “Review your balance and calendar before comparing.” It does not calculate on entry, unlike the explicit Compare action on a live result. Preserve the original saved calculation. Back returns to the saved item and its invoking action. Suspending/restoring earlier Compare also preserves its baseline/reset dates, results, stale state, and focus; leaving through task navigation must not overwrite that earlier workspace.

Check these dates can open an editable draft even when the dates may be past or too long for Compare. Explicit submission applies the server's current limits and retains the draft with a precise error if needed. The offline saved view must not hardcode or infer a current server limit from an old snapshot. Reading and exporting remain available. The screen never claims that a historical remaining balance is today's balance.

Remove takes effect immediately with a temporary Undo action, avoiding repetitive confirmations. Undo writes the same record and may itself fail due to storage; report that accurately. Rename commits on Save and cancels on Escape/Cancel. Corrupt or unsupported items show a separate recoverable row with Remove; valid records remain usable. Capacity/quota/unavailable errors preserve the option on screen so direct download/copy still work.

## Screen E: export and copy preview

Keep a compact inline details panel near the selected option. Calendar download produces a local file from the captured values; it is not a calendar connection. Copy leave request first shows the exact text with [Copy] and [Close]. If clipboard access fails, leave the selectable text visible and explain how to copy it manually. Editing/resubmitting the originating live calculation closes or invalidates its preview; a previously opened Copy action cannot bypass the stale-result rule. Previews of saved records remain bound to their captured values.

```text
Vacation option: Jan 1–9, 2027
Total days off: 9
Vacation days to request: Jan 3, 4, 5, 6, and 8, 2027 (5 days)
Calculated using the calendar recorded on Sep 26, 2026.
Planning option; leave has not been approved.
```

Use explicit full dates/ranges in the generated output, unambiguous across years. Do not export the person's balance, unrelated blocked dates, raw description, or credentials. Include applicable warnings for an ineligible or negative-balance snapshot. For zero leave, say no vacation days are required under that recorded calendar.

## Independently worked acceptance fixtures

All January fixtures use Friday/Saturday weekends, no provider holidays unless stated, balance 8, no negative allowance, and injected local today January 1, 2027. These are deterministic fixtures, not claims about a live provider calendar.

| Fixture/action | Literal expected result |
| --- | --- |
| Baseline Jan 3–7, no personal rules | 5 total days; charged Jan 3/4/5/6/7; 5 used; 3 remain |
| Add personal day off Jan 7 | Same 5 total; charged Jan 3/4/5/6; 4 used; 4 remain |
| Evaluate Jan 1–9 with day off Jan 7 and extra working Jan 8 | 9 total; charged Jan 3/4/5/6/8; 5 used; 3 remain; Jan 8 is charged despite being Friday |
| Add unavailable Jan 2 to previous fixture | Cost stays 5; exact baseline ineligible; Search/Compare alternatives/Opportunities cannot recommend any window crossing Jan 2 |
| Notice 7, no unavailable dates | Earliest permitted start Jan 8; Jan 7 start fails; Jan 8 start passes the notice rule, subject to other constraints |
| Both override kinds cover Jan 7 | Validation error; no calculation submitted; draft rows remain editable |
| Public holiday Jan 4 plus extra working Jan 4 | Jan 4 is charged; detail records its underlying public-holiday fact and effective extra-working classification |
| Save a disclosed grouped alternative | Saved start/end and charged dates are that alternative's values, never the group's representative |
| Edit balance after Search | Mark old results as last calculation; live Save/Export/Compare actions disabled until explicit Search |
| Open a live Copy preview, then edit a calendar rule | Preview closes or becomes non-actionable; no stale Copy/Download action survives |
| Two adjacent valid 366-day rules are saved and reopened | Canonical rule chunks remain valid inputs; a fresh session accepts them without changing their meaning |
| Save the Jan 1–9 fixture, reload after session expiry | Saved facts remain readable with their original calculation date; no token restored and no auto-search |
| Export the Jan 1–9 fixture | All-day DTSTART 20270101; exclusive DTEND 20270110; five charged dates in description |
| Export live, save, reload, rename, and export again | Same capture identity and calendar UID; renaming changes only display/export title |
| Export Dec 31, 2027–Jan 2, 2028 | Three-day all-day event; DTSTART 20271231 and DTEND 20280103, regardless of time zone |
| Select an opportunity and return from Compare | Explicit results, feedback, opportunity identity, scroll, and invoking focus remain intact |

## State and accessibility matrix

| State | Visible behavior and recovery |
| --- | --- |
| Rules changed | Pending draft indication; explicit Search/Update only; preserve last calculation |
| Submitting | Disable duplicate submit/actions; label operation; ignore obsolete responses |
| Invalid rule | Field-level message and summary; focus first problem; keep all input |
| Exact baseline ineligible | Keep totals, dates, and all reasons; eligible alternatives still considered |
| Search capped/error | No partial result list or opportunity substitute; retain editable draft |
| Opportunity unavailable | Complete explicit results plus separate recoverable notice |
| Saved locally | Announce only after successful write; saved count reflects storage |
| Storage blocked/full | No false Saved state; preserve old records and direct export/copy |
| Saved version/corruption | Item-level recovery; no automatic data erasure |
| Clipboard denied | Selectable text fallback, no false Copied state |
| Export generation failure | No success message; retain snapshot and allow retry/copy |
| Backend offline | Existing saved items still view/export/copy; calculations fail visibly without losing drafts |

Use named task buttons, native date inputs, headings and lists, inline validation, and polite live regions for completion. Move focus to the rule error or completed result heading, and restore the exact invoking control after task/detail navigation. Reasons and charged days have text in addition to color. No drag gesture, hover-only content, icon-only action, or automatic request is necessary. Respect reduced motion and preserve comparison's baseline-first reading order.

## Review and evidence required during implementation

Before treating UI work as complete, inspect the actual Docker application at 1,440 px and exercise keyboard-only paths through rule entry, invalid rules, Search, opportunity comparison, saved reload, and export/copy. Capture the populated, empty, stale, blocked, unavailable-service, and storage-error states listed in the plan. Check at 1,024 px for action wrapping and absence of horizontal page overflow.

This walkthrough provides a reviewable UX artifact for P075 00. It does not replace the rendered visual review and calendar-client checks in P075 10.
