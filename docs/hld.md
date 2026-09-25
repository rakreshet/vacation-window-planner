# Vacation Window Recommendation High Level Design

A phased architecture for deterministic vacation recommendations and later travel enrichment

This design places the recommendation engine behind a small interface and keeps language models, persistence, holiday data, and future flight providers at explicit seams. Phase 0 ships without destinations or flights. Phase 1 adds travel enrichment and deterministic proactive opportunity detection while preserving the tested vacation window core.

| Field | Value |
| --- | --- |
| **Status** | Approved planning baseline |
| **Prepared for** | POC product and engineering implementation |
| **Version date** | 2026-09-25 |

## Architecture decision

Use a modular monolith for the POC: a React and TypeScript frontend calls a FastAPI backend; the backend contains pure typed domain modules, orchestration, adapters, and PostgreSQL persistence. This gives the project one deployment shape while keeping the important seams explicit. The recommendation engine is the deep module: callers provide structured input and receive ranked recommendations without learning calendar enumeration, scoring, deduplication, or explanation rule details.

## System context

| **Actor or system** | **Interaction** |
| --- | --- |
| Anonymous user | Provides conversational or structured constraints, starts a search, reviews recommendations, and submits simple feedback |
| React frontend | Owns presentation and client session token; sends typed JSON to the backend |
| FastAPI backend | Validates requests, coordinates domain modules, persists snapshots, and returns data only |
| Holiday calendar adapter | Returns effective observed nonworking dates and locale weekend defaults |
| Gemini adapter | Converts conversational text into structured constraints and may phrase explanations from computed facts |
| PostgreSQL | Stores anonymous sessions, search snapshots, recommendations, and feedback |
| Flight search adapter in phase 1 | Returns normalized live flight options from a mock or external provider such as SerpApi |

## Module map

| **Module** | **Interface** | **Responsibility and depth** |
| --- | --- | --- |
| Recommendation workflow | recommend(request) -> result | Coordinates validation, calendar lookup, generation, ranking, persistence, and optional phase 1 opportunity scan and travel enrichment behind one external interface |
| Window generator | generate(context, constraints) -> windows | Pure deterministic enumeration of feasible local date windows; no ranking or provider calls |
| Window ranker | rank(windows, policy) -> ranked | Scores, explains, applies candidate caps, and selects a diverse top N |
| Constraint interpreter | interpret(text, session_context) -> proposal | Gemini adapter produces editable proposed fields; deterministic validation and search remain outside the model |
| Holiday calendar | calendar(country, months, override) -> calendar | Adapter seam for locale defaults, observed holidays, and working week overrides |
| Session repository | load, save_session, save_search, save_feedback | SQLAlchemy adapter hides PostgreSQL tables and transaction details |
| Travel enricher in phase 1 | enrich(windows, travel_constraints) -> enriched | Selects candidates, finds destinations and live flights, normalizes results, and fails clearly when live data is unavailable |
| Opportunity detector in phase 1 | detect(context, calendar, policy) -> opportunities | Scans bounded future windows, scores and thresholds them deterministically, and explains why qualifying windows merit a separate section; no LLM or flight dependency |

## Phase 0 request flow

1. The frontend creates or resumes an anonymous session token.
1. The user supplies text or edits structured fields. If text is used, POST /interpret returns a typed proposal for review; the user can edit it. This step does not run a recommendation search.
1. The user explicitly starts a search with confirmed structured fields. Direct structured entry remains available if Gemini is not configured or unavailable.
1. Pydantic validation checks required months, integer whole-day values, country or calendar selection, and configured limits. The allowed-negative allowance defaults to zero and rejects values outside zero through five.
1. The holiday calendar adapter resolves observed holidays and the effective weekend pattern for the local date range.
1. The pure window generator enumerates candidate windows within a configurable safety cap. Starts must fall in a selected future local month or its unelapsed portion; ends may cross that month's boundary. Total length counts inclusive consecutive local dates, while PTO is charged only for effective working dates. Nonworking dates may occur at either edge. An incomplete enumeration caused by the cap yields a coded narrow-the-search outcome with no ranked recommendations.
1. The ranker computes deterministic features, a normalized score, warnings, and fact based explanation inputs, then removes redundant near duplicates.
1. The workflow persists an immutable search snapshot and its recommendations in one transaction.
1. The backend returns typed JSON. The React frontend owns labels, colors, ordering display, empty states, and warning presentation.

