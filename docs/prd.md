# Vacation Window Recommendation POC Product Requirements

Phase 0 validates date window recommendations before travel enrichment

This document defines the first product release, the decisions already made, and the acceptance criteria for a reliable vacation window recommendation experience. Phase 0 recommends when to take vacation. Phase 1 adds destinations, live flights, and proactive vacation opportunities without changing the core recommendation model.

| Field | Value |
| --- | --- |
| **Status** | Approved planning baseline |
| **Prepared for** | POC product and engineering implementation |
| **Version date** | 2026-09-25 |

## Product decision

Build a standalone proof of concept for salaried employees who want to use limited vacation days well. The first release will generate and rank vacation date windows from a vacation balance, a holiday calendar, weekends, and explicit month choices. It will not recommend destinations or search flights. The product must remain simple enough to validate the core value before external travel data is introduced.

## Problem and user

Employees can see balances and calendars in HR tools, but they still have to discover useful vacation opportunities themselves. The target user is a salaried employee in any supported country who knows a current vacation balance and wants a short, understandable set of date options. The POC begins as a standalone product; a future HR integration may prefill the same inputs.

## Product goals

- Recommend feasible vacation windows that combine workdays, weekends, and public holidays.
- Make the ranking understandable through a 0 to 100 score and a short explanation for every result.
- Preserve meaningful trade offs while avoiding a list crowded with near duplicate windows.
- Use anonymous sessions so the user can refine inputs during one session without creating an account.
- Create a stable foundation for independent phase 1 travel enrichment and proactive opportunity detection.

## Phase plan

| **Phase** | **Included** | **Explicitly excluded** |
| --- | --- | --- |
| Phase 0 | Vacation window generation, ranking, explanations, anonymous session state, persisted search snapshots, simple feedback | Destinations, flight search, booking, user accounts, accrual forecasting |
| Phase 1 | Destination matching and live flight enrichment (multi passenger, one origin, economy default); separate proactive future vacation opportunities | Flight booking and payment; LLM based opportunity decisions |

## Phase 0 user experience

1. The user starts an anonymous browser session and enters a current vacation balance, country or calendar, explicit months, preferred trip length, and any relevant schedule override. Optional conversational text may produce an editable proposal for these fields.
1. The interface confirms the effective holiday calendar and weekend pattern. A locale based calendar is the default; the user may override an unusual calendar or working week.
1. The user reviews or edits the structured fields and starts the search manually. Interpreting text or editing an input does not itself run or rerun a search; structured search remains available without Gemini.
1. The product returns up to five ranked windows by default. The result count is configurable.
1. Each result shows dates, total consecutive days away, vacation days used, remaining balance, score, warnings, and a short reason.
1. The user may give a thumbs up or thumbs down without supplying text.

## Inputs and validation

| **Input** | **Rule** | **Phase 0 behavior** |
| --- | --- | --- |
| Vacation balance | Whole vacation days only | Retained in session and copied into each persisted search snapshot |
| Allowed negative balance | Optional whole-day allowance, default 0, maximum 5 | A window may leave a negative balance only when the user explicitly sets enough allowance; every negative result shows a warning |
| Months | Explicit selection required | A window must start in a selected month but may end in a later month; clip partly elapsed months to future local start dates and state that adjustment |
| Preferred trip length | Inclusive consecutive local calendar days, with a strong preference and soft tolerance | Count weekends and observed holidays at either edge; return slightly shorter or longer options only when exact matches are weak, and explain the relaxation |
| Country calendar | One calendar per search | Use a locale default and permit an explicit override |
| Weekend pattern | Locale default with override | Use the user local calendar and time; no cross time zone logic |
| Leave type | Vacation only | No personal, sick, or half day leave |
| Travel reason | Optional | May be collected, but does not drive destination logic in phase 0 |

## Recommendation behavior

