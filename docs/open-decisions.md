# Operational decisions and future choices

Phase 0, Phase 0.5, Phase 0.75, and annual planning are delivered on `main` through [#72](https://github.com/rakreshet/vacation-window-planner/pull/72). The [progress tracker](progress.md) records their PRs; the [PRD](prd.md), [HLD](hld.md), and phase plans define the behavior, subject to the scope decisions below.

## Settled defaults

- A capped Search returns no partial ranking. Interpretation proposes editable fields and requires an explicit Search action.
- The offline `python-holidays` adapter supports Israel (`IL`), U.S. federal holidays (`US`), and England & Wales bank holidays (`GB`, provider subdivision `ENG`). The dependency is locked; recorded date cases protect provider-data changes. See [calendar scope](runbook.md#supported-holiday-calendars).
- Anonymous sessions expire after 30 days by default. Source text older than the configured 30-day default is purged during subsequent searches; this is not a scheduled deletion job. Structured snapshots remain for reproducibility. Settings and bounds are in the [runbook](runbook.md#configuration-safeguards).
- Google/Gemini or xAI/Grok can supply optional interpretation through Pydantic AI. Search and Compare require neither provider credentials nor model calls.
- Search interpretation resolves relative months from the server clock in the request's validated IANA time zone. “Next year” means local year + 1; “next April” means the first April strictly after the current month. Explicit past years are not silently rolled forward. Model output is checked and retried once if it contains a past month; the UI also rejects past proposals and past manual searches. Current-month searches remain valid and the calculation engine excludes elapsed dates.
- Ruff, mypy, ESLint, Prettier, TypeScript, and the production build are part of CI. Desktop is the supported UI surface; mobile certification is deferred.

## Future choices

- The [Phase 0.75 plan](phase-0.75-plan.md) and [UX](phase-0.75-ux.md) record delivered personal calendar controls, opportunities after explicit Search, and same-browser saved options with leave-request copying and no accounts.
- Phase 0.75 takes over proactive discovery and its base workflow from P1 09–14; Phase 1 retains the later travel-adapter independence check. Choose a live flight provider and its cost/cache policy for Phase 1. No travel provider is needed for Phase 0.75.
- Before an external pilot, review retention settings, access controls, and request-rate limits for that deployment.
- Additional holiday regions and mobile support need explicit scope and acceptance checks. Current `GB` sessions must continue to mean England & Wales.

## Calendar export canceled

On October 2, 2026, the user canceled calendar downloads and calendar-client imports. The follow-up acceptance PRs [#76](https://github.com/rakreshet/vacation-window-planner/pull/76), [#77](https://github.com/rakreshet/vacation-window-planner/pull/77), and [#78](https://github.com/rakreshet/vacation-window-planner/pull/78) were closed and their branches deleted.

PR [#79](https://github.com/rakreshet/vacation-window-planner/pull/79) removes the individual and annual calendar-download feature and updates the related docs. It is canceled rather than deferred: do not retain it as a roadmap item or acceptance requirement. Keep existing browser saves readable with their storage keys and capture identities. Leave-request previews/copying, holiday/weekend accounting, personal calendar rules, annual year views and saved plans remain supported.
