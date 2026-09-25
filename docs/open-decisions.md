# Remaining product decisions before the recommendation engine

The foundation intentionally does not encode these remaining rules yet. Balance allowance, vacation-window length and boundaries, and zero-PTO eligibility are now specified in the [PRD](prd.md), [HLD](hld.md), and [implementation task plan](implementation-plan.md).

1. Search completeness: define bounded enumeration and what happens if the generation cap would omit candidates. A partial search must not silently claim to return the best windows.
2. Interpretation flow: define how the frontend receives Gemini-interpreted fields for user confirmation before a manual search.

Before a public pilot, also choose the supported-country set and holiday source, session expiry, and raw-text retention period. Phase 1 flight-provider selection can wait.
