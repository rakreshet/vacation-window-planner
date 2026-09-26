# Vacation Window Recommendation Implementation Task Plan

Delivered Phase 0 tasks and planned Phase 1 work; Phase 0.5 and Phase 0.75 have linked companion plans

This plan turns the agreed product and architecture into mergeable tasks. Each task has one responsibility, named verification, and a concrete definition of done. Phase 0 ends with a usable vacation window POC. The proposed Phase 0.75 adds personal calendars, independent proactive opportunities, and same-browser saved/exported choices; Phase 1 adds destinations and live flights.

| Field | Value |
| --- | --- |
| **Status** | Phase 0 and Phase 0.5 delivered; Phase 0.75 design in review; Phase 1 planned |
| **Prepared for** | POC product and engineering implementation |
| **Version date** | 2026-09-26 |

Delivery and original PR links are recorded in the [progress tracker](progress.md). Phase 0.5 requirements and task details are maintained in the [comparison plan](phase-0.5-plan.md), with completed validation in the [acceptance record](phase-0.5-acceptance.md).

The [Phase 0.75 plan](phase-0.75-plan.md#ordered-pr-breakdown) defines P075 00–10, dependencies, public test seams, and acceptance gates; its [UX walkthrough](phase-0.75-ux.md) is the inspectable design artifact. This is planning only. Implementation waits for an explicit readiness instruction from the user.

## Delivery rules

- Use a monorepo with backend and frontend directories and a branch per task.
- Every behavior change includes tests in the same pull request. No task is complete while its checks are red.
- Keep Python fully typed, enforce mypy in continuous integration, and use Pydantic at external boundaries.
- Run backend tests, lint, mypy, frontend tests, type checking, and production build in GitHub Actions.
- Keep secrets in environment variables and CI secrets. Never commit keys, local environment files, or captured sensitive payloads.
- Record merged task status and PR links in the [delivery progress tracker](progress.md), and keep pull requests small enough to review independently.

## Milestones

| **Milestone** | **Outcome** | **Exit gate** | **Status** |
| --- | --- | --- | --- |
| M0 Foundation | A typed full stack skeleton with PostgreSQL and green CI | Frontend displays backend health and all required checks pass | Done |
| M1 Domain core | Validated contracts, calendar resolution, pure window generation, deterministic ranking | Golden and property tests pass without external providers | Done |
| M2 Phase 0 product | Anonymous sessions, persistence, optional interpretation, React workflow, feedback | Representative user journey passes and search snapshots reproduce results | Done |
| Phase 0.5 comparison | Manual and Search-origin exact-date comparison with nearby alternatives | Shared accounting, persistence, desktop journeys, and quality gates pass | Done |
| Phase 0.75 | Personal calendars, opportunities, same-browser saved options, export/copy | Shared accounting, bounded scans, saved recovery, calendar imports, desktop UX and regression gates pass | Design in review |
| M3 Phase 1 | Destination and live-flight enrichment, preserving opportunity independence | Provider tests and travel-adapter independence checks pass | Planned |

## Phase 0 tasks

### P0 01 Create the monorepo skeleton

**Scope**  Create backend and frontend packages, shared developer commands, environment examples, and a short setup guide.

**Tests**  Add one backend import test and one frontend smoke test.

**Definition of done**  A new checkout can install dependencies and run both test suites.

### P0 02 Add FastAPI health and configuration

**Scope**  Create typed settings, application factory, health endpoint, and structured error envelope.

**Tests**  Test health success and invalid configuration without network calls.

**Definition of done**  GET /health returns typed JSON and starts through the application factory.

### P0 03 Add PostgreSQL SQLAlchemy and Alembic

**Scope**  Configure typed SQLAlchemy sessions, database health, Alembic, and the initial migration.

**Tests**  Run a migration up and down against a disposable PostgreSQL database.

**Definition of done**  The backend connects to PostgreSQL and migration history is reproducible.

### P0 04 Create the React TypeScript Vite shell

**Scope**  Build the application shell, typed API client, environment configuration, and health display.

**Tests**  Use Vitest and React Testing Library to verify loading, success, and failure states.

**Definition of done**  The browser displays backend health without untyped data access.

### P0 05 Create GitHub Actions continuous integration

**Scope**  Add backend and frontend jobs with dependency caching and a PostgreSQL service.

**Tests**  The workflow runs pytest, Ruff, mypy, Vitest, TypeScript checking, Vite build, and Alembic migration checks.

**Definition of done**  A pull request receives separate required quality checks and no job needs a real secret.

### P0 06 Define phase 0 domain contracts

**Scope**  Add immutable typed models for user context, constraints, holiday calendar, vacation window, recommendation, warnings, and feedback.

**Tests**  Write validation tests for whole days, explicit months, result limits, date invariants, and allowed-negative defaults and bounds (0 by default, explicit whole days through 5; reject larger or fractional values).

**Definition of done**  Contracts reject invalid states and serialize stable JSON fixtures.

### P0 07 Define recommendation configuration

**Scope**  Add typed scoring weights, generation cap, near duplicate thresholds, default result count, and engine version.

**Tests**  Test defaults, environment overrides, and rejected unsafe values.

**Definition of done**  Every tunable rule is explicit, typed, and captured by the search snapshot.

### P0 08 Define the holiday calendar interface

**Scope**  Create the calendar interface and deterministic fake adapter with locale weekend defaults and user overrides.

**Tests**  Cover Israel Friday Saturday, US Saturday Sunday, observed holiday input, and custom workweek cases.

**Definition of done**  Callers can resolve an effective calendar without knowing the provider.

### P0 09 Implement a production holiday calendar adapter

**Scope**  Choose the initial library or provider, map its observed dates into the domain type, and preload Israel as an initial supported calendar.

**Tests**  Add adapter contract tests and recorded deterministic cases; do not call the network in unit tests.

**Definition of done**  The same contract suite passes for the fake and production calendar adapters.

### P0 10 Implement future date clipping

**Scope**  Normalize selected months against an injected local clock, constrain window starts to future local dates in those months, and emit a clipped range notice. Do not constrain window ends to the start month.

**Tests**  Test fully future, partly past, fully past, leap year, and month boundary cases; a start in a selected month with an end in the next month is valid, while a start in an unselected month is not.

**Definition of done**  Partly past selections start today and fully past selections fail validation clearly.

### P0 11 Implement the pure vacation window generator

**Scope**  Enumerate feasible windows with inclusive local calendar-day length and the agreed start-month rule. Charge PTO only for effective working days; allow weekends and observed holidays at either edge and qualifying zero-PTO windows. Enforce the explicit negative allowance without scoring.

**Tests**  Use table driven tests for weekend and observed-holiday edges, consecutive days, cross-month ends, zero-PTO length eligibility, default-zero and explicit 1-to-5-day negative allowance, and a cap-hit outcome that never exposes partial candidates as ranked results.

**Definition of done**  The pure function returns repeatable windows with exact charged vacation days.

### P0 12 Add generator property tests

**Scope**  Define invariants for selected-month starts, future local dates, ordering, inclusive length, charged workdays, allowed balance floor, and duplicate identity.

**Tests**  Generate randomized calendars and constraints with a fixed reproducible seed strategy.

**Definition of done**  No generated window violates the contract across the property test corpus.

### P0 13 Implement deterministic scoring

**Scope**  Calculate a finite efficiency feature (including zero-PTO candidates), total duration, length deviation, balance remaining, normalized 0 to 100 score, and warning facts.

**Tests**  Test ordering, normalization extremes, close scores, full balance neutrality, every negative remaining balance warning, and finite zero-PTO scoring without divide-by-zero.

**Definition of done**  Scoring is deterministic and explains which facts affected the rank.

### P0 14 Implement diversity selection

**Scope**  Collapse near duplicate windows unless a material trade off justifies both; return configurable top N with a default of five.

**Tests**  Test identical windows, adjacent dates, meaningful efficiency differences, stable ties, result limit changes, and trivial zero-PTO weekends not crowding out longer useful breaks.

**Definition of done**  Results favor variety without discarding documented trade offs.

### P0 15 Implement grounded explanations

**Scope**  Create a deterministic formatter from score facts and warning codes; define an optional phrasing interface for later Gemini use.

**Tests**  Snapshot explanations for efficient, length relaxed, close trade off, full balance, and negative balance cases.

**Definition of done**  Every recommendation has concise text that can be traced to computed facts.

### P0 16 Create anonymous session persistence

**Scope**  Add sessions, hashed opaque tokens, expiry fields, repositories, and migration.

**Tests**  Test token creation, lookup, expiration, balance retention, and database uniqueness.

**Definition of done**  A browser can resume session state without an account or stored raw token.

### P0 17 Persist search and recommendation snapshots

**Scope**  Add searches and recommendations tables with engine version, structured input, source text, result data, and warnings.

**Tests**  Test atomic writes, rollback on failure, ordering, and exact round trip reproduction.

**Definition of done**  Each completed search has an immutable input and output snapshot.

### P0 18 Implement the recommendation workflow

**Scope**  Compose validation, calendar resolution, clipping, generation, ranking, explanation, and persistence behind recommend(request).

**Tests**  Use fake adapters to test success, empty results, invalid requests, a coded SEARCH_TOO_BROAD outcome with no partial ranking, and persistence failures.

**Definition of done**  One interface exercises the entire phase 0 behavior without HTTP or real providers.

### P0 19 Expose the recommendation endpoint

**Scope**  Add POST /recommendations with typed request and response models and stable machine error codes.

**Tests**  Test HTTP success, zero results, validation errors, expired sessions, and repository failures.

**Definition of done**  The endpoint returns data only and never embeds display colors or UI instructions.

### P0 20 Add the constraint interpreter

**Scope**  Provide a Pydantic AI interpreter using configured Google/Gemini or xAI/Grok and a POST /interpret endpoint that returns an editable typed proposal without starting a search. Keep direct structured search independent of the provider.

**Tests**  Use Pydantic AI test models and schema fixtures for malformed, missing, and valid model output; disable real model requests and assert interpretation alone never creates recommendations.

**Definition of done**  Model output is validated before entering the domain and cannot calculate recommendations.

### P0 21 Build the phase 0 search interface

**Scope**  Create a conversational input area plus editable structured confirmation for balance, an optional allowed-negative allowance (default 0, maximum 5 whole days), calendar, months, length, and overrides. Apply an interpretation proposal to editable fields only; submit confirmed fields on explicit Search.

**Tests**  Test required fields, allowance bounds and default, local edits, no search on interpretation, manual Search behavior, structured-only use without interpretation-provider configuration, and accessible labels.

**Definition of done**  The user can confirm interpreted constraints before starting a search.

### P0 22 Build recommendation results

**Scope**  Render ranked date windows, totals, days used, remaining balance, score, explanation, warnings, and empty states.

**Tests**  Test normal, close trade off, clipped dates, cross-month windows, zero-PTO windows, full balance, negative balance warning, and zero result fixtures.

**Definition of done**  The top five are readable and presentation logic remains in the frontend.

### P0 23 Add simple feedback

**Scope**  Create feedback migration, repository, endpoint, and thumbs up or down controls without text.

**Tests**  Test one feedback value per user action, replacement behavior if allowed, and authorization by anonymous session.

**Definition of done**  Feedback is tied to both recommendation and anonymous session.

### P0 24 Add end to end phase 0 acceptance tests

**Scope**  Exercise anonymous session creation, interpreted and structured searches, persisted results, manual rerun, and feedback.

**Tests**  Use a real PostgreSQL test database and fake Gemini and holiday adapters; assert no search before confirmation and no partial recommendations after a cap-hit outcome.

**Definition of done**  The representative user journey passes locally and in GitHub Actions.

### P0 25 Complete phase 0 hardening

**Scope**  Add secret scanning guidance, CORS configuration, request limits, structured logs, retention configuration, and setup documentation.

**Tests**  Test that secrets are absent from logs and snapshots; run dependency and migration smoke checks.

**Definition of done**  The public POC repository contains no credentials and has a documented runbook.

## Phase 1 tasks

### P1 01 Add phase 1 travel contracts

**Scope**  Extend constraints and recommendations with optional travel data, passenger count, single origin, economy default, destination, and normalized flight option.

**Tests**  Test backward compatible phase 0 serialization and phase 1 validation.

**Definition of done**  Phase 0 clients continue to work with additive optional fields.

### P1 02 Implement bounded travel candidate selection

**Scope**  Select a small set of high value windows before external searches to control cost.

**Tests**  Test deterministic selection, configuration limits, ties, and preservation of diverse windows.

**Definition of done**  Provider calls never exceed the configured search budget.

### P1 03 Define the flight search interface and fake adapter

**Scope**  Create one flight search interface and a deterministic mock adapter with normalized results and failures.

**Tests**  Run one shared contract suite for availability, no results, invalid payloads, and provider errors.

**Definition of done**  The travel workflow works end to end without a live provider.

### P1 04 Implement destination matching

**Scope**  Propose destinations from structured preferences, season, trip length, and bounded window candidates without booking behavior.

**Tests**  Test deterministic fixtures, unsupported inputs, and destination diversity.

**Definition of done**  Each proposed destination contains structured reasons that the scorer can verify.

### P1 05 Implement the live flight adapter

**Scope**  Connect a POC provider such as SerpApi, normalize Google Flights style data, and protect credentials and quotas.

**Tests**  Use recorded response fixtures and opt in live smoke tests that do not run on ordinary pull requests.

**Definition of done**  The adapter passes the same contract suite as the fake and returns point in time availability.

### P1 06 Implement travel enrichment and final scoring

**Scope**  Combine selected windows, destinations, live flights, price, convenience, and the existing vacation facts into final recommendations.

**Tests**  Test price and convenience trade offs, multiple passengers, no flights, and provider failure behavior.

**Definition of done**  No destination recommendation is returned without a live flight option.

### P1 07 Build phase 1 travel results

**Scope**  Add destination and flight details, availability timestamp, price, itinerary, and provider unavailable state to the frontend.

**Tests**  Test responsive rendering and all live data states with typed fixtures.

**Definition of done**  The UI makes clear that results are informational and not bookable.

### P1 08 Add phase 1 end to end tests and cost guards

**Scope**  Exercise mock travel enrichment in CI and add opt in live verification, caching, request budgets, and quota error handling.

**Tests**  Assert call counts, cache behavior, no result handling, and unchanged phase 0 operation.

**Definition of done**  The live adapter can be enabled by configuration without changing domain or frontend contracts.

### P1 09 Define opportunity policy and contracts

**Moved, not delivered:** P075 04 now owns this scope under the [Phase 0.75 plan](phase-0.75-plan.md#proactive-opportunities).

### P1 10 Implement pure opportunity scoring

**Moved, not delivered:** P075 04 defines exact scoring, normalization, rounding, and threshold tests.

### P1 11 Add proactive detection and thresholding

**Moved, not delivered:** P075 04 owns complete bounded detection, personal-rule eligibility, criteria differences, and deduplication.

### P1 12 Generate grounded opportunity reasons

**Moved, not delivered:** P075 04 owns deterministic reason facts; P075 06 owns their presentation.

### P1 13 Render the separate opportunities section

**Moved, not delivered:** P075 06 owns this scope and the Search-to-Compare journey.

### P1 14 Verify travel-adapter independence

**Scope**  Base opportunity workflow, persistence, and no-provider operation move to P075 05/10. After the Phase 1 fake/live travel interfaces exist, prove travel enrichment cannot suppress or alter qualifying date-window opportunities.

**Tests**  With fixed personal calendars, clocks, policy and input, assert identical opportunity output with absent, fake, and failing flight adapters. Verify travel-only data stays separate and persisted opportunity facts remain reproducible.

**Definition of done**  Phase 1 integration preserves the Phase 0.75 opportunity contract without reimplementing its detector or policy.

## Continuous integration gate

| **Job** | **Required checks** |
| --- | --- |
| Backend quality | Ruff format check, Ruff lint, mypy strict configuration for application code |
| Backend tests | pytest unit suite with coverage report and deterministic clock and seed settings |
| Database | Start PostgreSQL, apply Alembic migrations, run repository integration tests, verify downgrade where safe |
| Frontend quality | ESLint, Prettier check, TypeScript no emit check |
| Frontend tests | Vitest and React Testing Library |
| Frontend build | Vite production build |
| Acceptance | Phase 0 workflow against PostgreSQL with fake external adapters |

The repository starts public as agreed, with branch protection configured to require the applicable jobs before merge. If plan or platform limits prevent strict enforcement, the workflow still runs and the limitation is documented rather than hidden.

## Recommended execution order

Sequences 1–5 are delivered. Review and version P075 00 first. After the user explicitly authorizes implementation, continue with Phase 0.75 in sequence 6; travel work follows it.

| **Sequence** | **Tasks** | **Reason** |
| --- | --- | --- |
| 1 | P0 01 through P0 05 | Create the full stack and quality gate before domain work |
| 2 | P0 06 through P0 15 | Lock contracts and deterministic behavior with fast tests |
| 3 | P0 16 through P0 20 | Add state, persistence, orchestration, HTTP, and the interpretation seam |
| 4 | P0 21 through P0 25 | Complete the user journey and harden the POC |
| 5 | P05 01 through P05 10, then P05 F01–F02 | Delivered exact-date comparison and follow-ups; see the [Phase 0.5 plan](phase-0.5-plan.md) |
| 6 | P075 01 through P075 10 | Follow the Phase 0.75 dependency table: personal calendars, opportunities, saved options/export, and acceptance |
| 7 | P1 01 through P1 04 | Add travel contracts, cost bounds, fake flight search, and destinations |
| 8 | P1 14 | Prove opportunity independence once the fake flight interface exists |
| 9 | P1 05 through P1 08 | Add live flights, final ranking, UI, and live operational safeguards |

## Phase completion checklists

### Phase 0 complete when

- A user can create an anonymous session and run a search for explicit future months.
- Date calculations are deterministic and covered by golden and property tests.
- Selected-month starts, cross-month ends, nonworking edges, default-zero/explicit-negative limits, and zero-PTO eligibility pass deterministic tests.
- Five ranked results by default show score, explanation, balance impact, and warnings.
- Near duplicates are handled according to the diversity rule.
- A cap-hit search produces a clear narrow-the-search outcome, never a partial ranked list.
- Search inputs and outputs are persisted and reproducible.
- The frontend supports editable text-interpretation proposals, manual search and rerun, direct structured use without interpretation-provider configuration, and feedback.
- All GitHub Actions jobs pass with no real provider secrets required.

### Phase 1 complete when

- Phase 0 behavior remains available without travel configuration.
- Passenger count, one origin, and economy default flow through typed contracts.
- Both fake and live flight adapters satisfy the same interface tests.
- External calls remain within a configured budget and use caching where permitted.
- No travel recommendation appears without a live available flight.
- The product clearly states that it does not book flights and that prices may change.
- The Phase 0.75 opportunity contract, separate presentation, and explicit Search behavior remain intact with real, fake, absent, or failing travel adapters.
- Phase 0.75 supplies the opportunity policy and its tests; Phase 1 proves integration independence rather than implementing them again.
