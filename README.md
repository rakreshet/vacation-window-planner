# Vacation Window Planner

A Docker-based app for finding useful vacation dates. Find dates ranks vacation windows; Compare my dates checks exact dates and nearby alternatives. Personal calendar rules and proactive opportunities help account for work schedules. Plan my year coordinates several vacations under one leave budget and reserve. Save options and annual plans in this browser, and copy reviewed leave requests. These planning features are on `main` through [#72](https://github.com/rakreshet/vacation-window-planner/pull/72). Destinations and live flights remain future scope. See the [delivery record](docs/progress.md), [PRD](docs/prd.md), and [operational decisions](docs/open-decisions.md).

Search and Compare support Israel, U.S. federal holidays, and England & Wales bank holidays. Weekend days remain editable; see [calendar scope and examples](docs/runbook.md#supported-holiday-calendars).

## Product and implementation documents

- [Product requirements (PRD)](docs/prd.md)
- [High-level design (HLD)](docs/hld.md)
- [Phase 0.5 comparison plan](docs/phase-0.5-plan.md)
- [Phase 0.5 comparison UX](docs/phase-0.5-ux.md)
- [Phase 0.5 acceptance record](docs/phase-0.5-acceptance.md)
- [Phase 0.75 product, backend, frontend, and PR plan](docs/phase-0.75-plan.md)
- [Phase 0.75 UX walkthrough](docs/phase-0.75-ux.md)
- [Phase 0.75 acceptance and manual testing](docs/phase-0.75-acceptance.md)
- [Annual multi-vacation BE/FE plan and dependent PR sequence](docs/annual-plans-plan.md)
- [Annual planning UX walkthrough](docs/annual-plans-ux.md)
- [Annual planning TDD seams and test strategy](docs/annual-plans-testing.md)
- [Budget playground and year-card stacked plan](docs/quick-wins-plan.md)
- [Budget playground and year-card acceptance](docs/quick-wins-acceptance.md)
- [Flight-search handoff and acceptance](docs/flight-search-handoff.md)
- [Research on opportunities before flights](docs/non-flight-opportunities-research.md)
- [Implementation task plan](docs/implementation-plan.md)
- [Delivery progress and PR map](docs/progress.md)
- [Operational decisions and future choices](docs/open-decisions.md)
- [Local runbook](docs/runbook.md)
- [Phase 0 frontend design contract](docs/frontend-design.md)
- [Security guidance](SECURITY.md)
- [Domain language](CONTEXT.md)

The Markdown documents are the version-controlled source of truth. Review changes to them in pull requests; any Word copies are point-in-time exports and should be regenerated from the approved Markdown rather than edited independently. Find dates, Compare my dates, and Saved options support manual personal calendars, explicit-Search opportunities, browser-only saves, and reviewed leave-request copying.

Annual planning supports several vacations sharing one budget, with a protected reserve and locked dates. Phase 1 continues to mean destinations and flights.

## Run locally

You need Docker Desktop (or another Docker Engine with Compose) running. You do **not** need to install Python, Node.js, or PostgreSQL on your machine.

From the repository folder:

```sh
cp -n .env.example .env
docker compose up --build --detach
docker compose ps
```

`cp -n` creates the local configuration only if it does not already exist. The example password is for local development; edit `.env` before sharing access to the app. `.env` is ignored by Git.

Open [http://localhost:15173](http://localhost:15173). Once startup finishes, the page should say **Service ready**. The API health check is at [http://localhost:18080/health](http://localhost:18080/health). Docker Compose starts PostgreSQL, applies the database migration, starts the API, then starts the frontend. The host ports are bound to localhost, not exposed publicly.

Structured search works without an AI key. To enable the optional Interpret action, set `INTERPRET_PROVIDER=xai` and `XAI_API_KEY` in `.env` for Grok, or select `gemini` and set `GEMINI_API_KEY`. The default provider is `gemini`; the backend uses Pydantic AI for both. Set the matching `XAI_MODEL` or `GEMINI_MODEL` only if you need a nondefault model. Rebuild and recreate the backend after changing these settings: `docker compose up --build --detach --force-recreate backend`. Never use a `VITE_` variable for provider secrets. CORS, request-size, session-expiry, and source-text-retention settings are documented in the [runbook](docs/runbook.md).

If either default host port is occupied, add `WEB_PORT=15174` or `API_PORT=18081` to `.env`, restart with `docker compose up --build --detach`, and use the new port. To see the actual mapped ports, run `docker compose ps`.

The frontend uses `/api` as its browser API base path by default. Set `VITE_API_BASE_URL` in `.env` only if you provide a different browser-accessible API path; the local Vite proxy still handles `/api`.

To see logs or stop the app:

```sh
docker compose logs --tail=100
docker compose down
```

`docker compose down` keeps your PostgreSQL data. Use `down --volumes` only if you deliberately want to erase that local data.

## Tests and checks

These commands also run entirely in Docker:

```sh
docker compose --profile test run --build --rm backend-test
docker compose --profile test run --build --rm frontend-test
docker compose --profile test run --no-deps --rm backend-test ruff check .
docker compose --profile test run --no-deps --rm backend-test mypy src
docker compose --profile test run --no-deps --rm backend-test ruff format --check .
docker compose --profile test run --no-deps --rm frontend-test npm run lint
docker compose --profile test run --no-deps --rm frontend-test npm run format:check
docker compose --profile test run --no-deps --rm frontend-test npm run typecheck
docker compose --profile test run --no-deps --rm frontend-test npm run build
```

The backend test uses a separate disposable `vacation_test` PostgreSQL database; the migration test refuses another database target. GitHub Actions runs the same checks on pushes and pull requests.

## Local-run skill

Codex can use the versioned [run-vacation-window-planner skill](.agents/skills/run-vacation-window-planner/SKILL.md) when you ask it to start or check this app locally. The skill follows this README and preserves existing local configuration and database data.

## Annual multi-vacation planning

**Plan my year** coordinates up to six breaks under one available-leave budget and protected reserve. Review complete alternatives, lock dates and explicitly recalculate, save one historical plan in this browser, or copy the whole plan's leave request. Locked trips count in the mix. Natural-language interpretation is optional and only proposes editable inputs.

See the [annual plan](docs/annual-plans-plan.md), [acceptance results](docs/annual-plans-acceptance.md), [progress/PR stack](docs/progress.md#annual-planning--several-vacations-one-budget), and [operations](docs/runbook.md#annual-planning).

## Budget playground and shareable year card

The [QW PR stack](docs/progress.md#budget-playground-and-shareable-year-card) adds **Compare leave budgets** after annual generation: compare Most days away with one fewer or one more available leave day while preserving your calendar, breaks, locks and reserve. **Use this budget** edits the draft and requires explicit recalculation. Comparisons are hypothetical and do not create annual database rows.

**Preview year card** creates a 12-month image from the selected current or saved annual snapshot, with exact dates, locked status and reduced-plan omissions. Leave figures are private by default; Include leave details opts them in independently of copying. Saved cards work offline. PNG generation uses native browser APIs without external images, fonts, uploads or provider credentials. Native file-delivery verification is pending at the user's request; see the [acceptance record](docs/quick-wins-acceptance.md).

## Find flights for a break

**Find flights** opens a compact panel for an individual Search or Compare result, or a break in a current or saved annual plan. Enter both locations, then select **Search Google Flights** to open a new tab with the route and selected dates prefilled. The handoff uses an undocumented, best-effort Google URL: check the airports and dates there, and enter them manually if needed. Prices, availability and booking remain on Google Flights. Close the panel with its top-right × or Escape.

Current results must be up to date; edit the draft or adopt a budget, then explicitly search or recalculate before finding flights. Saved annual plans retain their historical context and work offline. See the [manual scenario and verification record](docs/flight-search-handoff.md).