## Phase 1 request flow

Phase 1 keeps the phase 0 window generator and ranker intact. After a pre score selects a bounded set of useful windows, the travel enricher proposes destinations and calls the flight adapter. The adapter returns normalized live flight options for the required passenger count, one origin, and economy cabin by default. A final scorer combines the existing window facts with destination fit, price, and flight convenience. The system presents no travel recommendation when live flight data is unavailable and returns a clear provider error. Booking remains out of scope.

### Phase 1 proactive opportunity flow

Alongside the explicit search, the workflow may run a separate, bounded future-window scan using the same calendar and leave-balance facts. It calls the existing pure window generator with separate opportunity constraints rather than treating the user's selected months or preferred length as hard filters. The pure opportunity detector applies an independently versioned policy, requires a meaningful difference from the explicit criteria, removes duplicates of explicit results, and returns only candidates whose scores meet or exceed its threshold. The response adds a separate opportunities collection; phase 0 clients and explicit recommendation ranking remain unchanged. An opportunity is a date-window suggestion, not a travel recommendation: optional destination or flight enrichment occurs downstream and its failure cannot suppress the underlying opportunity.

## Core domain contracts

| **Type** | **Required data** | **Notes** |
| --- | --- | --- |
| UserVacationContext | session_id, balance_days, allowed_negative_days, country_code, weekend_days | Anonymous and session scoped; allowed_negative_days is a whole-day value from 0 to 5, default 0 |
| SearchConstraints | months, preferred_length_days, result_limit | Months constrain the start date, not the end date; optional flexibility, notice, text intent, and calendar override fields |
| VacationWindow | start_date, end_date, total_days, vacation_days_used, holiday_dates | Pure generated value with no rank; total_days is inclusive local calendar length and vacation_days_used counts effective working dates only |
| Recommendation | window, rank, score, explanation, remaining_balance, warnings | Phase 1 adds optional travel_enrichment without replacing the window |
| TravelConstraints | origin, passenger_count, cabin | Phase 1; cabin defaults to economy and one origin is supported |
| FlightOption | provider_id, destination, outbound, inbound, price, currency, itinerary | Normalized provider response; availability is point in time |
| Feedback | session_id, recommendation_id, value | Value is thumbs_up or thumbs_down; no free text |

### Phase 1 opportunity contracts

| **Type** | **Required data** | **Notes** |
| --- | --- | --- |
| OpportunityPolicy | weights, threshold, bounded future horizon, policy_version | Weights and threshold are independent typed settings; snapshot the effective policy |
| ProactiveOpportunity | window, opportunity_score, explanation, reason_facts, criteria_differences | Separate from Recommendation and its existing score; optional travel enrichment is additive |
| RecommendationResponse | recommendations, notices; optional opportunities | Phase 0 behavior and explicit result semantics are preserved |

## External API

The POC exposes POST /recommendations as the main search interface. Its request contains an anonymous session identifier and confirmed structured context and constraints; optional source text may be retained as snapshot context but is not interpreted during search. POST /interpret is a separate optional text-to-proposal step. The recommendation response contains recommendations and notices, plus an optional separate opportunities collection in phase 1. Health and feedback endpoints are separate operational conveniences. The backend returns codes plus short developer messages for errors; the frontend maps those codes to user wording.

| **Endpoint** | **Purpose** |
| --- | --- |
| POST /sessions | Create an anonymous session and return an opaque token |
| POST /interpret | Turn optional conversational text into an editable structured proposal; never start a search |
| POST /recommendations | Run the phase appropriate recommendation workflow |
| POST /recommendations/{id}/feedback | Record thumbs up or thumbs down |
| GET /health | Verify application and database readiness |

## Persistence design

