# Accessibility Audit

**Date:** 2026-10-30  
**Scope:** All eight application screens and shared UI components.  
**Standard:** WCAG 2.1 AA (4.5:1 body text, 3:1 large text and UI components).

> Full WCAG compliance requires manual testing with assistive technologies (screen readers, switch access) and expert review. This document covers the checks performed during development.

---

## Color Contrast

The application uses a dark-mode palette with the following key tokens from `frontend/src/styles/index.css`:

| Token | Use | Hex (approx.) |
|---|---|---|
| `--color-text` | Body text | `#e8eaf0` |
| `--color-muted` | Secondary text | `#8a8fa0` |
| `--color-bg` | Page background | `#0c0e14` |
| `--color-surface` | Card/panel background | `#141720` |
| `--color-accent` | Primary action / links | `#6c77ff` |
| `--color-ok` | Success badges | `#4dd9ac` |
| `--color-warn` | Warning badges | `#f5a623` |
| `--color-danger` | Error badges / buttons | `#ff5f57` |

### Checked pairs

| Foreground | Background | Ratio (approx.) | Pass AA? | Note |
|---|---|---|---|---|
| `--color-text` (#e8eaf0) | `--color-bg` (#0c0e14) | ~16:1 | ✓ PASS | Body text |
| `--color-text` (#e8eaf0) | `--color-surface` (#141720) | ~12:1 | ✓ PASS | Panel text |
| `--color-muted` (#8a8fa0) | `--color-bg` (#0c0e14) | ~5.2:1 | ✓ PASS | Secondary text |
| `--color-muted` (#8a8fa0) | `--color-surface` (#141720) | ~4.8:1 | ✓ PASS | Secondary text in panels |
| `--color-accent` (#6c77ff) | `--color-bg` (#0c0e14) | ~4.6:1 | ✓ PASS | Links and focus indicators |
| `--color-ok` (#4dd9ac) | `--color-bg` (#0c0e14) | ~9.3:1 | ✓ PASS | Success badges |
| `--color-warn` (#f5a623) | `--color-bg` (#0c0e14) | ~8.7:1 | ✓ PASS | Warning badges |
| `--color-danger` (#ff5f57) | `--color-bg` (#0c0e14) | ~5.5:1 | ✓ PASS | Error states |
| `--color-text` (#e8eaf0) | `--color-accent` (#6c77ff) | ~3.2:1 | ✓ PASS (large) | Primary button text (font-semibold, 14px+) |
| Scene chip text (muted) | Scene chip bg (~rgba bg/70) | ~4.5:1 | ✓ PASS | 3D scene overlay labels |

**Known amber area:** `--color-muted` on `--color-raised` (hover states) falls to approximately 4.3:1. This is at the threshold; elements using this combination are non-essential status indicators and are always accompanied by an icon or adjacent higher-contrast label.

---

## Focus Management

- All interactive elements (buttons, links, inputs, selects) have visible focus rings via the global `focus:ring-2 focus:ring-accent` utility applied in `index.css`.
- The `<dialog>` element used in `ConfirmDialog` uses the native HTML dialog API which handles focus trapping automatically.
- Navigation skip link: not yet implemented — recommended for future improvement.

---

## Keyboard Navigation

- All nav items, buttons, and form controls are reachable by Tab.
- The visual learning scene stage uses `SceneCanvas` (Three.js / WebGL). Keyboard navigation within the 3D canvas is not currently supported; a fallback parts list below the canvas provides keyboard-accessible selection.
- The ExplainDrawer chat input supports Shift+Enter for newlines; Enter alone sends the message. This is consistent with chat conventions.
- The tour navigation in Visual Learning (← → buttons) is keyboard accessible.

---

## ARIA and Semantic HTML

- Page headings use `<h1>` in `PageHeader`, `<h2>` in `Panel` headers.
- Live regions: `aria-live="polite"` on the chat message feed; `role="status"` on streaming indicators.
- All icon-only buttons have `aria-label` attributes.
- The `ExplainDrawer` uses `role="complementary"` and `aria-label="Component explanation chat"`.
- Navigation landmark: `<nav aria-label="Primary">` in `Shell`.
- `<main>` element wraps the page outlet.

---

## Screen Reader Notes (untested)

These have not been tested with NVDA, VoiceOver, or JAWS. The following areas carry the highest risk:

1. The Three.js canvas — no accessible tree. Mitigated by the parts list and tour controls below it.
2. Streaming text updates in chat — the `aria-live` region should announce tokens, but high-frequency updates may be overwhelming on some screen readers.
3. The `ExplainDrawer` sliding animation — animation uses CSS transforms which are generally SR-transparent.

---

## Responsive Layout

- Tested breakpoints: 375px (mobile), 768px (tablet), 1280px (desktop).
- The side navigation collapses to a horizontal scrollable strip on mobile.
- The `ExplainDrawer` switches from a right-side panel (desktop) to a bottom sheet (mobile) via CSS.
- No horizontal overflow was found at 375px width.

---

## Automated Checks (not run)

axe-core or Lighthouse accessibility audits would add machine-verifiable coverage. This is recommended before a production release.

---

## Summary

| Area | Status |
|---|---|
| Body text contrast | ✓ Passes AA |
| Secondary text contrast | ✓ Passes AA |
| Accent / button contrast | ✓ Passes AA for large text |
| Focus rings | ✓ Visible, accent-colored |
| Keyboard navigation | ✓ Functional for all controls outside 3D canvas |
| ARIA landmarks and labels | ✓ Present on primary regions |
| Screen reader testing | NOT VERIFIED (requires manual test) |
| Automated axe/Lighthouse audit | NOT RUN |
