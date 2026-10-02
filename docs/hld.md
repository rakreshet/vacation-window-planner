# Vacation Window Recommendation High Level Design

A phased architecture for deterministic vacation recommendations and later travel enrichment

This design places the recommendation engine behind a small interface and keeps language models, persistence, holiday data, and future flight providers at explicit seams. Phase 0 and Phase 0.5 are delivered without destinations or flights. Exact-date comparison shares the pure day-accounting core with Search. The proposed Phase 0.75 deepens that shared accounting for personal calendars and adds opportunities and browser-saved options. Phase 1 retains travel enrichment.

| Field | Value |
| --- | --- |
| **Status** | Phase 0/0.5 delivered; Phase 0.75 implemented in review with client acceptance pending; annual planning proposed; Phase 1 planned |
| **Prepared for** | POC product and engineering implementation |
| **Version date** | 2026-09-26 |

Delivery and original PR links are recorded in the [progress tracker](progress.md). Phase 0.5 requirements and task details are maintained in the [comparison plan](phase-0.5-plan.md), with completed validation in the [acceptance record](phase-0.5-acceptance.md).

The [Phase 0.75 plan](phase-0.75-plan.md#backend-design) records the backend/frontend contract for personal calendar rules, assessment detail, opportunity policy, snapshot migrations, and browser saving/export. Its implementation is in the open #51–#60 stack, with limitations in the [acceptance record](phase-0.75-acceptance.md); Phase 0/0.5 remain the merged behavior baseline.

The [annual planning backend design](annual-plans-plan.md#backend-design) proposes a pure whole-plan optimizer above the shared assessment rules, with one common calendar, exact locks, protected reserve, bounded complete combination search, and explicit infeasible-versus-incomplete outcomes. An authenticated workflow snapshots runs in PostgreSQL; browser saves retain selected historical plans separately from individual bookmarks. The [frontend design](annual-plans-plan.md#frontend-design), [UX walkthrough](annual-plans-ux.md), and [test seams](annual-plans-testing.md#proposed-public-test-seams) complete this documentation-only proposal. No annual code is implemented or authorized by this plan; Phase 1 retains its flight architecture.

## Architecture decision

Use a modular monolith for the POC: a React and TypeScript frontend calls a FastAPI backend; the backend contains pure typed domain modules, orchestration, adapters, and PostgreSQL persistence. This gives the project one deployment shape while keeping the important seams explicit. The recommendation engine is the deep module: callers provide structured input and receive ranked recommendations without learning calendar enumeration, scoring, deduplication, or explanation rule details.

## System context

| **Actor or system** | **Interaction** |
| --- | --- |
| Anonymous user | Provides conversational or structured constraints, starts a search or exact-date comparison, reviews results, and submits simple recommendation feedback |
| React frontend | Owns presentation and client session token; sends typed JSON to the backend |
| FastAPI backend | Validates requests, coordinates domain modules, persists snapshots, and returns data only |
| Holiday calendar adapter | Returns effective observed nonworking dates and locale weekend defaults |
| Pydantic AI interpreter | Uses the configured Google or xAI model to propose editable structured fields; the application derives weekend defaults from country, and deterministic recommendation explanations remain outside the model |
| PostgreSQL | Stores anonymous sessions, Search and comparison snapshots, recommendations, and feedback |
| Flight search adapter in phase 1 | Returns normalized live flight options from a mock or external provider such as SerpApi |

## Module map

| **Module** | **Interface** | **Responsibility and depth** |
| --- | --- | --- |
| Recommendation workflow | recommend(request) -> result | Coordinates validation, calendar lookup, generation, ranking, persistence, planned Phase 0.75 opportunities, and later Phase 1 travel enrichment |
| Exact-window evaluator | evaluate_window(start, end, calendar, balance) -> evaluation | Pure inclusive day accounting shared by Search and comparison; identifies charged dates, observed holidays, and remaining balance |
| Comparison service | compare(context, request) -> result | Validates local dates and optional Search ownership, evaluates the exact baseline, discovers bounded alternatives, and persists the complete snapshot |
| Window generator | generate(context, constraints) -> windows | Pure deterministic enumeration of feasible local date windows; no ranking or provider calls |
| Window ranker | rank(windows, policy) -> ranked | Scores, explains, applies candidate caps, and selects a diverse top N |
| Constraint interpreter | interpret(text) -> proposal | One Pydantic AI implementation validates text input and schema-constrained model output, then adds the country workweek default; search remains outside the model |
| Workweek policy | default_weekend_days(country_code) -> days | Pure, replaceable rule: Israel has Friday/Saturday off; every other country has Saturday/Sunday off. User edits remain authoritative at search time |
| Holiday calendar | calendar(country, months, override) -> calendar | Adapter seam for locale defaults, observed holidays, and working week overrides |
| Persistence repositories | Session, Search, comparison snapshot, and feedback operations | SQLAlchemy adapters hide PostgreSQL tables and transaction details |
| Travel enricher in phase 1 | enrich(windows, travel_constraints) -> enriched | Selects candidates, finds destinations and live flights, normalizes results, and fails clearly when live data is unavailable |
| Opportunity detector in Phase 0.75 | detect(context, calendar, policy) -> opportunities | Scans bounded future windows, scores and thresholds them deterministically, and explains why qualifying windows merit a separate section; no LLM or flight dependency |

## Phase 0 request flow

1. The frontend creates or resumes an anonymous session token.
1. The user supplies text or edits structured fields. If text is used, POST /interpret validates the input and obtains Pydantic AI `ToolOutput` with JSON-schema-constrained arguments validated as a Pydantic model. The model does not produce weekend days; a separate deterministic workweek policy adds the country default to the typed proposal. The user can edit it. This step does not run a recommendation search.
1. The user explicitly starts a search with confirmed structured fields. Direct structured entry remains available if the interpretation provider is not configured or unavailable.
1. Pydantic validation checks required months, integer whole-day values, country or calendar selection, and configured limits. The allowed-negative allowance defaults to zero and rejects values outside zero through five.
1. The holiday calendar adapter resolves observed holidays and the effective weekend pattern for the local date range.

The temporary workweek policy covers any country code, but the production calendar adapter supports only Israel (`IL`), U.S. federal holidays (`US`), and England & Wales bank holidays (`GB`, provider subdivision `ENG`). Editable weekends are separate from observed-holiday rules; see [calendar scope](runbook.md#supported-holiday-calendars).

1. The pure window generator enumerates candidate windows within a configurable safety cap. Starts must fall in a selected future local month or its unelapsed portion; ends may cross that month's boundary. Total length counts inclusive consecutive local dates, while PTO is charged only for effective working dates. Nonworking dates may occur at either edge. An incomplete enumeration caused by the cap yields a coded narrow-the-search outcome with no ranked recommendations.
1. The ranker computes deterministic features, a normalized score and its weighted components, warnings, and fact based explanation inputs. It groups equal-outcome dates before applying the shortlist limit, tries later equivalent dates when the first overlaps another selected result, then removes remaining near duplicates.
1. The workflow persists an immutable search snapshot and its recommendations in one transaction.
1. The backend returns typed JSON. The React frontend owns labels, colors, ordering display, empty states, and warning presentation.

## Phase 0.5 comparison flow

1. Both manual dates and any visible Search date open the same desktop comparison workspace. Search results, drafts, and feedback remain available when returning.
2. The browser supplies its IANA time zone when creating the anonymous session. Both workflows derive today's date in that zone from an injected clock. Clients omitting the field and migrated sessions use `Asia/Jerusalem`; calendar selection never changes the zone.
3. `POST /comparisons` authenticates the session, validates inclusive start/end dates, and verifies ownership of an optional originating Search ID. Changed planning context creates a separate session and omits the original Search ID.
4. The service resolves the effective holiday calendar for the full candidate neighborhood. The shared pure evaluator calculates exact charged dates and balance for the baseline, including an over-budget baseline.
5. Bounded discovery returns two goal-specific groups: the same length for fewer vacation days, or a longer break for no more vacation days. Alternatives must be future dated and feasible. The service ranks by gain, date movement, and stable dates, selects distinct outcomes, and computes deltas without reusing the Search score.
6. The service persists a complete immutable input/calendar/policy/output snapshot before returning success. A generation-cap hit returns `COMPARISON_TOO_BROAD` without a partial shortlist.
7. Editing dates marks results stale until explicit recalculation; selecting an alternative preserves the baseline. No-improvement and over-budget states keep the exact accounting visible.

Policy defaults and API examples are maintained in the [runbook](runbook.md#phase-05-exact-date-comparison); the [comparison plan](phase-0.5-plan.md) and [acceptance record](phase-0.5-acceptance.md) cover the detailed contract and verification.

## Phase 1 request flow (planned)

Phase 1 keeps the phase 0 window generator and ranker intact. After a pre score selects a bounded set of useful windows, the travel enricher proposes destinations and calls the flight adapter. The adapter returns normalized live flight options for the required passenger count, one origin, and economy cabin by default. A final scorer combines the existing window facts with destination fit, price, and flight convenience. The system presents no travel recommendation when live flight data is unavailable and returns a clear provider error. Booking remains out of scope.

## Phase 0.75 planning flow (design)

Manual personal rules become part of the immutable anonymous-session context. A shared pure prepared-calendar/window-assessment module owns cost, effective day types, unavailable dates, notice, and budget eligibility. Search and Compare keep their separate workflows and ranking purposes. Explicit comparison baselines retain accounting even when ineligible.

After an explicit Search, an optional independent scan enumerates bounded start/length pairs using the same assessment module. The detector applies a versioned policy, excludes the full explicit criteria interval and duplicate dates, and returns qualifying opportunities in a separate status envelope. Its cap/provider failure cannot erase complete explicit results. Atomic snapshots include personal context, provider facts, policy, local date, and output. See the plan for exact bounds, score formula, and typed failure behavior; no flight adapter is introduced for this phase.

Additive detailed assessments let the frontend save one exact option in the same browser and generate an ICS file or copyable leave-request text without duplicating leave arithmetic. Saved captures contain no token, reserve no balance, and remain historical until the user explicitly starts a new comparison. A browser storage adapter has an in-memory test adapter; no server saved-plan or account system is added.

## Core domain contracts

| **Type** | **Required data** | **Notes** |
| --- | --- | --- |
| UserVacationContext | session_id, balance_days, allowed_negative_days, country_code, weekend_days, time_zone | Anonymous and session scoped; allowed_negative_days is a whole-day value from 0 to 5, default 0 |
| SearchConstraints | months, preferred_length_days, result_limit | Months constrain the start date, not the end date; optional flexibility, notice, text intent, and calendar override fields |
| VacationWindow | start_date, end_date, total_days, vacation_days_used, holiday_dates | Pure generated value with no rank; total_days is inclusive local calendar length and vacation_days_used counts effective working dates only |
| Recommendation | window, rank, score, score_breakdown, alternative_windows, matching_window_count, explanation, remaining_balance, warnings | Equivalent dates share one rank; Phase 1 adds optional travel_enrichment without replacing the window |
| ComparisonInput | start_date, end_date, optional source_search_id | Exact baseline; no month or preferred-length inputs |
| ComparisonResult | comparison_id, baseline, save_leave, longer_break, policy, notices | Exact accounting, feasibility, warnings, and signed deltas; separate from Search ranking |
| TravelConstraints | origin, passenger_count, cabin | Phase 1; cabin defaults to economy and one origin is supported |
| FlightOption | provider_id, destination, outbound, inbound, price, currency, itinerary | Normalized provider response; availability is point in time |
| Feedback | session_id, recommendation_id, value | Value is thumbs_up or thumbs_down; no free text |

### Phase 0.75 opportunity contracts (design)

| **Type** | **Required data** | **Notes** |
| --- | --- | --- |
| OpportunityPolicy | weights, threshold, bounded future horizon, policy_version | Weights and threshold are independent typed settings; snapshot the effective policy |
| ProactiveOpportunity | opportunity_id, window, assessment, score, raw_points, score_breakdown, explanation, criteria_differences | Separate from Recommendation and its existing score; exact wire shape is in the Phase 0.75 plan |
| RecommendationResponse | recommendations, notice; calculation_context and optional opportunities status envelope | Legacy requests retain behavior; new UI requests bounded action details and opportunities explicitly |

## External API

The POC exposes POST /recommendations as the main search interface. A bearer token identifies the anonymous session holding balance, calendar, weekend, and time-zone context; the request supplies confirmed search constraints. Optional source text may be retained as snapshot context but is not interpreted during search. POST /interpret is a separate optional text-to-proposal step. Phase 0.75 proposes personal rules in the session, additive detailed assessments, and a separately requested opportunities envelope. POST /comparisons evaluates exact dates and bounded nearby alternatives independently of Search. Health and feedback endpoints are separate operational conveniences. The backend returns codes plus short developer messages for errors; the frontend maps those codes to user wording.

| **Endpoint** | **Purpose** |
| --- | --- |
| POST /sessions | Create an anonymous session and return an opaque token |
| POST /interpret | Turn optional conversational text into an editable structured proposal; never start a search |
| POST /recommendations | Run the deterministic Search workflow |
| POST /comparisons | Evaluate exact dates, discover nearby improvements, and persist the complete comparison |
| POST /recommendations/{id}/feedback | Record thumbs up or thumbs down |
| GET /health | Verify application and database readiness |

## Persistence design

| **Table** | **Key fields** | **Purpose** |
| --- | --- | --- |
| anonymous_sessions | id, token_hash, balance_days, allowed_negative_days, country_code, weekend_days, time_zone, created_at, expires_at | Retain session state without an account |
| searches | id, session_id, source_text, structured_input, engine_version, created_at | Immutable input snapshot for reproduction and debugging |
| recommendations | id, search_id, rank, result, warnings | Persist exact outputs, including future optional travel data |
| comparisons | id, session_id, structured_input, result, created_at | Immutable exact-date context, effective calendar/policy, and complete output |
| feedback | id, recommendation_id, session_id, value, created_at, updated_at | Store simple response quality signal |

SQLAlchemy models implement these tables; Alembic owns every schema change. JSON fields hold versioned snapshots, while frequently queried identifiers and timestamps remain relational columns. The workflow writes a search and its recommendations atomically. Raw conversational text may be stored for debugging, but secrets and provider credentials must never be stored with the search.

### Phase 0.75 personal context and opportunity persistence (design)

Two additive migrations introduce the session's canonical personal-calendar JSON and a nullable search opportunity JSON envelope. Existing sessions default to empty rules, and old snapshots are retained without recalculation. Opportunity output/policy/status and explicit results commit atomically; failed provider resolution records requested coverage without fabricating resolved facts. Opportunities are not ordinary recommendation rows. Same-browser saved options are separate client snapshots and do not extend server-session lifetimes.

## Scoring and explanation design

- The generator returns all valid windows within explicit bounds. It does not score or call external systems.
- The ranker derives explicit features such as efficiency, total days, length deviation, balance remaining, and warning flags.
- A qualifying zero-PTO window remains a candidate. The phase 0 efficiency feature must be finite without division by zero; length fit and diversity keep trivial free weekends from displacing materially useful longer breaks. Negative remaining balance always yields a warning, even when within the explicit allowance.
- Weights are configuration owned by the backend and versioned with the search snapshot. The phase 0 response exposes per-result weighted point contributions and possible points for an on-demand explanation, without presenting the score as a probability.
- Initial Phase 0 tunable defaults are 0.50 efficiency, 0.30 total duration, and 0.20 preferred-length fit (summing to 1), a generation cap of 5,000, near-duplicate overlap ratio of 0.80, material score gap of 5, and five results. These are product starting values, not scientifically established constants; the versioned effective policy is saved with each search.
- Tie handling records the decisive feature so explanations can state the real trade off.
- Near duplicate selection operates after scoring and keeps two similar windows only when their material feature differences exceed a configured threshold.
- Explanations are grounded in computed facts. Phase 0 uses a deterministic formatter; the configured language model only proposes search fields and cannot add or change ranking facts.

### Phase 0.75 opportunity scoring and gate (design)

- Opportunity scoring is a separate pure policy from phase 0 window ranking. Raw PTO efficiency is total consecutive days off divided by vacation days consumed (9 / 3 = 3.0) when PTO use is positive. Zero-PTO candidates use a finite, policy-bounded efficiency feature instead of a raw ratio or infinity; length and the separate threshold still matter.
- Normalize efficiency, total length, and low PTO consumption to comparable bounded features, then combine them with configurable weights. Initial tunable defaults are 0.50, 0.35, and 0.15 respectively; these are product starting values, not scientifically proven constants.
- The opportunity score ranks attractiveness. A distinct configurable threshold gates proactive inclusion; changing the threshold must not recalculate a candidate's score. Record effective policy version, weights, and threshold with the search snapshot.
- Ground explanations only in score facts and criteria differences, such as unusually high PTO leverage or a long break for relatively few vacation days. The interpretation provider is not used to decide, score, threshold, or invent reasons.

The [Phase 0.75 plan](phase-0.75-plan.md#exact-scoring-eligibility-and-variety) fixes the proposed normalizers, unrounded threshold, display rounding, bounds, diversity, and literal score examples. It is the detailed source of truth for this planned policy.

## Adapter seams

| **Seam** | **Phase 0 adapter** | **Additional phase 1 adapter** |
| --- | --- | --- |
| Constraint interpreter | Pydantic AI with a selected Google or xAI model; Pydantic AI test model for tests | Same interface; a later phase may add travel proposal fields |
| Holiday calendar | Locked `python-holidays` dataset for Israel, U.S. federal, and England & Wales holidays, with a deterministic fake | Same interface |
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
| LLM | Pydantic AI with Google or xAI selected by backend configuration | One validated proposal flow; provider SDK details stay inside Pydantic AI and models remain outside deterministic calculations |
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
| Interpretation provider unavailable | Allow structured input to continue; conversational interpretation returns a clear unavailable error |
| Database failure | Fail the request; do not return an unpersisted result as though it were stored |
| Live flight provider failure in phase 1 | Return a clear provider unavailable result and no partial travel recommendation |
| Opportunity score below threshold in Phase 0.75 | Omit the candidate from the separate opportunities collection without changing explicit search results |
| Flight provider unavailable for an opportunity | Keep a qualifying date-window opportunity; omit optional travel details and do not present it as a flight-backed travel recommendation |

## Security and privacy

- Store only an opaque anonymous session token hash on the server.
- Keep interpretation and flight provider keys in server-side environment secrets. Never commit credentials or include them in snapshots or logs.
- Treat conversational text as potentially sensitive debugging data and define a short retention period before any public use.
- Validate all external adapter responses before they cross into the domain modules.
- Rate limit session creation and recommendation requests once the POC is reachable beyond local development.

## Verification strategy

- Test pure modules through their interfaces with table driven calendar cases and deterministic clocks.
- Use property tests for invariants such as inclusive dates, nonnegative total days, and exact charged workdays.
- Cover selected-month start and cross-month end, observed holidays and weekends at both edges, default-zero and explicit 1-to-5-day negative allowances, and zero-PTO windows that satisfy the length filter. Assert finite scores and that diversity does not fill the top results with trivial weekends.
- Test the recommendation workflow with fake calendar and repository adapters, and test the separate interpretation flow with Pydantic AI's test model. Disable real model requests globally during backend tests so CI cannot spend provider tokens.
- Test that a cap-hit workflow never ranks or returns partial candidates. Test that interpretation returns an editable proposal without triggering search, and that confirmed structured input works with interpretation unavailable.
- Run PostgreSQL integration tests for mappings, migrations, transactions, and repository behavior after the initial unit test baseline.
- Test the frontend with Vitest and React Testing Library; use contract fixtures generated from backend schemas.
- Require GitHub Actions checks before merge on the public repository.

Phase 0.75 opportunity tests use fixed calendars, clocks, and policies to cover normalization, literal score examples, zero-PTO handling, stable ties, threshold boundaries, weight overrides, duplicate suppression, personal constraints, complete scans, and criteria differences. Contract/frontend tests verify separate results and failure isolation. Saved-option tests cover browser recovery and exact-date exports; P1 14 later adds actual flight-adapter regression checks. The phase plan names the public test seams and PR-specific evidence.

## Deployment and migration

The POC can run through a local compose setup with separate frontend, backend, and PostgreSQL processes. Deployment must run Alembic upgrade before starting the backend. `INTERPRET_PROVIDER` selects Google/Gemini or xAI/Grok for the same Pydantic AI interpreter; the selected provider needs its own server-side key. Missing configuration disables only Interpret. Provider choice does not change domain behavior or response types.

## Operational decisions

Calendar coverage, retention defaults, interpretation providers, and quality tools are settled for the local POC. The [operational decision record](open-decisions.md) separates those defaults from future provider and external-pilot choices. Deployment settings are maintained in the [runbook](runbook.md).
