# Delivery progress and pull request map

This is the versioned record of what has been merged and which pull request delivered each task. The [Phase 0 and Phase 1 implementation task plan](implementation-plan.md) and [Phase 0.5 comparison plan](phase-0.5-plan.md) define each task's scope, tests, and definition of done; this file tracks delivery, not a second copy of the plans.

## How to use this tracker

- Use one task ID per pull request by default, with its tests in the same PR. Start new work from current `main`. If work needs a stack, base each PR on its predecessor and agree how to land it; a merge commit from the verified stack tip into `main` can preserve all commits without rebasing each PR.
- For Phase 0.5 behavior work, write one failing test at an agreed public seam, implement only that behavior, and repeat within the same PR. Keep the Phase 0 regression suite green at every PR tip.
- Add the PR link when it opens. Use **Done** only when the task's scope, tests, and definition of done are on `main` with passing checks, including work incorporated through another PR. Task status records delivery; it need not match the original PR's GitHub state. Use **Partial** when a merged PR delivered only part of the task; list the remaining work below.
- If a PR combines tasks, record the same PR against each task and explain the exception. PR #1 bundled the initial foundation (P0 01–05).
- Keep documentation-only PRs without an explicit task in the history below. A planned design task such as P05 01 is tracked in its phase table.
- Do not assign future PR numbers in advance. A blank PR cell means no PR has been opened yet.

## Merged baseline — September 26, 2026

