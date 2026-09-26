# Vacation Window Planner

A Docker-based proof of concept for finding useful vacation dates. Phase 0 recommends ranked date windows from an anonymous session, effective holiday calendar, editable structured constraints, and optional AI text interpretation. Phase 0.5 adds exact-date comparison with nearby ways to save vacation days or extend a break; phase 1 will add destinations, live flights, and separate proactive vacation opportunities. The core Phase 0 product rules are in the PRD; remaining operational choices are in [docs/open-decisions.md](docs/open-decisions.md).

Search and Compare support Israel, U.S. federal holidays, and England & Wales bank holidays. Weekend days remain editable; see [calendar scope and examples](docs/runbook.md#supported-holiday-calendars).

## Product and implementation documents

- [Product requirements (PRD)](docs/prd.md)
- [High-level design (HLD)](docs/hld.md)
- [Phase 0.5 comparison plan](docs/phase-0.5-plan.md)
- [Phase 0.5 acceptance record](docs/phase-0.5-acceptance.md)
- [Implementation task plan](docs/implementation-plan.md)
- [Delivery progress and PR map](docs/progress.md)
- [Open product decisions](docs/open-decisions.md)
- [Local runbook](docs/runbook.md)
- [Phase 0 frontend design contract](docs/frontend-design.md)
- [Security guidance](SECURITY.md)
- [Domain language](CONTEXT.md)

The Markdown documents are the version-controlled source of truth. Review changes to them in pull requests; any Word copies are point-in-time exports and should be regenerated from the approved Markdown rather than edited independently. The phase 1 proactive-opportunity capability is planned here, not implemented in the current foundation.

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
docker compose --profile test run --no-deps --rm frontend-test npm run build
```

The backend test uses a separate disposable `vacation_test` PostgreSQL database; the migration test refuses another database target. GitHub Actions runs the same checks on pushes and pull requests.

## Local-run skill

Codex can use the versioned [run-vacation-window-planner skill](.agents/skills/run-vacation-window-planner/SKILL.md) when you ask it to start or check this app locally. The skill follows this README and preserves existing local configuration and database data.