| **Table** | **Key fields** | **Purpose** |
| --- | --- | --- |
| anonymous_sessions | id, token_hash, balance_days, country_code, created_at, expires_at | Retain session state without an account |
| searches | id, session_id, source_text, constraints_json, engine_version, created_at | Immutable input snapshot for reproduction and debugging |
| recommendations | id, search_id, rank, dates, score, explanation, warnings_json, result_json | Persist exact outputs, including future optional travel data |
| feedback | id, recommendation_id, session_id, value, created_at | Store simple response quality signal |

SQLAlchemy models implement these tables; Alembic owns every schema change. JSON fields hold versioned snapshots, while frequently queried identifiers and timestamps remain relational columns. The workflow writes a search and its recommendations atomically. Raw conversational text may be stored for debugging, but secrets and provider credentials must never be stored with the search.

### Phase 1 opportunity persistence

A phase 1 additive migration stores the effective opportunity policy and exact opportunity output with the search snapshot. Opportunities are not written as ordinary ranked search recommendations; their separate identity and score remain reproducible without a flight-provider record.

## Scoring and explanation design

- The generator returns all valid windows within explicit bounds. It does not score or call external systems.
- The ranker derives explicit features such as efficiency, total days, length deviation, balance remaining, and warning flags.
- A qualifying zero-PTO window remains a candidate. The phase 0 efficiency feature must be finite without division by zero; length fit and diversity keep trivial free weekends from displacing materially useful longer breaks. Negative remaining balance always yields a warning, even when within the explicit allowance.
- Weights are configuration owned by the backend and versioned with the search snapshot. They are not exposed in the phase 0 response.
- Initial Phase 0 tunable defaults are 0.50 efficiency, 0.30 total duration, and 0.20 preferred-length fit (summing to 1), a generation cap of 5,000, near-duplicate overlap ratio of 0.80, material score gap of 5, and five results. These are product starting values, not scientifically established constants; the versioned effective policy is saved with each search when persistence is added.
- Tie handling records the decisive feature so explanations can state the real trade off.
- Near duplicate selection operates after scoring and keeps two similar windows only when their material feature differences exceed a configured threshold.
- Explanations are grounded in computed facts. A deterministic formatter is the baseline; Gemini may rephrase facts but cannot add or change them.

### Phase 1 opportunity scoring and gate

- Opportunity scoring is a separate pure policy from phase 0 window ranking. Raw PTO efficiency is total consecutive days off divided by vacation days consumed (9 / 3 = 3.0) when PTO use is positive. Zero-PTO candidates use a finite, policy-bounded efficiency feature instead of a raw ratio or infinity; length and the separate threshold still matter.
- Normalize efficiency, total length, and low PTO consumption to comparable bounded features, then combine them with configurable weights. Initial tunable defaults are 0.50, 0.35, and 0.15 respectively; these are product starting values, not scientifically proven constants.
- The opportunity score ranks attractiveness. A distinct configurable threshold gates proactive inclusion; changing the threshold must not recalculate a candidate's score. Record effective policy version, weights, and threshold with the search snapshot.
- Ground explanations only in score facts and criteria differences, such as unusually high PTO leverage or a long break for relatively few vacation days. Gemini is not used to decide, score, threshold, or invent reasons.

## Adapter seams

| **Seam** | **Phase 0 adapter** | **Additional phase 1 adapter** |
| --- | --- | --- |
| Constraint interpreter | Gemini with a deterministic fake for tests | Same; prompt and schema may add travel constraints |
| Holiday calendar | Locked `python-holidays` dataset, initially Israel (`IL`), with a deterministic fake | Same interface |
| Persistence | PostgreSQL through SQLAlchemy; in memory fake for domain tests | Same interface and additive travel fields |
| Flight search | No seam in the running workflow | Mock adapter first, then SerpApi compatible live adapter |

The flight seam becomes real only when both mock and live adapters exist in phase 1. Phase 0 should define the optional travel data shape but must not introduce pass through flight modules that have no behavior.

## Technology choices

