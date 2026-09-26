# Local runbook — Phase 0 and Phase 0.5

## Start and verify

1. Copy `.env.example` to `.env` and replace the local PostgreSQL password before exposing any port.
2. Run `docker compose up --build --detach`.
3. Run `docker compose ps`; `db` and `backend` must become healthy and `migrate` must exit successfully.
4. Open `http://localhost:15173` and confirm a structured search can create a session and return recommendations. AI interpretation is optional; without the selected provider's key, only Interpret is unavailable.
5. Check `http://localhost:18080/health` for `{"status":"ok","database":"connected"}`.

## Quality and migration smoke checks

Run the commands in the README Tests and checks section. The backend Docker suite applies every migration to disposable PostgreSQL, runs repository and acceptance tests, and verifies downgrade. The frontend gate runs tests, lint, formatting, type checking, and the production build.

## Configuration safeguards

- `CORS_ORIGINS` is a JSON list of exact browser origins; do not use `*` for a public pilot.
- `MAX_REQUEST_BYTES` defaults to 65,536 and accepts 1,024 through 1,048,576.
- `SESSION_EXPIRY_DAYS` defaults to 30 and accepts 1 through 365.
- `SOURCE_TEXT_RETENTION_DAYS` defaults to 30 and accepts 0 through 365. Expired source text is cleared during subsequent searches while structured snapshots remain reproducible.
- `INTERPRET_PROVIDER` selects `gemini` (default) or `xai`; set the matching `GEMINI_API_KEY` or `XAI_API_KEY`. `GEMINI_MODEL` and `XAI_MODEL` override model names. Provider secrets remain backend-only. Structured search, ranking, persistence, and feedback do not depend on interpretation.
- After changing a provider setting, run `docker compose up --build --detach --force-recreate backend`; a plain restart does not reload the container environment. If xAI returns 403, check the key's team permissions and model access in the xAI Console. The app keeps structured search available and returns a safe Interpret error.

## Logs and incidents

Backend application logs are JSON and contain only the HTTP method, path without query string, response status, and duration. They never intentionally contain authorization headers or request bodies. For an incident, stop public access, preserve only non-sensitive operational logs, rotate affected credentials, and follow `SECURITY.md`.

## Stop or reset

`docker compose down` stops the app while preserving PostgreSQL data. For a disposable pilot only, `docker compose down --volumes` permanently removes its local database volume.

## Phase 0.5: exact-date comparison

Create an anonymous session with the same balance, allowance, country, and weekend fields as Search. The optional `time_zone` field accepts an IANA name, such as `Asia/Jerusalem`; browser clients send their local zone. Existing clients and migrated sessions default to `Asia/Jerusalem`, the supported country calendar's zone. Both Search and comparison use the session's local date to exclude past starts; dates themselves remain inclusive date-only values.

`POST /comparisons` requires `Authorization: Bearer <session token>` and this JSON body:

```json
{"start_date":"2027-01-03","end_date":"2027-01-07"}
```

A Search-origin request can also include `source_search_id`; it must belong to that session. Changing calendar or balance creates a new session and omits that origin. The original Search and its feedback stay intact.

The response includes `comparison_id`, exact `baseline`, `save_leave`, `longer_break`, the effective `policy`, and `notices`. Each evaluated window includes charged dates, weekend dates, holiday dates, remaining balance, feasibility, and warnings. Each alternative includes signed date shifts and concrete gains relative to the baseline. Over-budget baselines are still evaluated; alternatives must be feasible. A complete immutable input/calendar/policy/output snapshot is stored before success is returned.

| Environment variable | Default | Allowed range |
| --- | --- | --- |
| `COMPARISON_VERSION` | `phase05-v1` | Nonempty string |
| `COMPARISON_SHIFT_DAYS` | 21 | 0–60 |
| `COMPARISON_EXTRA_DAYS` | 7 | 0–14 |
| `COMPARISON_MAX_LENGTH_DAYS` | 28 | 1–90 |
| `COMPARISON_RESULT_LIMIT` | 3 per group | 1–5 |
| `COMPARISON_GENERATION_CAP` | 2000 | 1–5000 |

These are backend settings, never request fields. Compose forwards them from `.env`; recreate the backend after changing them. Increment the policy version when changing product behavior. The generation cap rejects incomplete discovery with `422 COMPARISON_TOO_BROAD`; it never returns a partial shortlist. Other expected errors include `401 SESSION_EXPIRED`, `404 NOT_FOUND` for another session's Search origin, `422 INVALID_COMPARISON`, and `503 PERSISTENCE_ERROR`.

For a smoke check, use **Compare my dates**, an 8-day balance, and January 3–7, 2027. With Friday/Saturday weekends and the Israeli calendar, it should show 5 vacation days used, an alternative of the same length using 3, and a 9-day break using 5. Use future dates if running this check after January 2027. Also compare from a grouped Search date, then return and verify feedback remains selected. See the [acceptance record](phase-0.5-acceptance.md) for the completed checks.
