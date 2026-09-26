# Delivery progress and pull request map

This is the versioned record of what has been merged and which pull request delivered each task. The [Phase 0 and Phase 1 implementation task plan](implementation-plan.md), [Phase 0.5 comparison plan](phase-0.5-plan.md), [Phase 0.75 plan](phase-0.75-plan.md), and [annual planning plan](annual-plans-plan.md) define each task's scope, tests, and definition of done; this file tracks delivery, not a second copy of the plans.

## How to use this tracker

- Use one task ID per pull request by default, with its tests in the same PR. Start new work from current `main`. If work needs a stack, base each PR on its predecessor and agree how to land it; a merge commit from the verified stack tip into `main` can preserve all commits without rebasing each PR.
- For Phase 0.5 behavior work, write one failing test at an agreed public seam, implement only that behavior, and repeat within the same PR. Keep the Phase 0 regression suite green at every PR tip.
- Phase 0.75 carries forward this test-first process at the seams listed in its plan. P075 00 is design-only; the user approved implementation on 2026-09-26 after merging the plan. Keep prior phase regression checks green at each implementation PR.
- Annual planning AP 00 is documentation only. Its [test seams](annual-plans-testing.md#proposed-public-test-seams) and dependent PR sequence are proposed for review. AP 01–10 require later explicit implementation authorization and use one behavioral red/green slice at a time. They are not authorized by creation or merge of the planning PR.
- Add the PR link when it opens. Use **Done** only when the task's scope, tests, and definition of done are on `main` with passing checks, including work incorporated through another PR. Task status records delivery; it need not match the original PR's GitHub state. Use **Partial** when a merged PR delivered only part of the task; list the remaining work below.
- If a PR combines tasks, record the same PR against each task and explain the exception. PR #1 bundled the initial foundation (P0 01–05).
- Keep documentation-only PRs without an explicit task in the history below. A planned design task such as P05 01 is tracked in its phase table.
- Do not assign future PR numbers in advance. A blank PR cell means no PR has been opened yet.

## Merged baseline — September 26, 2026

Phase 0, Phase 0.5, and both Phase 0.5 follow-ups are complete on `main`. [#47](https://github.com/rakreshet/vacation-window-planner/pull/47) landed all 90 stack commits through a merge commit (`9841726`), preserving their original history. Backend and frontend [post-merge CI passed](https://github.com/rakreshet/vacation-window-planner/actions/runs/36233396844).

GitHub marked #4 as merged indirectly. PRs #5–#46 were closed after verifying that every head commit was already an ancestor of `main`; their **Closed** state does not mean their work was discarded. The tables retain the original implementation PRs for traceability. [#48](https://github.com/rakreshet/vacation-window-planner/pull/48) was then rebased onto `main`, passed [CI](https://github.com/rakreshet/vacation-window-planner/actions/runs/36233553175), and merged separately as `7e9d4cd` to ignore IntelliJ project files. No PR from #1–#48 remains open.

Phase 0.75 is implemented in the unmerged #51–#60 stack, with the client acceptance caveats recorded below. Annual planning is the next proposed feature; Phase 1 retains its later flight scope. Desktop Search and Compare run without an interpretation provider key; the optional Interpret action requires its selected provider's key. The documentation refresh [#49](https://github.com/rakreshet/vacation-window-planner/pull/49) is merged as `b203ea6`.

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

## Phase 0.75 — personal calendars, opportunities, and saved options

The [Phase 0.75 plan](phase-0.75-plan.md) defines ten behavior PRs plus its design PR. The [UX walkthrough](phase-0.75-ux.md) records the inspectable flows and fixed fixtures. Implementation is complete in the dependent PR stack, still open as verified September 26, 2026. The [acceptance record](phase-0.75-acceptance.md) retains actual browser-download/client-import limitations; In review does not mean delivered.

| Task | Deliverable | PR(s) | Status |
| --- | --- | --- | --- |
| P075 00 | Product/backend/frontend plan, UX walkthrough, and PR sequence | [#50](https://github.com/rakreshet/vacation-window-planner/pull/50) | Done |
| P075 01 | Shared calendar normalization and window assessment | [#51](https://github.com/rakreshet/vacation-window-planner/pull/51) | In review |
| P075 02 | Personal context persistence and typed calculation results | [#52](https://github.com/rakreshet/vacation-window-planner/pull/52) | In review |
| P075 03 | Personal calendar controls in Find and Compare | [#53](https://github.com/rakreshet/vacation-window-planner/pull/53) | In review |
| P075 04 | Opportunity policy, scoring, and bounded detection | [#54](https://github.com/rakreshet/vacation-window-planner/pull/54) | In review |
| P075 05 | Opportunity workflow and atomic snapshots | [#55](https://github.com/rakreshet/vacation-window-planner/pull/55) | In review |
| P075 06 | Separate opportunities section and comparison entry | [#56](https://github.com/rakreshet/vacation-window-planner/pull/56) | In review |
| P075 07 | Complete action snapshots for every visible date | [#57](https://github.com/rakreshet/vacation-window-planner/pull/57) | In review |
| P075 08 | Same-browser Saved options journey | [#58](https://github.com/rakreshet/vacation-window-planner/pull/58) | In review |
| P075 09 | Calendar export and leave-request copy | [#59](https://github.com/rakreshet/vacation-window-planner/pull/59) | In review |
| P075 10 | Full acceptance, accessibility, performance, and operational documentation | [#60](https://github.com/rakreshet/vacation-window-planner/pull/60) | In review; client imports pending |

## Annual planning — several vacations, one budget

The [annual plan](annual-plans-plan.md), [UX walkthrough](annual-plans-ux.md), and [test strategy](annual-plans-testing.md) define AP 00–10. The user confirmed that locked trips count toward the requested mix and the balance covers included future trips without past-trip, accrual, or carryover calculations. The user approved the plan and its test seams by merging #61 and explicitly authorizing implementation on September 26, 2026.

Base verified September 26, 2026: `origin/main` = `20df229`; #50 merged; #51–#60 open; local and remote #60 tip = `aaabf4e`. AP 00 targets #60's branch so its diff is documentation only. Recheck and retarget when that stack lands. No prior PR is merged by this work. Subsequent verification found #61 merged into the #60 branch as `69c6d16`, while main remains `20df229`. AP 01 starts from that merged prerequisite tip; the user has now explicitly authorized AP 01–10.

| Task | Deliverable | Depends on | PR(s) | Status |
| --- | --- | --- | --- | --- |
| AP 00 | Versioned BE/FE/UX plan, test strategy, domain terms and PR sequence | P075 10 branch tip | [#61](https://github.com/rakreshet/vacation-window-planner/pull/61) | Merged into prerequisite stack |
| AP 01 | Locked-only annual assessment, shared budget/reserve and conflict facts | AP 00 + explicit implementation authorization | [#62](https://github.com/rakreshet/vacation-window-planner/pull/62) | In review |
| AP 02 | Complete annual candidates and exact full-mix optimizer | AP 01 | [#63](https://github.com/rakreshet/vacation-window-planner/pull/63) | In review |
| AP 03 | Diverse full plans, labeled reductions and truthful diagnostics | AP 02 | [#64](https://github.com/rakreshet/vacation-window-planner/pull/64) | In review |
| AP 04 | Authenticated workflow/HTTP, annual snapshots and resource controls | AP 03 | [#65](https://github.com/rakreshet/vacation-window-planner/pull/65) | In review |
| AP 05 | Structured annual workspace and first integrated planning journey | AP 04 | [#66](https://github.com/rakreshet/vacation-window-planner/pull/66) | In review |
| AP 06 | Year view, whole-plan comparison and lock/recalculate UX | AP 05 | [#67](https://github.com/rakreshet/vacation-window-planner/pull/67) | 94 frontend tests; live generated alternatives, preserved lock and keyboard details verified |
| AP 07 | Optional interpretation with proposal review and explicit references | AP 06 | [#68](https://github.com/rakreshet/vacation-window-planner/pull/68) | Typed proposal/review flow; 269 backend and 100 frontend tests pass |
| AP 08 | Same-browser saved annual plans and explicit reopening/recalculation | AP 07 | [#69](https://github.com/rakreshet/vacation-window-planner/pull/69) | Immutable browser snapshots; 108 frontend tests; live reload and separate recalculation verified |
| AP 09 | Whole-plan calendar download and leave-request copy | AP 08 | Preparing PR | 115 frontend tests; parser and live preview verified; actual download/client imports pending |
| AP 10 | Integrated acceptance, performance, accessibility and runbook | AP 09 | — | Planned |

The [ordered breakdown](annual-plans-plan.md#ordered-dependent-pr-breakdown) supplies each task's scope, acceptance evidence, and stacking policy. Do not create implementation PRs or mark work Done in advance. Planning review/merge alone is not permission to implement.

## Phase 1

Opportunity tasks have moved to Phase 0.75; Moved is a scope change, not completion. The remaining travel rows follow the [recommended execution order](implementation-plan.md#recommended-execution-order). P1 14 retains the future travel-adapter regression gate.

| Task | Deliverable | PR(s) | Status |
| --- | --- | --- | --- |
| P1 09 | Opportunity policy and contracts → P075 04 | — | Moved |
| P1 10 | Pure opportunity scoring → P075 04 | — | Moved |
| P1 11 | Proactive detection and thresholding → P075 04 | — | Moved |
| P1 12 | Grounded opportunity reasons → P075 04 | — | Moved |
| P1 13 | Separate opportunities section → P075 06 | — | Moved |
| P1 01 | Phase 1 travel contracts | — | Planned |
| P1 02 | Bounded travel candidate selection | — | Planned |
| P1 03 | Flight search interface and fake adapter | — | Planned |
| P1 04 | Destination matching | — | Planned |
| P1 14 | Travel-adapter independence regression; base workflow moves to P075 05/10 | — | Planned |
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
| [#49](https://github.com/rakreshet/vacation-window-planner/pull/49) | Merged | Refresh delivery tables and product, architecture, operational, and local-run documentation after the stack merge. |

Implementation decision (2026-09-26): the user confirmed there are no deployed clients or databases to preserve. Use non-null columns where appropriate; historical-data backfill is not required. Keep fresh-schema and application regression checks.

Code style decision (2026-09-26): use meaningful names and focused functions; avoid comments that repeat clear code. Refactor existing behavior only with test coverage.
