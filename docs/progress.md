# Delivery progress and pull request map

This is the versioned record of what has been merged and which pull request delivered each task. The [Phase 0 and Phase 1 implementation task plan](implementation-plan.md) and [Phase 0.5 comparison plan](phase-0.5-plan.md) define each task's scope, tests, and definition of done; this file tracks delivery, not a second copy of the plans.

## How to use this tracker

- Use one task ID per pull request by default, with its tests in the same PR. Give stacked PRs ordered titles and base each on the preceding branch; the user will review and merge in order after the latest branch is runnable.
- For Phase 0.5 behavior work, write one failing test at an agreed public seam, implement only that behavior, and repeat within the same PR. Keep the Phase 0 regression suite green at every PR tip.
- Add the PR link when it opens. Use **Done** only when the task's scope, tests, and definition of done are merged with passing checks. Use **Partial** when a merged PR delivered only part of the task; list the remaining work below.
- If a PR combines tasks, record the same PR against each task and explain the exception. PR #1 bundled the initial foundation (P0 01–05).
- Keep documentation-only PRs without an explicit task in the history below. A planned design task such as P05 01 is tracked in its phase table.
- Do not assign future PR numbers in advance. A blank PR cell means no PR has been opened yet.

Phase 0 implementation and its production desktop UI are complete in the open, numbered stack through the accurate hero-copy follow-up [#34](https://github.com/rakreshet/vacation-window-planner/pull/34). Review, rebase, and merge the PRs in numeric order; the latest branch is runnable without an interpretation provider key. The core Phase 0 product and operational decisions have been resolved.

## Phase 0

| Task | Deliverable | PR(s) | Status |
| --- | --- | --- | --- |
| P0 01 | Monorepo skeleton | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1) | Done |
| P0 02 | FastAPI health and configuration | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1), [#5](https://github.com/rakreshet/vacation-window-planner/pull/5) | Partial; PR open |
| P0 03 | PostgreSQL, SQLAlchemy, and Alembic foundation | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1), [#6](https://github.com/rakreshet/vacation-window-planner/pull/6) | Partial; PR open |
| P0 04 | React, TypeScript, and Vite shell | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1), [#7](https://github.com/rakreshet/vacation-window-planner/pull/7) | Partial; PR open |
| P0 05 | GitHub Actions CI | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1), [#8](https://github.com/rakreshet/vacation-window-planner/pull/8) | Partial; PR open |
| P0 06 | Phase 0 domain contracts | [#9](https://github.com/rakreshet/vacation-window-planner/pull/9) | PR open |
| P0 07 | Recommendation configuration | [#10](https://github.com/rakreshet/vacation-window-planner/pull/10) | PR open |
| P0 08 | Holiday calendar interface | [#11](https://github.com/rakreshet/vacation-window-planner/pull/11) | PR open |
| P0 09 | Production holiday calendar adapter | [#12](https://github.com/rakreshet/vacation-window-planner/pull/12) | PR open |
| P0 10 | Future-date clipping | [#13](https://github.com/rakreshet/vacation-window-planner/pull/13) | PR open |
| P0 11 | Pure vacation-window generator | [#14](https://github.com/rakreshet/vacation-window-planner/pull/14) | PR open |
| P0 12 | Generator property tests | [#15](https://github.com/rakreshet/vacation-window-planner/pull/15) | PR open |
| P0 13 | Deterministic scoring | [#16](https://github.com/rakreshet/vacation-window-planner/pull/16), [#33](https://github.com/rakreshet/vacation-window-planner/pull/33) | PR open |
| P0 14 | Diversity selection | [#17](https://github.com/rakreshet/vacation-window-planner/pull/17), [#33](https://github.com/rakreshet/vacation-window-planner/pull/33) | PR open |
| P0 15 | Grounded explanations | [#18](https://github.com/rakreshet/vacation-window-planner/pull/18) | PR open |
| P0 16 | Anonymous session persistence | [#19](https://github.com/rakreshet/vacation-window-planner/pull/19) | PR open |
| P0 17 | Search and recommendation snapshots | [#20](https://github.com/rakreshet/vacation-window-planner/pull/20) | PR open |
| P0 18 | Recommendation workflow | [#21](https://github.com/rakreshet/vacation-window-planner/pull/21) | PR open |
| P0 19 | Recommendation endpoint | [#22](https://github.com/rakreshet/vacation-window-planner/pull/22) | PR open |
| P0 20 | Constraint interpreter | [#23](https://github.com/rakreshet/vacation-window-planner/pull/23), [#31](https://github.com/rakreshet/vacation-window-planner/pull/31), [#32](https://github.com/rakreshet/vacation-window-planner/pull/32) | PR open |
| P0 21 | Phase 0 search interface | [#24](https://github.com/rakreshet/vacation-window-planner/pull/24), [#29](https://github.com/rakreshet/vacation-window-planner/pull/29), [#30](https://github.com/rakreshet/vacation-window-planner/pull/30), [#34](https://github.com/rakreshet/vacation-window-planner/pull/34) | PR open |
| P0 22 | Recommendation results | [#25](https://github.com/rakreshet/vacation-window-planner/pull/25), [#29](https://github.com/rakreshet/vacation-window-planner/pull/29), [#33](https://github.com/rakreshet/vacation-window-planner/pull/33) | PR open |
| P0 23 | Simple feedback | [#26](https://github.com/rakreshet/vacation-window-planner/pull/26), [#29](https://github.com/rakreshet/vacation-window-planner/pull/29) | PR open |
| P0 24 | End-to-end Phase 0 acceptance tests | [#27](https://github.com/rakreshet/vacation-window-planner/pull/27) | PR open |
| P0 25 | Phase 0 hardening | [#28](https://github.com/rakreshet/vacation-window-planner/pull/28) | PR open |

### Foundation follow-ups from PR #1

These gaps are relative to the existing task plan, not regressions in the running health-screen POC. Close each under its existing task ID in a small PR, then update the row above.

| Task | Remaining acceptance work |
| --- | --- |
| P0 02 | Structured API error envelope and invalid-configuration handling are addressed by [#5](https://github.com/rakreshet/vacation-window-planner/pull/5), pending merge. The health endpoint and typed settings already exist. |
| P0 03 | Typed SQLAlchemy session management is addressed by [#6](https://github.com/rakreshet/vacation-window-planner/pull/6), pending merge. Database connectivity and Alembic upgrade/downgrade tests already exist. |
| P0 04 | Typed health API client, explicit frontend environment configuration, and loading/failure tests are addressed by [#7](https://github.com/rakreshet/vacation-window-planner/pull/7), pending merge. The Vite shell and success-state test already exist. |
| P0 05 | Docker build caching and the planned frontend lint/format checks are addressed by [#8](https://github.com/rakreshet/vacation-window-planner/pull/8), pending merge. Backend and frontend jobs already run, and both are required checks on `main`. |

## Phase 0.5 — compare vacation dates

The [Phase 0.5 plan](phase-0.5-plan.md) is proposed in [#35](https://github.com/rakreshet/vacation-window-planner/pull/35), based on the open Phase 0 tip at PR #34. Phase 0.5 delivery is in progress in the open stack below. Add each real PR link and update its status as the stack progresses. Keep Search, its results, and feedback working at each step.

| Task | Deliverable | PR(s) | Status |
| --- | --- | --- | --- |
| P05 01 | Comparison UX prototype | [#36](https://github.com/rakreshet/vacation-window-planner/pull/36) | PR open |
| P05 02 | Shared exact-window accounting | [#37](https://github.com/rakreshet/vacation-window-planner/pull/37) | PR open |
| P05 03 | Local-date context | [#38](https://github.com/rakreshet/vacation-window-planner/pull/38) | PR open |
| P05 04 | Comparison policy and contracts | [#39](https://github.com/rakreshet/vacation-window-planner/pull/39) | PR open |
| P05 05 | Exact baseline service and API | [#40](https://github.com/rakreshet/vacation-window-planner/pull/40) | PR open |
| P05 06 | Comparison snapshots | [#41](https://github.com/rakreshet/vacation-window-planner/pull/41) | PR open |
| P05 07 | Nearby improvement discovery | [#42](https://github.com/rakreshet/vacation-window-planner/pull/42) | PR open |
| P05 08 | Shared frontend context and both entry points | [#43](https://github.com/rakreshet/vacation-window-planner/pull/43) | PR open |
| P05 09 | Comparison workspace | — | Planned |
| P05 10 | End-to-end experience and hardening | — | Planned |

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
| [#4](https://github.com/rakreshet/vacation-window-planner/pull/4) | Open | First Phase 0 stack PR: records search-completeness and interpretation-confirmation rules. |
| [#35](https://github.com/rakreshet/vacation-window-planner/pull/35) | Open | Proposes the Phase 0.5 comparison UX and backend plan, ten gradual tasks, test-first delivery rules, and its progress table. Stacked on #34. |
