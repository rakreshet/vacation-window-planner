# Appearance

Edit `config.ts` to change the application palette. This is the single source of truth for interface and landscape colors; components and layout CSS consume named CSS variables.

- `colors`: the original Plum palette. Tokens accept `#RGB`, `#RRGGBB`, or `#RRGGBBAA`.
- `baseHue`: the reference hue for those source colors (270). Keep this unchanged when choosing a different default.
- `defaultHue`: the initial hue for browsers without a saved preference. Set it to a preset hue to change the default theme.
- `presets`: the names and hue values offered in Appearance.
- `fixedTokens`: colors that retain their original value as the hue changes, including success, error, warning, white surfaces, and the illustration's sun.

The Appearance control in the sidebar previews changes immediately. Hue rotation preserves transparency and then corrects relative luminance in linear RGB, retaining the source palette's text contrast. The original Plum values remain exact. Preferences are stored under `storageKey` in localStorage. Reset uses the configured default. Saved browser preferences take precedence over a new default; use Reset after changing configuration. Storage failures do not prevent live preview.

Theme initialization runs before React mounts to avoid a flash of the default palette. No backend settings or planning data are changed. When adding a new visual color, add a named token here and use `var(--token)` in CSS or SVG. Check contrast when changing source token lightness or saturation.
