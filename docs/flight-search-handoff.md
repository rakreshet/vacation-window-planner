# Google Flights handoff

Verified on 2026-10-03 on `codex/flight-search-handoff` for [PR #87](https://github.com/rakreshet/vacation-window-planner/pull/87). The handoff opens a best-effort prefilled Google Flights search; it does not retrieve flight data or change planning calculations.

## Interaction

**Find flights** is available on individual Search windows, the baseline and selected Compare window, and individual breaks in current or saved annual plans. A compact inline panel shows the selected break's dates and manually entered **From** and **To** fields. Both locations are required; cities and airport codes are accepted, with airport codes suggested when users want specific airports.

The panel has one **Search Google Flights (new tab)** action, enabled only when both trimmed locations are nonempty. The large travel-details textarea, “Vacation break” text, copy action, and bottom close button are removed. An accessible × button sits at the top-right of the panel with the name **Close flight panel**. Opening focuses the heading; × and Escape return focus to the opener.

Annual breaks place **Find flights** and **Lock dates** in one wrapping action row. Both keep their visible labels and use a small plane or lock icon; locking is the quieter secondary action. Preview year card keeps its visible label and gains an image icon. Flight, year-card, individual leave-request, annual leave-request, and Appearance panels share the same corner × control instead of footer Close buttons.

Annual results now show plan totals, a compact January–December overview, and the chronological break cards before the plan-wide save and export controls. The overview retains empty months, marks each included break's inclusive date range, and labels locked breaks. Cross-month breaks appear in both months, including February 29 in leap years. Reduced plans show only their included breaks.

The day-by-day year calendar starts collapsed behind **Show full year calendar**. Its labeled calendar/chevron toggle supports Enter and Space and retains keyboard focus. Expanding preserves the existing calendar legend, locked/charged/unavailable/past-day cues, and links to break details. Switching plans updates both views while retaining the user's expansion choice. Current and saved historical results share this interaction; neither overview nor toggle makes a backend request or changes a saved snapshot. The exported PNG still contains its complete year calendar.

The year-card image has a file toolbar with its filename, PNG badge, and circular download icon. Its tooltip appears on hover or keyboard focus; the button has an accessible name and a 44px target. During export it shows progress and prevents duplicate downloads. Privacy options, title validation, filename, PNG generation, retry/fallback link, and captured planning snapshot retain their existing behavior.

This follows [Adobe Spectrum's action-button guidance](https://spectrum.adobe.com/page/action-button/) on grouping related actions and retaining labels for less familiar actions, and [W3C's hover/focus guidance](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) on persistent, hoverable, dismissible tooltips. Escape dismisses a visible tooltip without moving focus; a subsequent Escape closes its panel and returns focus to the opener. Closing Appearance also dismisses its tooltip so the hidden native disclosure cannot intercept Escape in another preview.

Stale or pending current results disable Find flights with a visible explanation. Changing the selected plan, break, calculation, or workspace invalidates an open panel. Historical annual plans retain their visible saved name, calculation time, and timezone, and the handoff works offline. No handoff action writes saved snapshots, calls a provider, or changes leave calculations, budgets, reserves, or locks.

## URL and reliability

The client constructs an ordinary link to `https://www.google.com/travel/flights` using `URL` and `URLSearchParams`:

```text
q=Flights from {trimmed From} to {trimmed To} on {start_date} returning {end_date}
hl=en
```

The link uses `target="_blank"` and `rel="noopener noreferrer"`. User-entered punctuation and Unicode are encoded as query data, rather than extra parameters or a fragment. Local ISO date strings are passed unchanged, including the inclusive end date as the return flight's departure date. The route is never inferred from the holiday calendar country. Passenger count and cabin remain Google Flights' reviewable defaults.

This `q` format is undocumented. The author-maintained [flight-search source](https://github.com/skillhq/flight-search/blob/main/SKILL.md) provides the candidate template; actual Google Flights UI verification establishes that the tested route and dates work. Google's [developer overview](https://developers.google.com/travel/flights) describes airline/OTA partner integration and outbound booking links; no public inbound prefill contract was identified in the investigation.

Google may change or reinterpret the query, especially for ambiguous city names. The planner cannot inspect the separate Google page to guarantee that every field was applied. The panel therefore tells users to check the airports and dates and, if needed, enter them there. No guarantee of price, availability, or bookability is made. A return departure on the break's final date may arrive home later, so users must choose flights that fit their actual commitments. URL construction is kept together in the handoff component for later repair or disabling.

No scraping, encoded `tfs` dependency, flight-data API, subscription, LLM, or booking integration is introduced.

## Automated verification

The rendered flight journeys cover compact content and icon closing, required/whitespace-only locations, trimmed TLV/LAX prefill, encoded punctuation and Unicode, new-tab attributes, route edits, inclusive dates, alternate/leap/cross-month/cross-year windows, stale and pending state, navigation and selection invalidation, saved historical offline behavior, unchanged snapshots, heading/opener focus, and no extra API requests. New rendered journeys verify grouped flight/lock actions and unchanged lock selection, corner close controls, keyboard tooltip dismissal, exact PNG export, and Escape/focus restoration across year-card and leave-request previews, including after closing Appearance. Annual-calendar journeys cover the default collapsed state, all 12 compact months, locked leap-year ranges, omitted breaks, plan-selection updates, offline historical reopening, detail-link focus, and toggling without extra requests.

| Check                           | Result                                                          |
| ------------------------------- | --------------------------------------------------------------- |
| Frontend regression             | **235 passed in 33 files** on the host                           |
| Frontend lint and formatting    | Passed                                                          |
| TypeScript and production build | Passed                                                          |
| Backend                         | Unchanged in this revision; no new backend verification claimed |

## Real-browser acceptance

The existing Docker preview is `vacation-flights-preview`: [frontend](http://localhost:56173) and [API health](http://localhost:59080/health). Only its frontend was rebuilt. Verification used the real Codex in-app browser, signed out of Google, with English requested through `hl=en`. Native Chrome and mobile behavior are not claimed.

| Journey                                                                | Observed result                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compare May 1–10, 2027 with balance 10 and the default Israel calendar | Exact baseline remained May 1–10; 10 total days off, 7 leave days used, 3 remaining                                                                                                                        |
| Open Find flights                                                      | Compact dates, From/To fields, top-right ×, disabled Search; no textarea or copy action                                                                                                                    |
| Enter TLV and LAX                                                      | Search became an ordinary encoded new-tab link using exact ISO dates                                                                                                                                       |
| Click the app-generated Search Google Flights link                     | A separate Google Flights tab opened; the original planner tab retained the dates and route panel                                                                                                          |
| Google Flights airports                                                | Visible **Tel Aviv-Yafo TLV** and **Los Angeles LAX** fields                                                                                                                                               |
| Google Flights dates                                                   | Visible **Sat, May 1** and **Mon, May 10**; calendar selected **Saturday, May 1, 2027, departure date** and **Monday, May 10, 2027, return date**; Done confirmation explicitly named both full 2027 dates |
| Keyboard and icon close                                                | Escape from To and the × button both closed the panel and restored Find flights focus                                                                                                                      |
| Desktop layout                                                         | Complete compact controls inspected at **1440px** and **1024px**; document width equaled viewport width, without horizontal overflow                                                                       |

### Action-control polish acceptance

The final controls were inspected in the same Docker preview at 1440px and 1024px. Find flights and Lock dates had the same vertical position and 46px height at both widths, and document width equaled viewport width. The flight panel remained full width beneath its action row.

The annual May example used England & Wales bank holidays, Saturday/Sunday weekends, May starts, one 3–14 day break, and a budget of 5. Explicit recalculation retained **May 1–10, 2027: 10 days away, 5 leave days**. Editing the budget invalidated an open flight panel, disabled both break actions, and displayed the recalculation explanation; recalculating restored them.

Browser checks confirmed corner × controls, initial heading/text focus, tooltip focus and Escape dismissal, panel Escape/opener focus, and correct Escape behavior after closing Appearance. Clicking the download icon prepared a loaded **1200 × 1800 PNG** and displayed the download-started status and fallback link. The in-app browser did not expose a native download event, so file delivery to the operating system is not claimed by this check; the external download boundary and exact filename are covered by rendered tests.

### Compact annual overview acceptance

The final overview and break cards were inspected at 1440px and 1024px without horizontal overflow. The compact overview uses two rows of six months; in the narrower desktop result column it occupied about 192px. Break cards follow immediately, with save and export actions below them and the full calendar disclosure last.

Explicit recalculation of the budget-5 annual example again retained **May 1–10, 2027: 10 days away, 5 leave days**. The compact May marker showed **1–10**. Enter expanded the full calendar and Space collapsed it while retaining toggle focus. Its detail link opened and focused the correct charged-date section. Selecting **Different dates** changed both views to **May 8–16**, and returning to **Most days away** restored **May 1–10**. No PNG generation or planning logic was changed.

## Short manual scenario

1. Open the preview and choose **Plan my year**. Set available leave to **5**, calendar to **England & Wales**, year to **2027**, reserve to **0**, and start months to **May only**. Keep one requested break with **3–14 days away** and generate plans. For an existing example, explicitly select **Recalculate plans** after adopting budget 5.
2. On **Most days away**, confirm **May 1–10**, **10 days away**, and **5 vacation days**. Check the compact overview retains all 12 months and shows May **1–10**, followed by the break card. Confirm Find flights and Lock dates sit together in one action row. Below save/export controls, focus **Show full year calendar** and press Enter. Check the May highlight and break-detail link, then focus **Hide full year calendar** and press Space. Switch to **Different dates**, check the overview and card update together, then return to **Most days away**.
3. Open **Find flights**, enter **TLV** and **LAX**, and select **Search Google Flights (new tab)**. Check the airports and full 2027 dates on Google Flights and confirm the planner remains in its original tab.
4. Return to the planner. Close with ×, reopen, then press Escape from a location field. Both closes restore Find flights focus. Change the budget: the panel closes and both break actions disable with an explanation. Restore budget 5 and explicitly recalculate.
5. Open **Preview year card**. Confirm a corner ×, filename/PNG badge, and a circular download icon. Hover or tab to the icon for its tooltip, download, and check `vacation-year-2027.png`. Press Escape to dismiss a visible tooltip, then Escape again to close; otherwise Escape closes directly. Focus returns to Preview year card.
6. Open **Copy annual leave request** (and an individual leave preview in Find dates). Confirm the corner × replaces the footer Close button and Escape returns focus to the opener. Existing text, privacy choices, and clipboard fallback remain usable.
7. Reopen a saved annual plan and use its break's Find flights or year-card preview. Historical context remains visible, and opening these actions needs no backend request.

The preview and verified Google Flights tab are retained for review. No merge or deployment is included.
