# Vacation Window Planner

Docker-based proof of concept. Phase 0 will recommend vacation date windows; phase 1 will add destinations and live flights. The recommendation engine is deliberately not implemented until the rules in `docs/open-decisions.md` are settled.

## Run locally

Docker Desktop (or another Docker Engine with Compose) is the only required runtime.

1. Copy `.env.example` to `.env` and change `POSTGRES_PASSWORD` if this machine is shared. The example value is for local development only.
2. Run `docker compose up --build`.
3. Open `http://localhost:15173`. The browser should show **Service ready** after PostgreSQL starts and the migration completes.

The frontend is bound to local port 15173 and the API to local port 18080 by default; change `WEB_PORT` or `API_PORT` in `.env` if needed. The API health endpoint is `http://localhost:18080/health`. Neither service is intended for public deployment yet.

## Test and check

All checks run in containers. From the project root:

```sh
docker compose --profile test run --build --rm backend-test
docker compose --profile test run --build --rm frontend-test
docker compose --profile test run --no-deps --rm backend-test ruff check .
docker compose --profile test run --no-deps --rm backend-test mypy src
docker compose --profile test run --no-deps --rm frontend-test npm run build
```

The backend test service starts a separate, disposable `vacation_test` PostgreSQL database. Its migration test refuses to run against another database name. GitHub Actions runs these same container checks on pushes and pull requests.

To stop the app, run `docker compose down`. Add `--volumes` only when you intentionally want to delete the local PostgreSQL data.
