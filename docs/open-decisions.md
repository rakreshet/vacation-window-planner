# Product decisions to settle before the recommendation engine

The foundation intentionally does not encode these rules yet.

1. Balance overrun: define whether an allowed negative balance is required, its default, and its maximum. The conversation chose soft enforcement with a warning; the [PRD](prd.md) currently narrows that to a supplied allowance.
2. Window boundaries: define whether preferred length is calendar days, whether a window may cross selected-month boundaries, whether zero-PTO windows count, and how weekends and observed holidays at the edges are treated.
3. Search completeness: define bounded enumeration and what happens if the generation cap would omit candidates. A partial search must not silently claim to return the best windows.
4. Interpretation flow: define how the frontend receives Gemini-interpreted fields for user confirmation before a manual search.

Before a public pilot, also choose the supported-country set and holiday source, session expiry, and raw-text retention period. Phase 1 flight-provider selection can wait.