Phase 0, Phase 0.5, and both Phase 0.5 follow-ups are complete on `main`. [#47](https://github.com/rakreshet/vacation-window-planner/pull/47) landed all 90 stack commits through a merge commit (`9841726`), preserving their original history. Backend and frontend [post-merge CI passed](https://github.com/rakreshet/vacation-window-planner/actions/runs/36233396844).

GitHub marked #4 as merged indirectly. PRs #5–#46 were closed after verifying that every head commit was already an ancestor of `main`; their **Closed** state does not mean their work was discarded. The tables retain the original implementation PRs for traceability. [#48](https://github.com/rakreshet/vacation-window-planner/pull/48) was then rebased onto `main`, passed [CI](https://github.com/rakreshet/vacation-window-planner/actions/runs/36233553175), and merged separately as `7e9d4cd` to ignore IntelliJ project files. No PR from #1–#48 remains open.

Phase 1 remains planned. Desktop Search and Compare run without an interpretation provider key; the optional Interpret action requires its selected provider's key.

## Phase 0

| Task | Deliverable | PR(s) | Status |
| --- | --- | --- | --- |
| P0 01 | Monorepo skeleton | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1) | Done |
| P0 02 | FastAPI health and configuration | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1), [#5](https://github.com/rakreshet/vacation-window-planner/pull/5) | Done |
| P0 03 | PostgreSQL, SQLAlchemy, and Alembic foundation | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1), [#6](https://github.com/rakreshet/vacation-window-planner/pull/6) | Done |
| P0 04 | React, TypeScript, and Vite shell | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1), [#7](https://github.com/rakreshet/vacation-window-planner/pull/7) | Done |
| P0 05 | GitHub Actions CI | [#1](https://github.com/rakreshet/vacation-window-planner/pull/1), [#8](https://github.com/rakreshet/vacation-window-planner/pull/8) | Done |
| P0 06 | Phase 0 domain contracts | [#9](https://github.com/rakreshet/vacation-window-planner/pull/9) | Done |
| P0 07 | Recommendation configuration | [#10](https://github.com/rakreshet/vacation-window-planner/pull/10) | Done |
| P0 08 | Holiday calendar interface | [#11](https://github.com/rakreshet/vacation-window-planner/pull/11) | Done |
| P0 09 | Production holiday calendar adapter | [#12](https://github.com/rakreshet/vacation-window-planner/pull/12) | Done |
| P0 10 | Future-date clipping | [#13](https://github.com/rakreshet/vacation-window-planner/pull/13) | Done |
| P0 11 | Pure vacation-window generator | [#14](https://github.com/rakreshet/vacation-window-planner/pull/14) | Done |
| P0 12 | Generator property tests | [#15](https://github.com/rakreshet/vacation-window-planner/pull/15) | Done |
| P0 13 | Deterministic scoring | [#16](https://github.com/rakreshet/vacation-window-planner/pull/16), [#33](https://github.com/rakreshet/vacation-window-planner/pull/33) | Done |
| P0 14 | Diversity selection | [#17](https://github.com/rakreshet/vacation-window-planner/pull/17), [#33](https://github.com/rakreshet/vacation-window-planner/pull/33) | Done |
| P0 15 | Grounded explanations | [#18](https://github.com/rakreshet/vacation-window-planner/pull/18) | Done |
| P0 16 | Anonymous session persistence | [#19](https://github.com/rakreshet/vacation-window-planner/pull/19) | Done |
| P0 17 | Search and recommendation snapshots | [#20](https://github.com/rakreshet/vacation-window-planner/pull/20) | Done |
| P0 18 | Recommendation workflow | [#21](https://github.com/rakreshet/vacation-window-planner/pull/21) | Done |
| P0 19 | Recommendation endpoint | [#22](https://github.com/rakreshet/vacation-window-planner/pull/22) | Done |
| P0 20 | Constraint interpreter | [#23](https://github.com/rakreshet/vacation-window-planner/pull/23), [#31](https://github.com/rakreshet/vacation-window-planner/pull/31), [#32](https://github.com/rakreshet/vacation-window-planner/pull/32) | Done |
| P0 21 | Phase 0 search interface | [#24](https://github.com/rakreshet/vacation-window-planner/pull/24), [#29](https://github.com/rakreshet/vacation-window-planner/pull/29), [#30](https://github.com/rakreshet/vacation-window-planner/pull/30), [#34](https://github.com/rakreshet/vacation-window-planner/pull/34) | Done |
| P0 22 | Recommendation results | [#25](https://github.com/rakreshet/vacation-window-planner/pull/25), [#29](https://github.com/rakreshet/vacation-window-planner/pull/29), [#33](https://github.com/rakreshet/vacation-window-planner/pull/33) | Done |
| P0 23 | Simple feedback | [#26](https://github.com/rakreshet/vacation-window-planner/pull/26), [#29](https://github.com/rakreshet/vacation-window-planner/pull/29) | Done |
| P0 24 | End-to-end Phase 0 acceptance tests | [#27](https://github.com/rakreshet/vacation-window-planner/pull/27) | Done |
| P0 25 | Phase 0 hardening | [#28](https://github.com/rakreshet/vacation-window-planner/pull/28) | Done |

## Phase 0.5 — compare vacation dates

The [Phase 0.5 plan](phase-0.5-plan.md), its ten implementation tasks, and follow-ups are delivered on `main` through #47. The [acceptance record](phase-0.5-acceptance.md) preserves the automated and live checks. Original task PRs are listed below; their commits were incorporated together as described above.

| Task | Deliverable | PR(s) | Status |
| --- | --- | --- | --- |
| P05 01 | Comparison UX prototype | [#36](https://github.com/rakreshet/vacation-window-planner/pull/36) | Done |
| P05 02 | Shared exact-window accounting | [#37](https://github.com/rakreshet/vacation-window-planner/pull/37) | Done |
| P05 03 | Local-date context | [#38](https://github.com/rakreshet/vacation-window-planner/pull/38) | Done |
| P05 04 | Comparison policy and contracts | [#39](https://github.com/rakreshet/vacation-window-planner/pull/39) | Done |
| P05 05 | Exact baseline service and API | [#40](https://github.com/rakreshet/vacation-window-planner/pull/40) | Done |
| P05 06 | Comparison snapshots | [#41](https://github.com/rakreshet/vacation-window-planner/pull/41) | Done |
| P05 07 | Nearby improvement discovery | [#42](https://github.com/rakreshet/vacation-window-planner/pull/42) | Done |
| P05 08 | Shared frontend context and both entry points | [#43](https://github.com/rakreshet/vacation-window-planner/pull/43) | Done |
| P05 09 | Comparison workspace | [#44](https://github.com/rakreshet/vacation-window-planner/pull/44) | Done |
| P05 10 | End-to-end experience and hardening | [#45](https://github.com/rakreshet/vacation-window-planner/pull/45) | Done |

### Phase 0.5 follow-ups

| Task | Deliverable | PR(s) | Status |
| --- | --- | --- | --- |
| P05 F01 | Prevent end-date selection before the comparison start; immediate validation for existing invalid dates | [#46](https://github.com/rakreshet/vacation-window-planner/pull/46) | Done |
| P05 F02 | Add U.S. federal and England & Wales bank holiday calendars to Search and comparison; preserve custom weekends | [#47](https://github.com/rakreshet/vacation-window-planner/pull/47) | Done |

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

## Documentation and repository maintenance PRs

| PR | Status | Result |
| --- | --- | --- |
| [#2](https://github.com/rakreshet/vacation-window-planner/pull/2) | Merged | Recorded the four Phase 0 product-rule decisions in the PRD, HLD, and task plan; added domain language. |
| [#3](https://github.com/rakreshet/vacation-window-planner/pull/3) | Merged | Introduced this delivery progress and PR map. |
| [#4](https://github.com/rakreshet/vacation-window-planner/pull/4) | Merged indirectly via #47 | Recorded search-completeness and interpretation-confirmation rules. |
| [#35](https://github.com/rakreshet/vacation-window-planner/pull/35) | Closed; delivered via #47 | Defined the approved Phase 0.5 comparison plan, ten tasks, test-first delivery rules, and progress table. |
| [#48](https://github.com/rakreshet/vacation-window-planner/pull/48) | Merged | Ignore IntelliJ IDEA project directories and module files. |
| [#49](https://github.com/rakreshet/vacation-window-planner/pull/49) | Open | Refresh delivery tables and product, architecture, operational, and local-run documentation after the stack merge. |