- Generate date windows deterministically from structured constraints. The language model must not calculate or rank windows.
- Favor vacation efficiency first, then total consecutive days away. Treat the preferred length as relatively strict.
- Return a normalized score from 0 to 100. Do not expose internal weights in phase 0.
- Explain why each option was selected. When scores are close, state the deciding trade off instead of implying certainty.
- Using the full remaining balance is neutral in scoring but must produce a visible warning.
- A zero-PTO window remains eligible when it meets the same length preference or tolerance as other windows. Its efficiency feature is finite and handled without division by zero; short free weekends must not crowd out more useful breaks.
- A configurable generation cap protects performance before ranking. If the cap is reached before candidate enumeration is complete, return no ranked recommendations and a clear coded message asking the user to narrow the search; never present a partial set as the best options.
- Favor variety. Merge nearly identical windows unless each exposes a meaningful trade off; in that case keep both and explain the difference.
- Impossible constraints return zero results and a clear message rather than a server error.
- The holiday calendar provider supplies effective observed days. Phase 0 does not implement country specific observed holiday rules itself.

## Result contract

| **Field** | **Meaning** |
| --- | --- |
| rank | One based display order after deterministic scoring and diversity selection |
| start_date and end_date | Inclusive local dates for the vacation window |
| total_days | Inclusive consecutive local calendar days from start_date through end_date, including nonworking days at either edge |
| vacation_days_used | Only working days in the window, after the effective working-week override and observed holidays are applied |
| remaining_balance | Balance after the window, including an allowed negative balance if configured |
| score | Normalized integer from 0 to 100 |
| explanation | Short text describing the main reason and material trade off |
| warnings | Structured warning codes rendered by the frontend, such as full balance used or length relaxed |

## Product requirements

| **ID** | **Requirement** |
| --- | --- |
| PR 01 | The product shall create an anonymous session without asking for an account. |
| PR 02 | The user shall choose one country calendar and one or more explicit months. |
| PR 03 | The product shall support whole vacation days only and use local dates. |
| PR 04 | The engine shall generate windows deterministically and rank them without an LLM. |
| PR 05 | The default response shall contain at most five recommendations, subject to configuration. |
| PR 06 | Every recommendation shall include a score and concise explanation. |
| PR 07 | The product shall retain session inputs and persist each search with its input and output snapshot. |
| PR 08 | The frontend shall decide presentation; the backend shall return data and machine readable warnings only. |
| PR 09 | Changes to inputs shall require an explicit search action. |
| PR 10 | The user shall be able to submit thumbs up or thumbs down feedback on a recommendation. |
| PR 11 | The product shall return a clear zero result state for infeasible searches. |
| PR 12 | Phase 0 contracts shall permit optional destination and flight enrichment in phase 1 without replacing the core window model. |
| PR 13 | In phase 1, the product may show exceptional future vacation windows outside the explicit search criteria in a separate Opportunities worth considering section; explicit search results remain unchanged. |
| PR 14 | A phase 1 opportunity score shall deterministically rank candidates using PTO efficiency (total consecutive days off divided by vacation days consumed), total vacation length, and a smaller low-PTO-consumption factor. |
| PR 15 | Opportunity-score weights shall be configurable; initial tunable defaults are 50% efficiency, 35% total length, and 15% low PTO consumption, not scientifically proven constants. |
| PR 16 | A separately configurable opportunity threshold shall decide whether a scored candidate is exceptional enough to surface; scoring and threshold decisions shall not use an LLM or depend on a flight provider. |
| PR 17 | Every surfaced opportunity shall differ meaningfully from the current search, briefly explain its computed appeal and criteria difference, and remain eligible without destination or flight details. |
| PR 18 | Phase 0 shall default allowed negative balance to zero, accept an explicit whole-day allowance of at most five, and warn on every recommendation with a negative remaining balance. |
| PR 19 | Phase 0 shall count inclusive consecutive local dates as trip length (including nonworking days at either edge), charge PTO only for effective working days, require the start in a selected month, and permit the end in a later month. |
| PR 20 | Phase 0 shall consider zero-PTO windows that satisfy the length preference or tolerance, score them with finite efficiency handling, and prevent trivial short breaks from dominating the returned set. |
| PR 21 | Phase 0 shall return no ranked recommendations when its candidate-generation cap prevents a complete search, and shall give a clear narrow-the-search message rather than claiming partial candidates are the best. |
| PR 22 | Optional Gemini interpretation shall return editable proposed structured fields for user confirmation; only an explicit Search action shall start or rerun recommendations, and structured input shall work without Gemini. |

## Non goals

