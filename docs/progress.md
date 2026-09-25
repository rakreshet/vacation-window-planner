# Delivery progress and pull request map

This is the versioned record of what has been merged and which pull request delivered each task. The [implementation task plan](implementation-plan.md) defines each task's scope, tests, and definition of done; this file tracks delivery, not a second copy of the plan.

## How to use this tracker

- Use one task ID per pull request by default, with its tests in the same PR. For the approved Phase 0 stack, give each PR an ordered title and base it on the preceding branch; the user will review and merge in order after the latest branch is runnable.
- Add the PR link when it opens. Use **Done** only when the task's scope, tests, and definition of done are merged with passing checks. Use **Partial** when a merged PR delivered only part of the task; list the remaining work below.
- If a PR combines tasks, record the same PR against each task and explain the exception. PR #1 bundled the initial foundation (P0 01–05).
- Keep documentation-only PRs in the history below; they do not complete an implementation task.
- Do not assign future PR numbers in advance. A blank PR cell means no PR has been opened yet.

The next implementation PR is to finish **P0 02**. Once the foundation follow-ups are complete, **P0 06** is the next new task ID. The core Phase 0 product decisions have been resolved; [operational choices](open-decisions.md) remain for the relevant implementation tasks.

## Phase 0

| Task | Deliverable | PR(s) | Status |
| --- | --- | --- | --- |
| P0 01 | Monorepo skeleton | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1) | Done |
| P0 02 | FastAPI health and configuration | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1) | Partial |
| P0 03 | PostgreSQL, SQLAlchemy, and Alembic foundation | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1) | Partial |
| P0 04 | React, TypeScript, and Vite shell | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1) | Partial |
| P0 05 | GitHub Actions CI | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1) | Partial |
| P0 06 | Phase 0 domain contracts | — | Planned |
| P0 07 | Recommendation configuration | — | Planned |
| P0 08 | Holiday calendar interface | — | Planned |
| P0 09 | Production holiday calendar adapter | — | Planned |
| P0 10 | Future-date clipping | — | Planned |
| P0 11 | Pure vacation-window generator | — | Planned |
| P0 12 | Generator property tests | — | Planned |
| P0 13 | Deterministic scoring | — | Planned |
| P0 14 | Diversity selection | — | Planned |
| P0 15 | Grounded explanations | — | Planned |
| P0 16 | Anonymous session persistence | — | Planned |
| P0 17 | Search and recommendation snapshots | — | Planned |
| P0 18 | Recommendation workflow | — | Planned |
| P0 19 | Recommendation endpoint | — | Planned |
| P0 20 | Gemini constraint interpreter | — | Planned |
| P0 21 | Phase 0 search interface | — | Planned |
| P0 22 | Recommendation results | — | Planned |
| P0 23 | Simple feedback | — | Planned |
| P0 24 | End-to-end Phase 0 acceptance tests | — | Planned |
| P0 25 | Phase 0 hardening | — | Planned |

### Foundation follow-ups from PR #1

These gaps are relative to the existing task plan, not regressions in the running health-screen POC. Close each under its existing task ID in a small PR, then update the row above.

| Task | Remaining acceptance work |
| --- | --- |
| P0 02 | Add and test the structured API error envelope and invalid-configuration handling. The health endpoint and typed settings already exist. |
| P0 03 | Add typed SQLAlchemy session management. Database connectivity and Alembic upgrade/downgrade tests already exist. |
| P0 04 | Extract a typed health API client, make frontend environment configuration explicit, and test loading and failure states. The Vite shell and success-state test already exist. |
| P0 05 | Add dependency caching and the planned frontend lint/format checks. Backend and frontend jobs already run, and both are required checks on `main`. |

## Phase 1

The rows follow the [recommended execution order](implementation-plan.md#recommended-execution-order): proactive opportunities first, then travel integration.

| Task | Deliverable | PR(s) | Status |
| --- | --- | --- | --- |
| P1 09 | Opportunity policy and contracts | — | Planned |
| P1 10 | Pure opportunity scoring | — | Planned |
| P1 11 | Proactive detection and thresholding | — | Planned |
| P1 12 | Grounded opportunity reasons | — | Planned |
| P1 13 | Separate opportunities section | — | Planned |
| P1 01 | Phase 1 travel contracts | — | Planned |
| P1 02 | Bounded travel candidate selection | — | Planned |
| P1 03 | Flight search interface and fake adapter | — | Planned |
| P1 04 | Destination matching | — | Planned |
| P1 14 | Opportunity workflow independence | — | Planned |
| P1 05 | Live flight adapter | — | Planned |
| P1 06 | Travel enrichment and final scoring | — | Planned |
| P1 07 | Phase 1 travel results | — | Planned |
| P1 08 | Phase 1 end-to-end tests and cost guards | — | Planned |

## Documentation PRs

| PR | Status | Result |
| --- | --- | --- |
| [#2](https://github.com/rakreshet/vacation-window-planner/pull/2) | Merged | Recorded the four Phase 0 product-rule decisions in the PRD, HLD, and task plan; added domain language. |
| [#3](https://github.com/rakreshet/vacation-window-planner/pull/3) | Merged | Introduced this delivery progress and PR map. |
