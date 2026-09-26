# Desktop UI and appearance regression coverage

The redesign preserves the search, comparison, annual planning, saved snapshots, and export contracts. The desktop target is 1024px and wider. Backend behavior is unchanged.

## Public boundaries under test

| Boundary | Durable expectations | Coverage |
| --- | --- | --- |
| Rendered App | Appearance does not submit requests, mark results stale, or reset independent Search/Compare/Annual drafts | `RedesignJourney.test.tsx` |
| Rendered search | Quick lengths select editable values; existing results become stale; only explicit submission sends the new length | `RedesignJourney.test.tsx`, existing `App.test.tsx` and `ComparisonJourney.test.tsx` |
| Personal calendar disclosure | Applied rules and allowance survive closing/reopening; unfinished rule prevents search; annual validation opens the disclosure and focuses the affected field, including summary links | `RedesignJourney.test.tsx`, `AnnualAcceptance.test.tsx`, `PlanningFields.test.tsx` |
| Saved navigation | Empty-state actions open the right workspace and retain the existing draft | `RedesignJourney.test.tsx` |
| Saved presentation | Calculation timestamp matches its displayed planning timezone across midnight; renaming and snapshot actions preserve saved data | `SavedOptions.test.tsx`, existing Saved journeys |
| Appearance controls | Preset/slider persistence, reset, selected state, Escape/close focus restoration, unavailable storage remains usable | `ThemeSettings.test.tsx`, `RedesignJourney.test.tsx` |
| Theme application/storage | Malformed stored values are ignored; endpoints restore; feedback colors remain fixed; relevant text/background pairs meet 4.5:1 at every integer hue from 0 through 360 | `theme/theme.test.ts` |
| Existing product journeys | Search → compare, save/reopen/remove/undo, annual generate/recalculate, interpretation review, clipboard/calendar export | Existing frontend journey suites |

Use fixed calendar dates for new planning tests. Mock only external HTTP/storage adapters; assert rendered controls and request bodies rather than internal React state. Tests should not depend on exact decorative markup, class ordering, or whole-page snapshots.

JSDOM is useful for behavior but does not enforce native disclosure visibility or render actual layout. Disclosure tests explicitly assert `open`; visual/keyboard checks must also be performed in a browser. Tests are not a claim of complete accessibility certification.

## Regression fixes found during review

- Constant HSL lightness did not preserve text contrast in green/yellow palettes. Theme generation now preserves source relative luminance in linear RGB, while keeping the exact Plum tokens for the default.
- A historical calculation timestamp used the browser timezone beside a different planning-timezone label. The displayed timestamp now explicitly uses the saved planning timezone.

Both defects were demonstrated with failing tests before fixing them.

## Verification commands

```sh
npm test --prefix frontend
npm run lint --prefix frontend
npm run format:check --prefix frontend
npm run build --prefix frontend
# Dedicated disposable test project, not the running application:
docker compose -p vacation-ui-pr-check --env-file .env.example --profile test run --build --rm backend-test
```

Before delivering layout changes, inspect the app at 1024px and a wider desktop viewport, open Appearance, select a palette, adjust it by keyboard, reload to check persistence, reset, and verify that Escape restores focus. Exercise the search, comparison, and annual workspaces with disclosures open and closed. CI continues to run full frontend/backend suites, formatting, lint, typing, and the production build.
