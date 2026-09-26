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
