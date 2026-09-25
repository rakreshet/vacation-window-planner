# Phase 0 local runbook

## Start and verify

1. Copy `.env.example` to `.env` and replace the local PostgreSQL password before exposing any port.
2. Run `docker compose up --build --detach`.
3. Run `docker compose ps`; `db` and `backend` must become healthy and `migrate` must exit successfully.
4. Open `http://localhost:15173` and confirm a structured search can create a session and return recommendations. Gemini is optional; without a key, only Interpret is unavailable.
5. Check `http://localhost:18080/health` for `{"status":"ok","database":"connected"}`.

## Quality and migration smoke checks

Run the commands in the README Tests and checks section. The backend Docker suite applies every migration to disposable PostgreSQL, runs repository and acceptance tests, and verifies downgrade. The frontend gate runs tests, lint, formatting, type checking, and the production build.

## Configuration safeguards

- `CORS_ORIGINS` is a JSON list of exact browser origins; do not use `*` for a public pilot.
- `MAX_REQUEST_BYTES` defaults to 65,536 and accepts 1,024 through 1,048,576.
- `SESSION_EXPIRY_DAYS` defaults to 30 and accepts 1 through 365.
- `SOURCE_TEXT_RETENTION_DAYS` defaults to 30 and accepts 0 through 365. Expired source text is cleared during subsequent searches while structured snapshots remain reproducible.
- `GEMINI_API_KEY` is optional. Structured search, ranking, persistence, and feedback do not depend on it.

## Logs and incidents

Backend application logs are JSON and contain only the HTTP method, path without query string, response status, and duration. They never intentionally contain authorization headers or request bodies. For an incident, stop public access, preserve only non-sensitive operational logs, rotate affected credentials, and follow `SECURITY.md`.

## Stop or reset

`docker compose down` stops the app while preserving PostgreSQL data. For a disposable pilot only, `docker compose down --volumes` permanently removes its local database volume.
