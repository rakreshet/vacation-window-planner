# Budget playground and year card experience

Date: 2026-10-03. This walkthrough specifies the [QW plan](quick-wins-plan.md), following the existing desktop design system and Appearance controls.

## Budget playground

1. Generate a normal annual plan. Results retain existing plan selection, save and leave-request copy actions.
2. A separate **What could one leave day change?** section explains that the comparison holds trips, calendar, reserve and locks fixed and compares Most days away.
3. Select **Compare leave budgets**. Show progress while retaining current plans. This is one bounded request; editing fields never starts a request automatically.
4. Display up to three budget cards in ascending order: one fewer day, current budget, one more day. The baseline is clearly labeled. Each card shows available leave, days away, leave actually used, and requested breaks fulfilled. Date changes are listed by break; full plans show literal deltas, including zero.
5. Reduced cards name missing breaks. Conflicts provide their facts; unfinished scenarios say checking did not finish. Never label an unfinished neighbor as no benefit. At budget/reserve boundaries, explain why the unavailable neighbor was excluded.
6. Select **Use this budget** on a completed scenario. Copy only that available budget into the editable annual draft, mark prior plans stale, and announce that Generate plans is needed. Preserve locks and reserve. The user then generates normally.
7. Draft edits or replacement calculations invalidate comparisons. Late responses cannot restore obsolete results. Service/provider/busy errors leave the draft intact and permit an explicit retry.

Worked demonstration: May 2027, England & Wales, Saturday/Sunday weekends, one 3–14 day May break, reserve 0. Cards for budgets 3/4/5 show 6/9/10 days away. The 4-day card explains that one more leave day extends the break through the next weekend. Include a plateau fixture so the presentation also handles no change.

## Shareable year card

1. From the selected annual plan, select **Preview year card**. The same action exists inside an opened saved annual plan, even offline.
2. Open an inline preview panel with a clear heading and Close action. It contains the visual card and a semantic text summary. Keyboard focus enters the preview; Escape/Close returns to the opener.
3. Default card: **My 2027 breaks**, days away, number of breaks, a 12-month date map, chronological breaks with inclusive dates and locked labels, calculation date, and **Proposed plan**. Reduced plans visibly identify omissions. A saved card retains its historical calculation date and may use the saved plan name.
4. **Include leave details** defaults off. When selected, add leave used, available budget, remaining balance and protected reserve. The preview immediately reflects the choice without a network request. Never include the complete personal calendar or unavailable dates.
5. Select **Download PNG** only after preparation. Show a local filename, successful preparation/download feedback, or an actionable rendering error. Export exactly the reviewed snapshot and options. No public-link or messaging action is included.
6. Changing the selected plan, editing the annual draft or replacing results closes/invalidates the current preview and pending download. Opening another saved plan similarly replaces the capture. Saved records remain unchanged.

## Visual direction and acceptance states

Keep current plum/lavender cards, editorial headings, local font stacks and named theme variables in the app. Budget cards use text labels and explicit numbers as well as color; stable loading and error regions avoid layout jumps. At 1024px, comparison cards can stack without page overflow; wider desktops show a readable row.

The exported card uses a deliberate light palette with sufficiently large labels, neutral unselected dates and clearly marked selected intervals. Use vector calendar/landscape artwork and deterministic SVG rendering; image generation and external assets are unnecessary. Choose final PNG dimensions after inspecting a six-break card, rather than compressing it into an unreadable square.

Verify 1024px and 1440px, keyboard-only controls, focus return, announced status/errors, reduced motion, default privacy, optional details, six breaks, cross-month dates, alternate plan selection, stale/pending work, and offline historical preview. Mocked download tests cannot substitute for inspecting an actual PNG file.
