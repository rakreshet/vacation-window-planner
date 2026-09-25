# Remaining operational choices

The core Phase 0 behavior choices are now specified in the [PRD](prd.md), [HLD](hld.md), and [implementation task plan](implementation-plan.md). A capped search returns no partial ranking, and text interpretation returns editable fields for explicit confirmation before search.

The Phase 0 calendar source is the offline `python-holidays` library, initially with Israel (`IL`) as the only production-supported country. Its version is locked with the backend dependencies and recorded date cases protect provider-data changes.

Before a public pilot, set session expiry and raw-text retention. Phase 1 flight-provider selection can wait.