| **Area** | **Choice** | **Reason** |
| --- | --- | --- |
| Backend | Python and FastAPI | Fast POC delivery, typed request boundaries, and straightforward LLM integration |
| Typing | Type hints, mypy, Pydantic | Compile like feedback in CI and explicit boundary validation |
| Database | PostgreSQL | Structured relational data with reliable transactions and familiar operations |
| Persistence | SQLAlchemy and Alembic | Typed mappings and versioned repeatable schema migrations |
| Frontend | React, TypeScript, Vite | Small typed client with fast local development and test tooling |
| LLM | Gemini behind an adapter | Low cost POC provider; replaceable and excluded from deterministic calculations |
| CI | GitHub Actions | Versioned checks for backend tests, mypy, lint, frontend tests, type checking, and build |
| Repository | Public monorepo for the POC | Supports the agreed required checks workflow; no secrets may enter git |

## Failure behavior

| **Condition** | **Behavior** |
| --- | --- |
| Invalid request | Return a stable machine code, field details, and a short developer message |
| Partly past month | Clip to future local dates and include a notice |
| Selected-month crossing | Accept a future start in a selected month even if the end date lies in a later month; reject starts outside selected months |
| Negative balance | Exclude windows below the explicitly allowed floor; include a warning whenever a returned window's remaining balance is negative |
| No feasible window | Return an empty recommendations list with a clear reason |
| Generation cap reached before enumeration completes | Return a stable SEARCH_TOO_BROAD outcome with no ranked recommendations and a clear instruction to narrow the search; persist the attempted constraints and outcome for reproducibility |
| Gemini unavailable | Allow structured input to continue; conversational interpretation returns a clear unavailable error |
| Database failure | Fail the request; do not return an unpersisted result as though it were stored |
| Live flight provider failure in phase 1 | Return a clear provider unavailable result and no partial travel recommendation |
| Opportunity score below threshold in phase 1 | Omit the candidate from the separate opportunities collection without changing explicit search results |
| Flight provider unavailable for an opportunity | Keep a qualifying date-window opportunity; omit optional travel details and do not present it as a flight-backed travel recommendation |

## Security and privacy

- Store only an opaque anonymous session token hash on the server.
- Keep Gemini and flight provider keys in environment secrets. Never commit credentials or include them in snapshots or logs.
- Treat conversational text as potentially sensitive debugging data and define a short retention period before any public use.
- Validate all external adapter responses before they cross into the domain modules.
- Rate limit session creation and recommendation requests once the POC is reachable beyond local development.

## Verification strategy

- Test pure modules through their interfaces with table driven calendar cases and deterministic clocks.
- Use property tests for invariants such as inclusive dates, nonnegative total days, and exact charged workdays.
- Cover selected-month start and cross-month end, observed holidays and weekends at both edges, default-zero and explicit 1-to-5-day negative allowances, and zero-PTO windows that satisfy the length filter. Assert finite scores and that diversity does not fill the top results with trivial weekends.
- Test the recommendation workflow with fake calendar and repository adapters, and test the separate interpretation flow with a fake Gemini adapter.
- Test that a cap-hit workflow never ranks or returns partial candidates. Test that interpretation returns an editable proposal without triggering search, and that confirmed structured input works with Gemini unavailable.
- Run PostgreSQL integration tests for mappings, migrations, transactions, and repository behavior after the initial unit test baseline.
- Test the frontend with Vitest and React Testing Library; use contract fixtures generated from backend schemas.
- Require GitHub Actions checks before merge on the public repository.

Phase 1 opportunity tests use fixed calendars, clocks, and policies to cover feature normalization, the 9-days/3-PTO efficiency example, zero-PTO handling, stable ties, threshold boundaries, weight overrides, duplicate suppression, criteria-difference explanations, and independence from Gemini and flight adapters. Contract and frontend tests verify the separate collection and section without changing phase 0 results.

## Deployment and migration

The POC can run through a local compose setup with separate frontend, backend, and PostgreSQL processes. Deployment must run Alembic upgrade before starting the backend. A configuration flag chooses deterministic fake adapters or real Gemini and, in phase 1, flight adapters. The flag changes the adapter at the seam; it does not change domain behavior or response types.

## Open operational choices

- Revisit the initial Israel-only supported-country list after the Phase 0 pilot establishes demand.
- Set anonymous session expiry and raw text retention before any external pilot.
- Choose final lint and formatting tools during repository bootstrap; the plan assumes Ruff for Python and ESLint plus Prettier for TypeScript.
- Confirm current GitHub plan capabilities when configuring protected branch rules; CI must run regardless of enforcement availability.
