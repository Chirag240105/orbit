# UI and UX guide

## Principles
- **Show what ORBIT will do before it does it:** proposals with diffs, consent dialogs that list files and size, step lists for agent runs.
- **Label provenance:** "Demo output, not model inference", "AI-generated: <model>", "Curated text (no model)", "Receiving (not yet validated)…", "AI draft".
- **Every screen has four states:** loading (skeleton), empty (what to do next), error (clear title, the server's message, a recovery step), success. `frontend/tests/screens.test.tsx` enforces this.
- **No dead buttons:** disabled controls say why (title text or adjacent hint).

## Design tokens (`src/styles/index.css`)
Light and dark themes (`src/styles/index.css`), switched in the header (System, Light, Dark). The choice is stored in `localStorage` (`orbit-theme`) and applied before first paint by `index.html`; System follows `prefers-color-scheme`. Accent is NVIDIA green: `#76b900` in dark, `#386200` in light (the bright green fails contrast as text on white). Primary buttons always use the bright green (`--color-brand`) with dark text (8.1:1). All text pairs meet WCAG AA (4.5:1) on bg, surface and raised in both themes, measured: dark muted 5.9–6.8, accent 7.0–8.1, danger 6.4–7.4; light muted 5.7–6.6, accent/warn/danger/ok ≥ 5.9; tinted badges ≥ 5.0 (dark) and ≥ 4.7 (light). Logo: `src/components/Logo.tsx` and `public/favicon.svg`, an original mark (a compute die with an orbit ring and satellite); it does not reuse NVIDIA's logo. Icons: `src/components/icons.tsx` (inline SVG, no icon font). The 3D viewport stays dark in both themes. Fonts: IBM Plex Sans and Mono, self-hosted through `@fontsource` (no CDN at runtime).

## Components (`src/components/`)
`Button` (primary, secondary, danger, ghost), `Panel`, `PageHeader`, `Badge`, `EmptyState`, `ErrorState` (maps error codes to titles and recovery steps via `lib/errors.ts`), `Skeleton`, `Field`, `ConfirmDialog`, `ConsentDialog`, `FilePicker`, `SkipLink`.

## Accessibility (FE-02)
- Skip link to `#main`; primary navigation is labelled and marks the current page.
- Dialogs use native `<dialog>` (focus trap, Escape), are labelled by their title and described by their body, focus Cancel first for destructive actions, and return focus to the opener.
- Focus ring on every interactive element; reduced-motion respected.
- 3D scene: every part is reachable from the Parts list by keyboard; the canvas has a text label.
- Verified in Edge: no horizontal page scroll at 360, 768 and 1280 px on all eight screens; the first Tab reaches the skip link. Not yet done: a screen-reader pass (NVDA/VoiceOver) and real phones.

## Responsive
Sidebar becomes a horizontally scrolling top bar under 768 px; two-column layouts stack; wide content (code, diffs, tables) scrolls inside its own box.
