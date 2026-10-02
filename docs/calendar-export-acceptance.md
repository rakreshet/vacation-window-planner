# Calendar export acceptance — October 2, 2026

The Phase 0.75 and annual implementations are on `main` through [#72](https://github.com/rakreshet/vacation-window-planner/pull/72). This follow-up verifies actual browser file delivery, preserving the separate requirement to import files into real calendar clients. **Calendar-client acceptance remains conditional.**

## PR sequence

| PR | Responsibility | Base | Delivery status |
| --- | --- | --- | --- |
| [#76](https://github.com/rakreshet/vacation-window-planner/pull/76) | Individual vacation browser-download test and CI runner | `main` | In review; backend, frontend and calendar-downloads CI passed |
| [#77](https://github.com/rakreshet/vacation-window-planner/pull/77) | Selected and reduced annual-plan browser-download tests | #76 branch | In review; backend, frontend and calendar-downloads CI passed |
| [#78](https://github.com/rakreshet/vacation-window-planner/pull/78) | Acceptance evidence and remaining manual checklist | #77 branch | In review |

The branch history is linear: `6029f25` → individual-download commit `b1d037c` → annual-download commit `bff7d63`. Each PR targets its predecessor so its review diff contains one responsibility. No application behavior change was necessary.

## Verified browser delivery

Local runtime: macOS 26.6 arm64, Node.js 25.9.0, Playwright 1.63.0. The installed test engines are Chromium 153.0.8010.12 and WebKit 26.6. Tests use a production frontend build, fixed October 2, 2026 time, `Asia/Jerusalem`, isolated browser contexts and HTTP fixtures. The visible Download button creates the file; tests read the completed browser download and parse it with `ical.js`. These tests exercise browser delivery and frontend export behavior. Backend calculation correctness is covered by the existing suites.

| Browser journey | Chromium | WebKit | Independent expectations |
| --- | --- | --- | --- |
| Individual January 7–9, 2027 vacation | Pass | Pass | One all-day event; start January 7; exclusive end January 10; correct filename; tentative/transparent; no attendees or session token |
| Select the alternative annual plan and download | Pass | Pass | Three events: March 5–8, May 7–10 and August 13–21; exclusive ends March 9, May 11 and August 22; distinct UIDs; private budget; exact leave totals |
| Opt into annual budget disclosure and download again | Pass | Pass | Budget/reserve included only after checking the control; UIDs unchanged |
| Download a reduced annual plan | Pass | Pass | Two retained events only; omitted long break named; reduced-plan disclosure; exact three-day leave cost |

Commands run against the follow-up checkout:

```sh
npm test --prefix frontend
npm run lint --prefix frontend
npm run format:check --prefix frontend
npm run typecheck --prefix frontend
npm run test:browser --prefix frontend
```

Results: **160 Vitest tests and six browser tests pass**. ESLint, Prettier and both TypeScript configurations pass. The browser runner builds the production frontend before starting its own preview. [#76 CI](https://github.com/rakreshet/vacation-window-planner/actions/runs/37060841674) and [#77 CI](https://github.com/rakreshet/vacation-window-planner/actions/runs/37061492861) passed backend, frontend and calendar-downloads jobs. The new test files remain separate from Vitest collection. Failure traces, screenshots and downloaded-file assertions are handled by the browser runner; account access is unnecessary for CI.

These are characterization tests of working exporters. Test sensitivity was checked through temporary mutations in the isolated checkout: removing the exclusive-end increment failed the individual test with January 9 instead of January 10; truncating annual export to one event failed both annual tests with missing date intervals. Each mutation was restored and the focused tests returned to green. No mutation is included in the PRs. Standards and Spec reviews of both behavior-test PRs found no actionable findings.

## Live app and unresolved client access

The local Docker app, with real PostgreSQL and the API, generated a 2027 Israel plan using 18 available leave days, three protected days and the default three-break mix. Its selected plan contained April 15–28, May 11–15 and September 29–October 3, using 12 leave days and leaving six. This is live calculation evidence; the browser regression fixtures above use different literal dates.

The in-app browser's annual Download action still produced no download event within 15 seconds, and no matching file appeared in Downloads or the checkout. File delivery through this host remains unverified; the ordinary Chromium/WebKit test engines delivered files successfully.

Native Chrome/Apple Calendar interaction was blocked because Computer Use permissions were not granted. Opening `https://calendar.google.com/` redirected to `workspace.google.com`; automatic approval review rejected the redirected destination because it was outside the authorized domain. No redirect workaround, account change, calendar upload or invitation was performed. User input about enabling Computer Use and allowing the Calendar landing page was requested. **Google Calendar and second-client imports have not passed.**

## Remaining hands-on import checklist

Use Chrome, Safari or another ordinary desktop browser to open the local app. Use synthetic dates in disposable calendars, avoiding personal calendars and invitations.

1. In Find dates or Compare my dates, calculate and download an individual vacation. Confirm a nonempty `.ics` file appears in the browser's downloads.
2. In Plan my year, generate a plan and download its annual calendar. Confirm one file contains every selected break. Budget disclosure should be unchecked for the first export.
3. Import each file into a disposable Google Calendar and a disposable Apple Calendar or Outlook calendar. Record application/version, file, date and import outcome.
4. Check every inclusive first and last date. January 7–9 must occupy January 7, 8 and 9, excluding January 10. Check each annual break the same way. Also check a leap-day or year-boundary case with the existing parser fixtures or an equivalent manual vacation.
5. Confirm events are all-day, have readable titles/descriptions and no attendees/invitations. Check tentative/nonblocking handling where the client supports it, and confirm budget/reserve details are absent from the default annual export.
6. Import a reduced annual plan: only retained breaks should appear and descriptions should disclose omitted breaks. Repeat an unchanged export/import and record whether the client deduplicates or creates duplicates; synchronization is not promised.

Record observed results here before marking calendar-client acceptance complete. The earlier [individual acceptance record](phase-0.75-acceptance.md) and [annual acceptance record](annual-plans-acceptance.md) retain their original measurements and parser evidence.
