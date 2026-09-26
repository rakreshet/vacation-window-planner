# Opportunities before flight integration

Research date: 2026-09-26. This is a research note, not an approved change to the PRD or implementation plan.

## Scope and conclusion

The current app recommends individual vacation windows and compares exact dates with nearby alternatives. The strongest expansion of that core is an annual plan that allocates one leave budget across several breaks, while respecting the user's actual calendar, existing commitments, and a reserve. A practical first release would establish the real calendar, expose the already-planned proactive opportunities, and let users save and export a choice.

These are product recommendations, not measured effects on conversion or retention. The research establishes that comparable capabilities exist and that leave underuse is a real issue; it does not establish willingness to pay, demand among this app's users, or that any feature will produce a particular growth rate.

## What the evidence supports

Pew's February 2023 survey found that 46% of U.S. workers receiving employer-provided paid time off said they took less than offered. Among those taking less, 49% worried about falling behind at work and 43% felt bad about colleagues taking on additional work. The survey's PTO category includes vacation, medical appointments, and minor illnesses; these are not vacation-only figures, and the survey does not represent Israel or the UK. Its practical implication is that attractive dates alone may not resolve the barrier: making a plan concrete and easy to request is worth testing. [Pew Research Center, August 2023](https://www.pewresearch.org/short-reads/2023/08/10/more-than-4-in-10-u-s-workers-dont-take-all-their-paid-time-off/)

The competitive landscape already extends beyond a simple bridge-day calculator. The table below records capabilities advertised on primary product pages or publisher-maintained documentation, inspected on the research date. The products were not run through an end-to-end calculation audit. These are feature observations, not evidence of accuracy, popularity, or commercial success.

| Product | Advertised capability relevant to us | Product implication |
| --- | --- | --- |
| [Orbis Leave Optimizer](https://orbistracker.com/free-tools/leave-optimizer/) | One long break, two separate holidays, or multiple long weekends; blocked dates; annual view; export all planned breaks. | Annual allocation and blackout dates are established capabilities. Our opportunity is a clearer, more trustworthy plan that supports personal commitments and editable tradeoffs. |
| [TimeOffCalendar](https://timeoffcalendar.com/en) | Shared annual view, each person's PTO budget and weekends, country holidays, company/custom days, and highlighted overlap. | Couples planning is a direct competitive category. Merely overlaying two calendars would not distinguish us. The useful extension is recommending shared windows with a transparent cost and remaining balance for each person. |
| [HolidayStack publisher listing](https://play.google.com/store/apps/details?id=com.clearstackapps.holidaystack) | Proactive break suggestions, carryover expiry, custom days, saved draft/booked/taken plans, reminders, and ICS export. | Opportunity suggestions, lifecycle tracking, and expiry alone are not novel. Combining these well with our date comparison could still improve the product substantially. |
| [PTO Planner calculator](https://pto-planner.com/) | Future balance projection, accrual or upfront allowance, caps and rollover, custom company closures, and a configurable leave-year start. | Balance forecasting has an existing consumer use case, but implementing it fully introduces policy complexity. Start with user-supplied assumptions and a visible balance timeline if interviews confirm need. |
| [Leave-Me-Alone open-source repository](https://github.com/ngweimeng/leave-me-alone) | Annual/custom-period optimization and a documented household mode with per-person budgets, calendars, prebooked days, and shared-time results. | Even algorithmic household coordination is not an unoccupied space. This source is a reference implementation and author documentation, not proof of adoption or of its privacy guarantees. |

## Ranked core product candidates

This is strategic priority, not implementation order. Effort is relative and provisional; it is not a delivery estimate.

| Rank | Candidate | Benefit and concrete first version | Relative effort and main uncertainty |
| --- | --- | --- | --- |
| 1 | Annual plan across several breaks | Answer “How should I spend my remaining leave this year?” Generate a small set of plans, such as one longer break plus two short ones. Lock existing trips, reserve a user-selected number of days, and show the balance after every chosen break. Recompute when a trip is removed or fixed. | Medium–high. Requires selecting a nonoverlapping combination, not independently ranking windows. User research must establish whether people want a whole-year plan or only the next trip. |
| 2 | Personal work calendar and unavailable dates | Make recommendations usable: toggle holidays the employer observes, add paid company closures, mark dates that cannot be taken, and optionally restrict to school-holiday ranges. Explain exactly which dates consume leave. Preserve existing custom weekends. | Medium for explicit manual dates; significantly higher for imported calendars and school coverage. This is the first foundation to build because wrong assumptions undermine every later recommendation. |
| 3 | Couples and family coordination | Calculate common breaks using separate budgets, weekends, and holidays. Show “you use 3 days; your partner uses 5” and each remaining balance. Include children's availability as a constraint without inventing a leave budget for them. | Medium–high. A single user entering two profiles is a smaller first version than invitations, accounts, and live collaboration. Fairness requires a declared objective rather than minimizing only the household's summed leave. |
| 4 | Proactive opportunity discovery | In a separate opportunities section, surface a few useful future breaks beyond the selected months or trip length, with an understandable reason. This is already planned independently of flights; delivering it earlier creates value without provider integrations. | Low–medium relative to the other candidates. Must suppress duplicates and honor personal blocks and balance. An in-app scan can launch before any notification service. |
| 5 | Save, share, export, and request leave | Convert a recommendation into a named saved plan, a shareable summary, an ICS file, and copyable exact leave dates for a manager request. Separate “considering,” “requested,” and “approved” status if needed; a saved suggestion must not silently deduct leave twice. | Low–medium. Annual plans need durability beyond the current anonymous 30-day session. Decide an explicit recovery/export model before promising long-term storage. |
| 6 | Future leave balance and expiring days | Show whether the user can afford the break on its dates and how much leave may expire under their supplied policy. Begin with fixed monthly accrual and explicit expiry buckets only if that covers the target audience. | Medium–high. Pay-period schedules, caps, carryover, rounding, leave years, half-days, and borrowing interact. Do not present a projection as an employer-approved entitlement. |
| 7 | Destination seasonality without flights | Start with a small curated destination set and explain typical temperature, rain, and daylight fit for the user's dates and preferences. Include domestic options where relevant. | Medium–high. Adds a data source and quality work, and requires an explicit change to the current flight-gated destination contract. It provides inspiration, without establishing availability or current travel cost. |

Recommended build sequence: personal calendar plus proactive opportunities plus save/export; then annual plans; then two-person planning. Forecasting belongs after learning which leave policies users actually have. The largest strategic change is annual allocation, but its recommendations need the smaller foundation first.

The initial save/export slice can use same-device storage, a downloadable calendar file, and a copyable leave-request summary. Durable cross-device links and collaboration are larger follow-ups. If pilot users identify accrual as the main reason recommendations are unusable, move forecasting earlier. Treat destination seasonality as a separate experiment, and avoid turning all seven candidates into one release.

## Feasibility and important product rules

### Calendar correctness before more calendar coverage

National holidays are a starting template, not proof that a day costs no leave. For example, UK government guidance says bank holidays do not have to be paid leave and may be included in statutory entitlement. The product should let users confirm which dates are employer-provided nonworking days and which dates consume their supplied balance. This prevents confusing an inclusive allowance with an allowance that excludes bank holidays. [GOV.UK holiday entitlement](https://www.gov.uk/holiday-entitlement-rights)

A company shutdown and a forbidden vacation period are different inputs. A paid closure can extend a break; a mandatory shutdown charged to leave consumes the budget; a blackout prevents taking vacation. Existing booked leave is a commitment, not automatically a free company holiday. The model and explanation should preserve these meanings even if the interface initially uses simple date ranges.

School calendars can make family recommendations materially more relevant, but country-level defaults are insufficient. The UK government directs parents to local councils because term and holiday dates vary. Croydon additionally notes that some schools use different dates and that parents should check individual schools for training days. An initial version should accept manual school-break ranges or a user-confirmed calendar, showing its source and year, before claiming comprehensive school coverage. [GOV.UK school dates](https://www.gov.uk/school-term-holiday-dates), [Croydon Council school dates](https://www.croydon.gov.uk/schools-and-education/schools/school-term-and-holiday-dates)

### Export is a smaller step than live calendar integration

iCalendar is an open format for exchanging events and other calendar data. RFC 5545 supports all-day date values and defines event end dates as exclusive. This makes downloadable ICS an appropriate first handoff: clearly distinguish the whole break from the working dates the user must request, and avoid adding an extra day through inclusive-end conversion. A downloaded file is a snapshot, not ongoing synchronization. [RFC 5545](https://www.rfc-editor.org/info/rfc5545/)

Later, Google Calendar's Freebusy API can return busy intervals for accessible calendars using free/busy scopes. That can support conflict detection without requiring the product to interpret every event title. However, a busy meeting does not necessarily mean vacation is impossible; users should choose hard blocks versus soft conflicts. [Google Calendar Freebusy API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)

Microsoft Graph exposes a similar `getSchedule` endpoint. Its documented least-privileged permission is `Calendars.ReadBasic`; delegated personal Microsoft accounts are not supported for this endpoint. Therefore, a proposed “connect any Outlook calendar” feature needs a separately validated personal-account path. API authorization and organizational access policies should be investigated before committing to universal calendar sync. [Microsoft Graph getSchedule](https://learn.microsoft.com/en-us/graph/api/calendar-getschedule?view=graph-rest-1.0)

### Optimization must describe its actual benefit

- Optimizing dates normally rearranges existing nonworking days into longer consecutive breaks; it does not create additional annual leave or additional weekends. Show consecutive days away, leave spent, and reserve remaining. Do not sell the year's already-free weekends as newly earned days.
- Two independently strong windows can overlap or spend the same balance. An annual plan must validate the combination as a whole and count each chargeable date once.
- Allow the user to choose a desired mix and spacing. Maximizing a single efficiency ratio can overproduce small breaks or concentrate everything around one holiday cluster.
- Keep the reserve explicit and user-controlled. Different people need unused leave for different purposes; the product should not assume every available day should be scheduled.
- For shared plans, show per-person cost and feasibility. A plan with the lowest total leave can still be unreasonable for the person with the smallest balance.
- A full work calendar may appear busy every weekday. Treating every meeting as an absolute block would eliminate the dates on which people could normally request leave.
- Saved plans, long-term reminders, and collaboration require a durability decision because the current anonymous session expires by default after 30 days. Calendar export can offer immediate utility while that decision is made.

### Destination seasonality is feasible, with a product-contract decision

Open-Meteo's [Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) provides reanalysis datasets with temperature, precipitation, sunshine, and daylight variables. These can support historical seasonal summaries for a small destination catalogue. Label them as typical conditions, not forecasts for the future vacation dates. A preferred temperature range is a user preference, not a scientifically established travel-quality score.

The [Open-Meteo pricing page](https://open-meteo.com/en/pricing), checked on the research date, distinguishes noncommercial free access from commercial subscriptions and places historical/climate API access in the Professional tier or higher. Data attribution is required. Confirm licensing and the selected endpoint's cost before implementation.

The current [PRD](prd.md), [HLD](hld.md), and P1 06 task in the [implementation plan](implementation-plan.md) require live flight availability for destination/travel recommendations. A no-flight destination-inspiration capability therefore needs an explicit product decision. Weather data cannot establish route availability, bookability, current prices, or crowd levels.

### Repository-specific implementation boundaries

- The actual [Search contracts](../backend/src/vacation_window_planner/domain/contracts.py) accept selected months, preferred length, and a result limit. Personal blackout dates and dated employer exceptions are new capabilities; custom weekends already exist.
- [Phase 0.5](phase-0.5-plan.md) already compares exact dates with nearby ways to save leave or extend the break. Do not count another nearby-date comparison as a new strategic feature.
- The backend persists snapshots, but [App.tsx](../frontend/src/App.tsx) keeps the active token and results in React state. There is no user-facing saved-plan library or recovery flow. A session bearer token must not be reused as a public share link.
- Annual plans need a shared budget and a combination-selection layer. Preserve committed leave exactly once, distinguish leave already deducted from leave still to be charged, enforce the reserve, and report unique days inside selected breaks.
- Existing candidate caps and complete-result semantics must be preserved or deliberately redesigned for annual and household search. Do not remove safeguards or describe a partial search as globally optimal.
- Start proactive discovery inside the app. Persistent monitoring adds saved preferences, a scheduler, a delivery channel, consent, and deduplication.

## Validation before committing to a large expansion

Use realistic tasks with existing or target users rather than asking whether a feature sounds useful. Have one person allocate their next six to twelve months of leave, and a couple find one shared break. Observe which calendar corrections they need, whether they retain an emergency reserve, and whether the result is actually saved, exported, or requested.

Useful product measures are the proportion of recommendations marked feasible, time to choose a plan, plan saves/exports, and later confirmation that leave was requested. Compare these before and after the change. Page views, generated options, competitor feature lists, and the older PTO-underuse survey do not by themselves establish that the product delivers a meaningful improvement.
