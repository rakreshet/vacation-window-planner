# Annual browser integration evidence

## AP 05 — structured workspace

September 26, 2026: rebuilt the local Compose application with migration `20260926_09`. Backend and database were healthy; `http://localhost:15173/api/health` returned `ok` / `connected`. Structured planning requires no model provider.

A live in-app-browser journey entered balance 18, reserve 3, Israel Friday/Saturday weekends, a personal day off on May 9, 2027, and the three exact-date slots from UX fixture A: March 5–8, May 7–10, August 6–14. Explicit generation displayed 17 days away, 8 leave days used, 10 remaining including the reserve, and 7 unallocated. Chronological balances were 16, 15 and 10. The newly persisted snapshot was independently read through `AnnualRunRepository` and matched those dates and balances.

The layout was inspected at 1,440×1,000 and 1,024×900. At 1,024 px, the sections stack and measured document width equals viewport width, with no horizontal overflow. Native date controls were exercised through accessibility setters; the in-app browser's generic date `fill` did not update them, so no application workaround was introduced.

![AP 05 worked fixture at 1440 px](annual-evidence/ap05-worked-1440.png)

Automated rendered journeys cover independent task draft, explicit generation, slot order/month/gap edits, manual range conversion, explicit saved-date selection without copying its calendar, incomplete lock-editor protection, conflict/cap/reduction states, and rejection of inconsistent accounting. The final AP 05 frontend run passed all 87 tests, including 12 annual rendered tests. ESLint, Prettier, TypeScript and the production build passed. Review regressions cover removing an open slot editor and inconsistent slot/fulfillment metadata; clocks and time zones are fixed in the annual tests.

Year visualization, richer comparison/recalculation, interpretation, saving whole plans and export belong to AP 06–09. This is milestone evidence, not AP 10 release acceptance or calendar-client import verification.

## AP 06: comparison and recalculation

September 26, 2026: the real Docker app returned three alternatives for 2027, Israel,
Friday/Saturday weekends, 18 available days and 3 reserved. The first used 12 leave
for 24 days away; the fewer-leave alternative used 4 for 13 days away. Locking
May 11–15 and explicitly recalculating preserved the interval and reported unchanged
dates/cost. Enter on its year-view detail control opened and focused the charged-date
details (May 11 and May 13). The remaining alternative objectives respected the lock.

The twelve months form four columns at 1,440 px. Document width matched viewport at
1,440 and 1,024 px. [Year-view capture](annual-evidence/ap06-year-1440.png).
The graphic accompanies a chronological accessible list with one detail control per
break. Automated rendered tests cover late responses, selected-plan locking, exact
short-slot unlocking, failed recalculation preservation, explicit reduced-mix adoption,
cost deltas and independent draft navigation. Frontend: 94 tests, lint, formatting,
type checking and production build pass. Further accessibility and operational acceptance
remain AP 10; this milestone is not a claim that all final acceptance scenarios passed.

## AP 08: browser-only saved annual plans

September 26, 2026: generated a real three-break plan, saved it, reloaded the page,
and opened Saved → Annual plans. The historical result retained 12 used, 6 remaining,
3 reserved and its original calculation timestamp. Recalculate opened a separate draft
with the original generated slots still unlocked. Back restored focus to Recalculate
this plan. [Saved calculation capture](annual-evidence/ap08-saved-1440.png).

The full frontend suite passed 107 tests, followed by a passing historical-year regression (108 total) plus lint, formatting, type checking and
production build. Storage and rendered seams cover stable identity, immutable selected
plan captures, no server run IDs, duplicate names, changed constraints, strict accounting
and year-fact validation, corrupt/unsupported/oversized items, capacity, quota, rename,
remove/Undo, another-tab changes, reload and preserved workspace. Offline opening is
verified with a rejecting HTTP boundary in rendered tests; the live browser check above
was performed with the local service available. Limits are 20 records and 256 KiB each.
Annual records use their own namespace and leave existing vacation records unchanged.

## AP 09: whole-plan export and copy

September 26, 2026: opened the real saved annual result and its copy preview. It listed
April 15–28, May 11–15, and September 29–October 3 with 12 aggregate leave days and
the original timestamp. Budget/reserve inclusion was unchecked, and preview text did
not include those values. [Preview capture](annual-evidence/ap09-preview-1440.png).

Independent `ical.js` parsing verifies one tentative, transparent all-day event per
break, distinct stable UIDs, exclusive ends, Unicode escaping/UTF-8 folding, no attendees,
reduced-plan omissions and opt-in budget text. Literal year-end, leap-day and DST-boundary
cases pass. Rendered tests cover denied clipboard fallback, stale preview closure even
after recalculation with identical result identity, and download remaining available
when saving is blocked. The full 112-test frontend suite passed before three additional
boundary cases (115 total); focused cases and production build pass after changes.

Actual file delivery is **not verified** in the available in-app browser: native
Download annual calendar was invoked, its download-event wait timed out, and no matching
file appeared in the local Downloads directory. This is not counted as a successful
download. Google Calendar and a second-client import remain pending, as in Phase 0.75.
Release acceptance stays conditional until those client checks are recorded; parser
and download-adapter tests do not replace them.

## Annual form consistency follow-up — September 26, 2026

The balance label's wrapped Required marker put the input 16.5px below the calendar selector. Sharing label/control/help grid rows now gives a measured 0px top-edge difference at 1440px and 1024px; both controls remain 48px high, and the 1024px page has no horizontal overflow.

Compare, annual lock entry and annual reference selection now share `DateRangeFields`. Annual bounds use today in the planning time zone, the selected/proposed year, and the selected start as the end's lower bound. Exact one-day trips remain supported. Compare retains its historical-baseline semantics while sharing ordered-range behavior. Typed/saved past annual dates are rejected before keeping a lock or applying a resolved reference; invalid inputs remain editable.

Live current-year verification: start minimum September 26, 2026 and maximum December 31; choosing October 10 advances the end minimum to October 10. A manually entered October 9 end is invalid with browser `rangeUnderflow` and an inline repair message. Automated red/green cases cover local midnight (Jerusalem already September 27 while UTC is September 26), typed past locks and proposed-year references. Full frontend checks: 125 tests, ESLint, Prettier, TypeScript/Vite pass. Backend behavior is unchanged.
