# Vacation Window Planner

A Docker-based proof of concept for finding useful vacation dates. Phase 0 will recommend date windows; phase 1 will add destinations and live flights. Today, this repository contains the running foundation and health screen, not the recommendation engine. The decisions to settle before building that engine are in [docs/open-decisions.md](docs/open-decisions.md).

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

If either default host port is occupied, add `WEB_PORT=15174` or `API_PORT=18081` to `.env`, restart with `docker compose up --build --detach`, and use the new port. To see the actual mapped ports, run `docker compose ps`.

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
docker compose --profile test run --no-deps --rm frontend-test npm run build
```

The backend test uses a separate disposable `vacation_test` PostgreSQL database; the migration test refuses another database target. GitHub Actions runs the same checks on pushes and pull requests.

## Local-run skill

Codex can use the versioned [run-vacation-window-planner skill](.agents/skills/run-vacation-window-planner/SKILL.md) when you ask it to start or check this app locally. The skill follows this README and preserves existing local configuration and database data.
