# Phase 0 frontend design contract

This document records the product-specific interface decisions and the visual completion gate for the Phase 0 planner. It exists so a passing test suite cannot be mistaken for a finished user experience.

Phase 0 Search is delivered on `main`. This remains its visual and interaction contract; the [Phase 0.5 UX](phase-0.5-ux.md) extends it with the delivered comparison workspace.

## Design read

Vacation Window Planner is a desktop decision-support workspace for people trying to stretch a finite leave balance. Its visual language is calm, optimistic, and trustworthy: warm neutral surfaces, deep green planning cues, and a restrained coral action color. The Search interface prioritizes entering constraints, confirming them, and reviewing explainable vacation windows. Phase 0.5 adds Compare my dates and comparison from Search while keeping Search the default task.

## Information hierarchy

1. Explain the value in plain language: turn leave days into longer breaks.
2. Offer natural-language interpretation as an optional shortcut.
3. State explicitly that interpretation only proposes editable fields and never searches.
4. Present the confirmed structured constraints as the source of truth.
5. Make Search the only action that produces recommendations.
6. Rank distinct outcomes as comparable decision cards with dates, leave use, remaining balance, balance-free days, explanation, warnings, and feedback. Keep equal-value alternative dates together within one card.

## Visual system

- **Typography:** a geometric sans-serif heading role paired with a highly readable sans-serif body role. The local system-font fallbacks must remain usable if hosted fonts are unavailable.
- **Color roles:** deep forest for trust and structure, warm paper for surfaces, mint for positive context, coral for the primary action, and warm red for recoverable warnings and errors.
- **Layout:** a 1,240-pixel maximum desktop canvas, editorial hero, raised planning workspace, two-column form/guide composition, and full-width recommendation cards.
- **Spacing:** dense enough for a planning tool but never compressed; major sections use 48–86 pixels, cards 28–44 pixels, and related controls 7–24 pixels.
- **Elevation:** shadows communicate workspace and result-card hierarchy, not decoration.
- **Icons:** simple inline line icons with text labels; emoji are not interface controls.

## Interaction and content rules

- Structured search must work without interpretation-provider configuration.
- Interpret must never trigger a search and must explain that boundary beside the action.
- Weekend selection uses named days, never internal numeric codes.
- Required fields are visibly marked and retain programmatic labels.
- Busy, success, validation, service-health, empty-result, warning, and feedback states must be visible and accessible.
- A capped search shows the backend's actionable narrow-search message and never renders partial recommendation cards.
- Successful search moves keyboard focus and the viewport to the result heading.
- A result's score can be expanded to show weighted leave-efficiency, time-away, and length-fit points. Equivalent dates are disclosed within their shared result card; neither disclosure starts another search.
- Product copy uses `vacation days`, `leave`, `break`, and `window`; engine, candidate, and persistence terminology stays out of the primary interface.
- Phase 0 discusses dates only. Destinations, flights, prices, and proactive opportunities remain absent.

## Desktop scope

Phase 0 targets desktop viewports of at least 1,024 pixels. Responsive mobile composition is intentionally deferred; mobile work must be designed rather than inferred from this desktop layout.

## Completion gate for future UI work

User-facing work is complete only when all of the following are true:

- Public behavior tests cover the changed user journey and important recovery paths.
- Lint, formatting, type checking, and the production build pass.
- The real Docker application is inspected at a 1,440-pixel desktop viewport.
- Initial, validation/error, empty, populated, warning, and feedback states are reviewed as applicable.
- The full primary journey is exercised against the live backend without an interpretation-provider key.
- The final handoff includes rendered visual evidence or explicitly states which visual states were not inspected.
