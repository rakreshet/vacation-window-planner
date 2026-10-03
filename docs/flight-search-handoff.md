# Flight-search handoff

Verified on 2026-10-03 in an isolated worktree from origin/main `aa0e131` (PR #86). Unrelated changes in the original checkout were preserved.

## Interaction

Find flights is available on individual Search windows, the baseline and selected Compare window, and individual breaks in current or saved annual plans. One shared inline panel shows the selected break's inclusive local dates, optional manual departure and destination, and a readable, selectable travel summary.

Copy travel details writes the exact ISO date strings without timezone conversion. A missing or denied clipboard leaves the summary visible, focused and selected for manual copying. Opening the panel focuses its heading; Close flight panel and Escape return focus to its opener.

Open Google Flights is an ordinary link to `https://www.google.com/travel/flights`, with `target="_blank"` and `rel="noopener noreferrer"`. The panel explains that users enter the copied details there and the search is not automatically filled in. No flight provider, iframe, scraping, proxy, API, subscription or Google URL parameters are used.

Stale or pending current results disable Find flights with a visible explanation. Changing the selected plan, break, calculation or workspace invalidates an open panel. Historical annual plans retain their saved name, calculation time and timezone, and open without a backend request. The handoff does not write saved snapshots or alter leave calculations, budgets, reserves or locks.

## Automated verification

Each new behavior was observed failing through a rendered user journey before its implementation. The approved boundaries were rendered UI, browser/clipboard behavior, and API-request observation. Tests do not inspect private helpers.

The 22 flight journeys cover exact selected dates (including alternate, leap-day and cross-month dates), empty/manual locations, the plain external link, stale and pending state, navigation and selection invalidation, saved historical offline behavior, unchanged saved snapshots, clipboard failures and late completion, heading/opener focus, and zero additional API requests.

| Check | Result |
| --- | --- |
| Frontend tests, host and locked Docker dependencies | 220 passed in 32 files |
| Frontend lint, formatting, TypeScript and production build | Passed on host and in Docker |
| Backend regression in a separate test Compose project | 286 passed |
| Backend Ruff format/lint and mypy | Passed; 102 formatted files and 44 typed modules |
| Git whitespace check | Passed |

The backend suite reported one existing Pydantic AI event-loop deprecation warning. Clipboard denial and delayed completion were exercised at the automated browser boundary; the live browser verified successful copying.

## Live Docker acceptance

The dedicated Compose project is `vacation-flights-preview`, with its own database and `.env.example` configuration. The frontend is [http://localhost:56173](http://localhost:56173); API health is [http://localhost:59080/health](http://localhost:59080/health). Structured planning ran without interpretation-provider credentials.

| Journey | Observed result |
| --- | --- |
| England & Wales, Saturday/Sunday weekends, May 2027, one 3–14 day break, reserve 0, initial budget 4 | Initial plan May 1–9, 9 days away using 4 leave days |
| Compare leave budgets, then Use this budget for 5 | Draft became 5; old flight panel closed; Find flights displayed the recalculation explanation |
| Explicit Recalculate plans | Selected Most days away plan became May 1–10, 10 days away using 5 leave days, 0 remaining |
| Find flights and Copy travel details | Panel and actual browser clipboard contained 2027-05-01 and 2027-05-10; departure and destination initially empty; manual London Heathrow (LHR) / Lisbon copied correctly |
| Open Google Flights | Separate tab opened at the exact plain URL; the original planner tab and selected May plan were retained |
| Handoff request count | Planning API POST count stayed at six across opening, copying, closing and following the link |
| Keyboard | Heading received opening focus; Tab reached departure; Close and Escape restored Find flights focus |
| Saved annual plan with API stopped, fresh tab/reload | Historical May 1–10 plan opened and copied offline, retaining name, calculation time and timezone; API was then restored healthy |
| Desktop layout | Inspected at 1440px and 1024px; complete controls fit and no horizontal overflow |

![May handoff at 1440px](flight-evidence/current-1440.jpg)

![May handoff at 1024px](flight-evidence/current-1024.jpg)

## Short manual scenario

1. Open the preview and choose Plan my year. For a fresh run, use England & Wales, Saturday/Sunday weekends, year 2027, reserve 0, only May starts, and one break with minimum 3 and maximum 14 days away.
2. Generate with budget 4, choose Compare leave budgets, then Use this budget on the budget-5 scenario. Confirm Find flights is disabled until you explicitly select Recalculate plans.
3. Select Most days away. Confirm May 1–10, 10 days away and 5 leave days. Open Find flights; the summary must contain start 2027-05-01 and end 2027-05-10.
4. Optionally enter departure/destination, copy the details, and select Open Google Flights. Confirm a separate tab opens and the plan remains in the original tab. Enter the copied details on Google Flights yourself.
5. Return to the planner. Press Escape inside the panel and confirm focus returns to Find flights. Save the plan, reopen it under Saved options → Annual plans, and confirm the historical context.

The retained preview is already at step 3 with the accepted budget-5 May plan. No merge or deployment is part of this handoff.