- No flight or destination recommendation in phase 0.
- No booking, payment, ticketing, or guarantee that a quoted price will remain available.
- No user accounts, long lived preference profiles, or visible search history.
- No leave accrual forecast; the balance is the current supplied value.
- No team availability, manager approval, or HR policy workflow.
- No half days, multiple leave types, mixed holiday calendars, or cross time zone calculations.
- No operational metrics endpoint for the initial POC beyond a health check and ordinary logs.

## Success and acceptance

The primary validation question is whether a user would seriously consider requesting vacation based on one of the recommendations. Product review should assess correctness of dates and charged days, clarity of explanations, usefulness of the top five, and sufficient variety. Technical acceptance requires deterministic tests for calendar and scoring behavior, typed interfaces, persisted search snapshots, and a green continuous integration run.

| **Area** | **Acceptance evidence** |
| --- | --- |
| Correctness | Golden date cases calculate workdays, holidays, weekends, and remaining balance exactly |
| Boundaries and balance | Tests cover a selected-month start with an end in the next month, nonworking days at both edges, default-zero versus explicit negative allowance up to five, and a warning on every negative remaining balance |
| Zero-PTO windows | A qualifying free break can appear without divide-by-zero; short weekends do not crowd out materially longer useful windows |
| Trust | Every returned option has a score, reason, and relevant warning |
| Usefulness | A manual review finds at least one plausible option for representative feasible cases |
| Variety | Near duplicates collapse unless a documented trade off justifies both |
| Failure handling | Invalid inputs produce coded errors; valid but infeasible searches produce an empty result with a clear explanation |
| Search completeness | A cap-hit fixture returns no ranked results and a clear narrowing instruction; it never presents a partial top five |
| Interpretation confirmation | Text interpretation populates editable proposed fields without running a search; only Search submits confirmed fields, and structured-only search works when Gemini is unavailable |

### Phase 1 proactive opportunity acceptance

This is an additive phase 1 experience, not a change to the phase 0 optimizer. A bounded future search may look beyond the user's selected months or preferred length, while still honoring the effective calendar, balance and allowed-negative policy, and future-date limits. Opportunity detection is independent of destination matching and flight availability.

| **Area** | **Acceptance evidence** |
| --- | --- |
| Separate presentation | Exceptional out-of-criteria windows appear only in Opportunities worth considering; explicit search results and ranking do not change |
| Deterministic score | Fixed inputs and policy produce the same ranking; 9 days off using 3 PTO days has raw efficiency 3.0, and a short break does not tie a materially longer one on ratio alone |
| Zero-PTO candidates | Free windows use a finite bounded efficiency feature, never an infinite ratio; length and threshold still determine whether they are exceptional |
| Configurable gate | Tests prove weight changes can change ranking, while changing only the threshold changes inclusion but not candidate scores |
| Grounded explanation | Each item names a true reason such as high PTO leverage or a long break for few PTO days and states any relevant departure from the explicit search |
| Provider independence | The same opportunities qualify with fake, unavailable, or absent flight adapters; optional travel enrichment cannot gate detection |

## Decision record and superseded assumptions

| **Decision** | **Final position** |
| --- | --- |
| Search horizon | Explicit months are required in phase 0. The earlier three month default is superseded. |
| Flights in the first release | Flights and destinations moved to phase 1. Earlier drafts that required a live flight for every recommendation are superseded for phase 0. |
| Feedback | Simple thumbs up or down is included; free text is deferred. |
| Balance enforcement | Default allowed negative balance to zero. The user may explicitly allow borrowing up to five whole days; warn when a recommendation uses all available days or leaves a negative balance. Exclude windows beyond the allowance. |
| Window measurement and selected months | Count inclusive local calendar days, including nonworking days at the edges, and charge PTO only for effective working days. Require the start date to be in a selected month; the end date may cross the month boundary. |
| Free breaks | Keep zero-PTO windows eligible under the same length filter or tolerance, with finite efficiency scoring and diversity selection that does not flood results with trivial weekends. |
| Search completeness | A capped enumeration is incomplete, so no candidates from it may be described as ranked best options; return a coded narrow-the-search outcome instead. |
| Interpretation flow | Gemini may propose editable fields, but the user must explicitly confirm and start a search; direct structured entry never depends on Gemini. |
| Persistence | Persist anonymous sessions and search snapshots for debugging and reproducibility, but do not show search history in phase 0. |
