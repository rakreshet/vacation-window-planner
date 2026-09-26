# Operational decisions and future choices

Phase 0 and Phase 0.5 are delivered on `main`. The [progress tracker](progress.md) records their PRs; the [PRD](prd.md), [HLD](hld.md), and [comparison plan](phase-0.5-plan.md) define the delivered behavior.

## Settled defaults

- A capped Search returns no partial ranking. Interpretation proposes editable fields and requires an explicit Search action.
- The offline `python-holidays` adapter supports Israel (`IL`), U.S. federal holidays (`US`), and England & Wales bank holidays (`GB`, provider subdivision `ENG`). The dependency is locked; recorded date cases protect provider-data changes. See [calendar scope](runbook.md#supported-holiday-calendars).
- Anonymous sessions expire after 30 days by default. Source text older than the configured 30-day default is purged during subsequent searches; this is not a scheduled deletion job. Structured snapshots remain for reproducibility. Settings and bounds are in the [runbook](runbook.md#configuration-safeguards).
- Google/Gemini or xAI/Grok can supply optional interpretation through Pydantic AI. Search and Compare require neither provider credentials nor model calls.
- Ruff, mypy, ESLint, Prettier, TypeScript, and the production build are part of CI. Desktop is the supported UI surface; mobile certification is deferred.

## Future choices

- Choose a live flight provider and its cost/cache policy for Phase 1; travel integration and broad proactive opportunities remain planned.
- Before an external pilot, review retention settings, access controls, and request-rate limits for that deployment.
- Additional holiday regions and mobile support need explicit scope and acceptance checks. Current `GB` sessions must continue to mean England & Wales.
