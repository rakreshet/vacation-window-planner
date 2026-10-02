# Local runbook — Phase 0 and Phase 0.5

## Start and verify

1. Preserve an existing `.env`; if it is absent, run `cp -n .env.example .env`. Replace the example PostgreSQL password before sharing access. Follow the [README](../README.md#run-locally) for host-port overrides.
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

Create an anonymous session with the same balance, allowance, country, and weekend fields as Search. The optional `time_zone` field accepts an IANA name, such as `Asia/Jerusalem`; browser clients send their local zone. Clients that omit the field and migrated sessions retain the legacy `Asia/Jerusalem` fallback. Calendar selection does not change the user’s time zone; API clients should send their local IANA zone explicitly. Both Search and comparison use the session's local date to exclude past starts; dates themselves remain inclusive date-only values.

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


## Supported holiday calendars

The same offline, deterministic calendar provider serves Search and Compare. No LLM or network holiday lookup is needed.

| UI choice | Session `country_code` | Holiday scope | Default weekend |
| --- | --- | --- | --- |
| Israel | `IL` | Existing Israeli public holidays | Friday / Saturday |
| United States — federal holidays | `US` | Federal public holidays and standard observed dates | Saturday / Sunday |
| England & Wales — bank holidays | `GB` | England & Wales bank holidays and substitute dates | Saturday / Sunday |

For this PoC, `GB` explicitly resolves the provider’s `ENG` subdivision. Scotland and Northern Ireland have different holidays and are not offered. U.S. state holidays and employer-specific leave rules are not modeled. As with Israel, listed holidays are treated as nonworking dates. A custom weekend changes nonworking weekdays but does not recalculate holiday substitution rules.

Changing the calendar updates weekends only when the current selection matches the previous calendar’s default. Other selections, including an empty selection, are retained. The weekday controls always remain editable. No session or snapshot migration is needed; comparison snapshots retain their resolved holiday dates. Future additional UK regions should have an explicit region field rather than changing what existing `GB` sessions mean.

Regression fixtures were checked against [OPM’s federal holiday schedule](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/) and [GOV.UK’s regional bank holiday lists](https://www.gov.uk/bank-holidays):

- U.S., July 2–5, 2027: 4 total days, 1 vacation day used, with July 5 observed.
- England & Wales, August 27–30, 2027: 4 total days, 1 vacation day used. The Scottish August 2 holiday must not appear in this calendar.
- U.S., December 31, 2027–January 2, 2028: 3 total days, no vacation days used, including the observed New Year holiday.

Use an 8-day balance and Saturday/Sunday weekends for these smoke checks. Also switch from Israel to either new calendar, customize the weekends, switch again, and confirm the custom selection stays. Search for a month containing a listed holiday, open a result in Compare, and verify the same vacation-day cost and calendar are preserved.

## Phase 0.75: personal calendars and actions

The stack adds `personal_calendar` to anonymous sessions: `schema_version: 1`, `date_overrides` (`personal_day_off` or `extra_working_day`), `unavailable_ranges`, and `minimum_notice_days` (0–90). Each range is inclusive and at most 366 days; each collection is limited to 100 normalized ranges. Extra working days consume leave even on weekends or holidays. Any unavailable date excludes a suggestion, including nonworking dates. Compare still shows literal baseline accounting and all eligibility reasons.

`POST /recommendations` accepts `include_opportunities` and `include_action_details`, both defaulting to false. The UI sends both. Opportunity status is `complete`, `too_broad`, or `unavailable`; failure of the separate opportunity scan preserves explicit Search results. Default discovery checks 365 starts × lengths 4–28 = 9,125 pairs, with a 12,000-pair cap and three results. No partial opportunity shortlist is returned. Backend `OPPORTUNITY_*` settings are validated by `OpportunityPolicy`; custom deployments must pass these settings into the backend container environment (the default Compose file uses defaults).

Action details cover each returned representative and grouped date. More than 6,000 combined Search dates produces `422 ACTION_DETAILS_TOO_LARGE`; reduce length/result count. Opportunities have their separately bounded details. Calculation metadata records `phase075-v1`, UTC calculation time, local today, and the submitted planning context. Database migrations 07 and 08 add personal context and opportunity snapshots. There are no deployed legacy rows requiring a backfill. A failed snapshot transaction returns `503 PERSISTENCE_ERROR` and rolls back.

Saved options use one localStorage key per record under `vacation-window:saved:v1:`. Limits are 50 records and 64 KiB UTF-8 per record. Tokens, server IDs, and interpretation text are excluded. Storage failures never clear existing records. Corrupt/unsupported items offer explicit removal; they are not silently recalculated. Same-item cross-tab changes use last successful write. Concurrent different-item saves can briefly exceed 50; further new saves are blocked without deleting anything. Storage is browser/profile/origin-specific; clearing browser data or private browsing may lose it. No server-side recovery or device synchronization exists.

Saved-date checking opens a draft and requires explicit submission using a fresh session, preserving the saved timezone and existing planning work. Download/copy use captured accounting and require no server session. Calendar files describe tentative all-day planning options, not invitations or approvals. Client import/dedup behavior is not synchronization. Denied clipboard access leaves selectable text. See [acceptance and manual testing](phase-0.75-acceptance.md).

## Annual planning

Plan my year uses one immutable calendar context and one available-leave pool for one year. Locks count in the requested mix; available leave must include their allocated leave. Reserve stays protected. A `too_broad` result means checking did not finish and contains no usable partial plan; narrow lengths, months or slot count explicitly. A reduced plan is a proved fallback and never silently replaces the requested mix.

`POST /annual-plans` requires the anonymous bearer session. Every evaluable outcome is persisted in `annual_plan_runs` by migration `20260926_09`; failures cannot return a successful snapshot. Annual runs follow session expiry/deletion and foreign-key cascade. There is no public retrieval endpoint; browser records provide independent historical access. Changing calendar context creates a fresh session. Optional `POST /annual-plans/interpret` produces reviewed proposals only; structured planning remains available without model credentials.

The engine's `annual-v1` defaults are 12,000 candidates, 500,000 states, 5,000,000 transitions and five seconds across all passes. `ANNUAL_POLICY` is a JSON backend environment setting that may lower these bounds; raising them fails startup validation. The default Compose service uses the defaults: a custom deployment or Compose override must explicitly pass the environment setting to the backend container. Two planning permits exist per server process; additional requests receive retryable `ANNUAL_PLANNER_BUSY`, not a queue. Additional workers multiply deployment concurrency. Inspect status/code and duration without logging request bodies or tokens. Retry after busy/provider/database recovery; do not relabel a resource cap as infeasibility. See the complete [HTTP error table](annual-plans-server.md#operational-outcomes).

Annual browser storage is separate from individual saved vacations, under `vacation-window:annual:v1:`: at most 20 records, 256 KiB UTF-8 per record, names up to 80 characters. It stores one selected plan with original request, locks, common context and historical facts, excluding server identifiers, tokens and interpretation text. Reopen works without the server; Recalculate opens a separate draft and requires explicit submission. Old years or past locks require edits; saved facts never silently change. Invalid records are isolated with explicit removal. Failed writes preserve existing items and leave direct copy/download available. Clearing browser/profile/origin storage loses these records; no account, cloud backup or synchronization exists.

Use the [annual acceptance record](annual-plans-acceptance.md) for fresh tests, benchmark commands, browser evidence and the remaining calendar-client delivery/import gate. The local-run commands and database preservation rules above remain unchanged.
