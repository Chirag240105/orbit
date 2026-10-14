# UI and UX guide

## Principles
- **Show what ORBIT will do before it does it:** proposals with diffs, consent dialogs that list files and size, step lists for agent runs.
- **Label provenance:** "Demo output, not model inference", "AI-generated: <model>", "Curated text (no model)", "Receiving (not yet validated)…", "AI draft".
- **Every screen has four states:** loading (skeleton), empty (what to do next), error (clear title, the server's message, a recovery step), success. `frontend/tests/screens.test.tsx` enforces this.
- **No dead buttons:** disabled controls say why (title text or adjacent hint).

## Design tokens (`src/styles/index.css`)
Dark theme. All text pairs meet WCAG AA (4.5:1) on the backgrounds they are used on, measured: body text 12.8–15.3, muted 5.2–6.2, accent 6.0–7.1, warn 8.1–9.6, danger 5.4–6.5, ok 7.5–8.9, and badges on tinted backgrounds 4.6–6.7. `--color-danger` was lightened from `#f0706a` to `#f37c74` so danger badges pass on raised panels. Fonts: IBM Plex Sans and Mono, self-hosted through `@fontsource` (no CDN at runtime).

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
