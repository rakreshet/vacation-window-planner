# Phase 0.5 comparison design

P05 01 design decision: one comparison workspace, reachable from the existing shortlist or from **Compare my dates**. This is an inspectable design prototype; its examples are fixed fixtures, not live recommendations.

## Desktop composition

```text
VACATION WINDOW PLANNER                         Find dates | Compare my dates
← Back to my results                            Israel · Fri/Sat weekend

Could nearby dates work better?
Your original dates stay here while you explore.
┌ YOUR DATES ─────────────────┐  ┌ NEARBY POSSIBILITIES ────────────────────┐
│ Jan 3–7, 2027               │  │ Same length, less leave                 │
│ 5 days off · 5 leave days   │  │ Jan 1–5 · Save 2 vacation days          │
│ 3 days remain              │  │ Starts 2 days earlier      [Compare]    │
│                            │  │                                         │
│ Start [Jan 3] End [Jan 7]   │  │ Longer break, no extra leave            │
│ [← 1 day] [1 day →]        │  │ Jan 1–9 · Gain 4 days off               │
│ [Update comparison]        │  │ Starts 2 days earlier      [Compare]    │
└────────────────────────────┘  └─────────────────────────────────────────┘

YOUR DATES                     SELECTED ALTERNATIVE
5 days off / 5 leave days       9 days off / 5 leave days
                               +4 days off · no extra vacation days
[day-by-day strip + text list]  [day-by-day strip + text list]
```

Keep original dates in the comparison summary while dates are edited. Editing creates a visible pending draft, not a silently changed baseline. Update comparison deliberately establishes the next baseline. Reset restores the original entry dates. Selecting a suggestion never establishes a new baseline.

## Mobile composition (360 px)

```text
Vacation Window Planner
[Find dates] [Compare my dates]
← Back to my results

Could nearby dates work better?
YOUR DATES · Jan 3–7
5 days off | 5 leave days
3 days remain
[Start] [End]
[Earlier] [Later] [Update]

Same length, less leave
[Jan 1–5: Save 2 days]

Longer break, no extra leave
[Jan 1–9: Gain 4 days off]

YOUR DATES / SELECTED OPTION
metric rows with explicit deltas
Day-by-day lists that wrap
```

No horizontal page scroll, modal, or drag interaction. The original summary precedes alternatives in both reading orders. Date controls and actions remain touch-sized.

## Worked walkthroughs

Fixture: January 2027, Friday/Saturday weekend, no observed holidays, balance 8, no negative allowance.

| Action | Observable state |
| --- | --- |
| Search for January, select Jan 3–7 | Original baseline: 5 days off, charged Jan 3/4/5/6/7, 5 leave used, 3 remain |
| Select Jan 1–5 | Baseline stays; alternative has 5 days off, charged Jan 3/4/5, saves 2 leave days, starts 2 days earlier |
| Select Jan 1–9 | Baseline stays; alternative has 9 days off, charged Jan 3/4/5/6/7, gains 4 days off for no extra leave |
| Move draft one day later | Draft becomes Jan 4–8, still 5 inclusive days; stale alternative cards are hidden until Update |
| Reset | Jan 3–7 is restored; explicit Update calculates again if needed |
| Close | Original Search cards, matching dates, feedback and focus return intact |
| Enter Jan 3–7 manually | Identical calculation without asking for a month or preferred length |

## Recovery and empty states

- **Over balance:** preserve exact dates and show “These dates need 2 more vacation days than your allowance.” Suggestions still obey the allowance.
- **No savings:** “No same-length break uses fewer vacation days within 21 days of your start.” Retain the baseline day detail and the other goal group.
- **No longer option:** state the 7-extra-day and 28-total-day bounds in help text, with no invented recommendation.
- **Changed inputs:** label “Changes not calculated” and hide obsolete alternatives. Updating never submits the Search form.
- **Failure:** preserve editable inputs; retry is explicit. Keep the original Search result in memory.
- **Zero leave:** display 0 as a meaningful cost; a ratio is never shown.
- **Expired session:** recreate context only when the person retries; do not discard dates or feedback belonging to the original Search.

## Keyboard and accessible presentation

1. The task switcher uses named buttons with pressed state.
2. Opening comparison focuses its heading; Back returns focus to the exact originating button.
3. Native date inputs and named one-day shift buttons work without a graphical calendar.
4. Selected alternatives use pressed state. Metrics are text; day classifications have both text and visual treatment.
5. A polite live region announces completed calculations and pending edits; errors use an alert.
6. Charge dates are available in a details/list view, including on small screens. Public holidays and weekends are distinct labels and never double charged.

## Verdict and implementation consequences

The same screen serves both entry paths. Visible deltas are more useful here than a second score. A day-by-day strip explains cost without making a calendar grid the only navigation method. Keep the existing Search mounted while comparing so its inputs, feedback, and scroll/focus can survive the round trip. The backend response must carry exact charged dates and signed date/length/leave deltas. Implement this design with semantic HTML and the existing green/cream/coral palette.
