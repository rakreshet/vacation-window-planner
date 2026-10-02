# Annual optimizer correctness and measurement

AP 02 introduces complete annual candidate enumeration and the first exact full-mix objective. AP 03 extends the same graph with reduced mixes, exact diagnostics and diverse objectives. The approved public test seam is `plan_year`.

## Coverage and dominance argument

Each generated slot permits an inclusive length range and a finite set of start months. Enumeration visits every distinct permitted start/length pair after notice clipping and rejects only year overflow or unavailable dates. Costs come from the shared assessor. Candidates retain a bitmask of every slot they can fill; no ranked shortlist or per-slot top-N filter is used. Structurally valid over-budget candidates remain available for later diagnostics.

Locks are assessed first, charged exactly once, and prefilled in the slot mask. Every candidate is checked against every lock for overlap and both spacing conditions. The candidate graph groups remaining intervals by start date. A successor cursor is the first later start satisfying the calendar-day gap and containing at least one effective working date between breaks. The terminal cursor permits a final break ending December 31 without requiring a trailing gap.

A feasible chronological selection corresponds to a path of skip/take edges through this graph. Skip edges reach each chosen start; a take edge assigns its candidate to an unfilled compatible slot and advances to the earliest permitted successor. Thus every legal combination has a path, including combinations that an individually greedy ranking would miss. Every complete path fills each slot once, respects locks and spacing, and stays within the shared spendable budget.

At a fixed cursor, filled-slot mask and exact leave cost, future choices are identical. Retain the prefix with most days away, breaking ties with the complete ascending chronological date-pair tuple, then the slot-assignment tuple. Slot assignment never precedes a later interval date in this comparison. A dominated prefix cannot improve the final objective because future durations and costs add equally. Distinct masks and costs are not merged. Equivalent slot assignments cannot manufacture different date sets. AP 03 adds a novelty bit per earlier plan to this equality. A candidate sets that bit only if its overlap is below half of the shorter interval against every generated interval in that earlier plan. Flags combine with OR, so different candidates may satisfy different earlier plans. Locks cannot satisfy novelty. Equal flags preserve exactly the same remaining novelty obligations, making prefix dominance safe.

Candidate, newly created state, and evaluated transition counts are cumulative in one work budget. Rejected transition attempts count too. A deadline checks both search work and completed result construction. Hitting any limit discards the ranked result and reports `too_broad`, never `infeasible`. A completed search with no full-mask terminal proves infeasibility within the declared input domain.

## Independent evidence

- The documented January counterexample returns Jan 1–3 plus Jan 7–9: six days away using two leave days, rather than the individually longer Jan 20–23 that consumes the pool alone.
- A test-only exhaustive Cartesian oracle derives interval coverage, working-day cost, overlap and gaps through direct set operations. It imports no production generator, assessor, pruning or ranking helper. Forty seeded small calendars vary slot counts/lengths, holidays, weekends, unavailable dates, reserve and spacing. Their full and reduced retained sets and all three objective selections match `plan_year`. The oracle independently enumerates subsets by retained count and original slot priority, then Cartesian interval combinations; novelty uses direct set intersections.
- Literal tests cover preserved/precharged locks, zero-cost year-end breaks, inclusive notice, and every work-limit category. AP 01's accounting and conflict suite remains green.

## Initial performance baseline

Measured September 26, 2026 with local Python 3.12.13, without holiday-provider or HTTP overhead: year 2027, IL Friday/Saturday workweek with no fake-provider holidays, balance 18, reserve 3, one 7–14-day slot and two 3–5-day slots, all start months. The first full-mix solve completed in approximately 0.17 seconds: 3,930 candidate pairs, 18,753 created states, and 520,115 evaluated transitions.

This is one development measurement, not a p95 result or the AP 10 release benchmark. The three-objective production-calendar and HTTP/Docker measurements remain required. No limits were raised or approximate solver introduced to obtain this result.

## Reduced mixes and diagnostics

Only a completed full-mask search with no feasible terminal enables reductions. The reduction pass considers every nonempty reachable filled mask, ranks retained count first and original slot order second, then applies the first objective. Locks begin prefilled and cannot be removed. Later objectives use that selected retained mask. A lock-only reduction is valid; an empty plan is not.

Before reductions, a separate exact minimum-cost full-mask pass permits up to 168 leave days (six breaks of at most 28 days). A feasible terminal proves the reported minimum required budget; absence proves a combined structural constraint conflict without inventing a numeric shortfall. All passes reuse the complete candidate graph and share one cumulative work budget. Exhaustion in diagnostics or any alternative discards every partial plan.

Plan identity hashes versioned effective constraints, resolved holidays and selected accounting/date facts, excluding arbitrary slot IDs and exchangeable assignments. The discriminated result models reject contradictory fulfillment states, broken pool/running accounting and slot metadata inconsistent with the canonical original request.

## Three-objective development measurement

The same default fixture above completed all three objectives in approximately 1.28 seconds on September 26, 2026: 3,930 candidates, 114,670 created states and 3,460,238 transitions. This is one local measurement, not release p95 evidence. Defaults remain unchanged. The 250-test PostgreSQL-backed backend suite, including 30 annual behavioral tests, passed; the only warning was the existing interpretation dependency's event-loop deprecation.
