# Vacation Window Planner — UI design system

## Direction

A calm, optimistic travel workspace. Persistent navigation connects Find dates, Compare my dates, Plan my year, and Saved options. The core task remains useful without an account or AI interpretation.

Synthesized using the ui-ux-pro-max travel/editorial design-system search and React form/accessibility guidance. The search's editorial serif/sans pairing fits this product; its scroll-storytelling and aurora suggestions do not fit an interactive planning workspace and are deliberately omitted. The lavender, ink, and plum palette is a project-specific design decision.

## Visual language

- Ink text on white cards and a pale neutral page; lavender for selection and planning context.
- Deep plum is reserved for primary actions, with white text and a darker plum hover state. Error and success notices have distinct semantic tokens.
- Editorial serif for introductory headings; system sans-serif for controls and dense information. Local font stacks avoid external font dependencies.
- Consistent outline SVG icons; a decorative vector landscape conveys time away without introducing a destination or flight-booking promise.
- Modest borders, restrained shadows, 8–24 px spacing within cards, and 24–44 px page gutters.
- Colors and palette presets live in `frontend/src/theme/config.ts`; typography and desktop layout rules live in `frontend/src/styles.css`.

## Interaction

- Primary search fields come first; personal calendar rules, minimum notice, and borrowing leave are under a native disclosure.
- Calendar disclosure summarizes active rules, notice, and any nonzero leave allowance, so hidden preferences remain visible.
- Optional AI proposes editable fields; it never submits a search. Three length shortcuts also only edit the draft.
- DOM order matches visual and keyboard order.
- Results retain explanations, warnings, score details, nearby comparisons, saves, exports, and feedback.
- Saved empty states lead back into the corresponding planner.
- Historical saves remain explicitly identified, and recalculation stays an explicit action.

## Desktop layout and accessibility

- Desktop: persistent left navigation, search form plus assistant/inspiration column.
- Desktop only, per user direction. Minimum workspace width: 1024 px. Narrow desktop windows stack planning content while retaining the sidebar. No mobile navigation or phone-specific layout.
- Minimum 44 px interactive control height, visible keyboard outlines, a skip link, native labeled inputs and disclosures.
- Form errors remain announced. Search error summaries receive focus; annual error links expand enclosing disclosures before focusing fields.
- Reduced-motion preferences remove entrance motion and transitions.
- Only a light theme is offered. No implicit dark mode.

## Scope

Frontend presentation and interactions only. API contracts, request payloads, backend code, ranking, annual allocation, saved-data schemas, and export calculations are unchanged.

## Appearance customization

The default Plum design is preserved. Palette tokens and presets live in `frontend/src/theme/config.ts`; CSS and SVG artwork consume named variables. Sidebar Appearance offers five presets, a live hue slider, browser persistence, and a reset. Semantic feedback colors stay fixed. See `frontend/src/theme/README.md` for configuration instructions.
