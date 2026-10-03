# Budget playground and shareable year card

Date: 2026-10-03. Task prefix: **QW**. The user authorized implementation, TDD, one responsibility per PR, and dependent stacked PRs. This plan records that authorization; it does not require a second implementation approval. Confirm the public test seams in the companion [test strategy](quick-wins-testing.md) before the first behavioral test, as required by the TDD skill.

Baseline: `origin/main` = `36a1b33`, including annual planning/redesign through #72 and calendar-export removal through #79. Work uses an isolated managed worktree, preserving the original checkout's local changes. Calendar downloads/imports remain canceled; the requested image card is a distinct feature. Do not merge PRs automatically.

Companions: [UX walkthrough](quick-wins-ux.md), [test strategy](quick-wins-testing.md), [delivery tracker](progress.md#budget-playground-and-shareable-year-card).

## Product outcome

After planning a year, answer **what changes with one fewer or one more available leave day**, while keeping the requested mix, reserve, exact locks, calendar, months and spacing fixed. Show actual days away and date changes, including an honest unchanged result. From a selected current or historical annual plan, create a polished year card that can be previewed and downloaded as a PNG. Neither feature needs an interpretation key, paid provider, account, public link, or external message.

For one 3–14 day break starting May 2027 under England & Wales holidays and Saturday/Sunday weekends, with no reserve, the existing engine returns 6 days away for 3 leave days (May 1–6), 9 for 4 (May 1–9), and 10 for 5 (May 1–10). Monday May 3 is the [Early May bank holiday](https://www.gov.uk/bank-holidays), assumed nonworking in this example. Use this literal example as a demonstration, not a universal multiplier.

## Budget comparison rules

- The baseline is the submitted annual request's available balance, not whichever alternative objective happens to be selected on screen. Compare the **Most days away** objective in each scenario. The UI explains this and does not equate the baseline with a selected Fewer leave days plan.
- Compare baseline B with valid B−1 and B+1 values within 0–366 and at least the reserve. Return only valid scenarios, ordered by budget; explain unavailable edge scenarios in the UI. No adjustable sweep or request-on-slider interaction in v1.
- Capture local today and the resolved holiday calendar once. Change only `balance_days`; preserve all other personal context, requests, locks, reserve and policy. Evaluate the baseline first so an exhausted comparison cannot consume its work on an optional neighbor.
- Reuse the annual optimizer and its accounting. Add a primary-only option at the existing `plan_year` interface, defaulting to today's full alternatives behavior. The comparison needs one primary plan per scenario, including the same proven infeasibility/reduction behavior.
- Share one existing `WorkBudget` across the comparison. Keep current candidate/state/transition caps and five-second calculation deadline. Each scenario retains complete, infeasible, conflict or too-broad truth; previously completed scenarios remain usable when later work runs out. Never present a capped scenario as infeasible, unchanged or optimal, and never return partial plans from that scenario. Counters are cumulative and documented as such.
- A days-away delta is shown only between two completed full-mix results. Reduced outcomes disclose omitted breaks and are not presented as equivalent full-mix improvements. Conflicts retain their existing facts. An all-locked request can legitimately keep dates unchanged across budgets.
- Comparison is an ephemeral experiment: it neither changes the annual draft nor creates annual database rows. Adopting a scenario explicitly copies its budget to the draft, marks current annual results stale, and requires Generate plans. The ordinary annual workflow then persists its result. Existing snapshots and saves keep their original budgets.
- Use the same process-wide two-permit calculation gate as annual planning. Do not add automatic retries or fan out concurrent scenario requests.

## Year card rules

- Build from one explicitly selected, validated annual snapshot. Support current full/reduced plans and saved historical plans without a backend request. Selected plans, omissions, year, dates and totals must agree with the preview and image.
- Design a legible light card: year and title; total days away and break count; compact 12-month calendar highlighting selected dates; chronological break list with exact inclusive dates and locked status; calculation date; proposed-plan disclosure. Reduced cards name omitted slots; historical cards retain the historical calculation date.
- Hide leave cost, available balance, remaining balance and reserve by default. An independent Include leave details checkbox opts them in. Always omit bearer tokens, IDs, source text, personal exceptions and unavailable dates. Unselected calendar dates remain neutral.
- Use code-native SVG as the deterministic render source and native browser image/canvas APIs for PNG. No new raster-generation service, external font, image fetch, server upload or package is needed. A named local card palette follows the current design system and stays readable outside the app.
- The UI provides a visible preview, semantic text equivalent, filename and explicit Download PNG action. The downloaded artifact contains the reviewed snapshot and settings. Browser/image/canvas failures report an error rather than a false download success.
- A draft edit, plan selection change or replacement calculation invalidates an open current-plan preview and pending actions. Closing returns keyboard focus to the opener. Saved historical previews work offline; they do not imply current recalculation or leave approval.

## Interfaces and design

Use a deep pure comparison module: `compare_annual_budgets(annual_request, prepared_calendar, policy, work_budget) -> BudgetComparisonOutcome`. It hides scenario ordering, context substitution and result honesty. Test through this interface and the existing `plan_year` interface, not graph/DP helpers. The optional primary-only annual mode must preserve the default annual interface's results.

The workflow resolves one calendar and one local date, then returns sanitized context plus the comparison outcome through authenticated `POST /annual-plans/budget-comparison` with the existing AnnualRequest body and bearer session. The canonical session supplies the baseline budget. No public read endpoint, migration or database comparison history is introduced. Existing request-size limits, annual validation, provider failures and busy errors apply.

The frontend validates the comparison wire shape and verifies scenario budgets, unchanged inputs and context consistency. It presents comparisons separately from active annual plans. Use accessible controls, explicit loading/error states, stable draft revisions and cancellation; no stale response can replace newer inputs.

The artifact interface `yearCardSvg(snapshot, options) -> SVG text` owns selected-plan content, date formatting, privacy and escaped XML. Browser rasterization and file download are external adapters. Tests parse the resulting artifact and observe rendered journeys; they do not assert private drawing functions or JSX structure.

## Ordered dependent PRs

Each branch starts at its predecessor's final reviewed commit and targets that predecessor. QW 00 targets main. If main advances, inspect the change before rebasing/retargeting; never force unrelated history or fold local UI changes into this stack.

| Task | Responsibility | Branch | Depends on | Definition of done |
| --- | --- | --- | --- | --- |
| QW 00 | Scope, contracts, UX, confirmed test seams and progress table | `codex/quick-wins-00-plan` | main | Documentation PR is reviewable; seams confirmed before behavior work |
| QW 01 | Pure bounded budget comparison and primary-only annual mode | `codex/quick-wins-01-comparison` | QW 00 | Literal budget jump, locks/reserve, edges, reduced/capped honesty and default annual regression pass |
| QW 02 | Authenticated comparison workflow and HTTP contract | `codex/quick-wins-02-http` | QW 01 | One calendar/date, session validation, errors, shared permit and no persistence side effects verified |
| QW 03 | Annual budget playground and explicit adoption | `codex/quick-wins-03-playground` | QW 02 | Three scenario cards, truthful comparisons, no automatic requests, stale/error/cancel behavior and adoption journey pass |
| QW 04 | Snapshot-to-year-card SVG and PNG adapter | `codex/quick-wins-04-card` | QW 03 | Parsed artifact content/privacy, escaped text, calendar dates, layout bounds and observable rasterization failures pass |
| QW 05 | Year-card preview/download in current and saved plans | `codex/quick-wins-05-sharing` | QW 04 | Offline saved preview, selected/reduced plan fidelity, opt-in details, focus, invalidation and actual PNG download verified |
| QW 06 | Integrated acceptance, performance and delivery evidence | `codex/quick-wins-06-acceptance` | QW 05 | Fresh full checks, browser evidence at 1024/1440px, downloaded PNG inspection and measured comparison bounds recorded |

Do not open placeholder implementation PRs or mark tasks Done before delivery. Every behavior PR includes its tests and starts with one observed failing behavior at a confirmed seam. Preserve meaningful typed names and focused functions; no explanatory code comments that repeat the implementation.

## Completion gate

- Structured annual, Search, Compare, Saved and leave-request copying continue to pass their regression suites; canceled calendar export stays absent.
- The May demonstration visibly yields 6/9/10 days away under the stated fixed rules; a budget change can also visibly yield no improvement.
- Reserve, exact locks, omitted slots, caps and hypothetical budgets remain truthful at domain, HTTP and UI seams.
- A changed draft never triggers comparison automatically or permits stale adoption/sharing.
- A PNG containing the reviewed current or historical selected plan actually downloads in a supported browser and renders legibly. Privacy defaults and optional leave details match the artifact.
- Record timings and work counters for IL/US/GB normal three-slot comparisons, plus deterministic cap/concurrency behavior. Target warm p95 <=5 seconds for the bounded comparison; report complete versus capped outcomes separately. Keep the existing annual limits unchanged. A missed target leads to measurement and a documented repair, not silently raised limits.
- Required CI checks pass at every PR tip. The final acceptance record states measured commands, commits, visual evidence and unresolved limitations. PRs remain open for user review; tracker status becomes Done only after merge.
