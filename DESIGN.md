---
name: ORBIT
description: A learner's atlas for exploring how software systems work, in 3D.
colors:
  night: "#06121a"
  night-surface: "#0b1d27"
  night-raised: "#12293a"
  graticule: "#1d3a4c"
  frost: "#e8fbf6"
  haze: "#97b7b8"
  aurora-green: "#34e3b0"
  on-aurora: "#032419"
  violet: "#a78bfa"
  glacier-cyan: "#5ccfe6"
  amber: "#ffb547"
  red-giant: "#ff6b85"
  lime: "#86e07a"
  stage-night: "#05111a"
  day-sky: "#f2f8f7"
  day-surface: "#ffffff"
  day-raised: "#e6f1ef"
  day-line: "#cfe1de"
  day-ink: "#0a2530"
  day-muted: "#47656b"
  day-green: "#087a5c"
  day-violet: "#6d4fe0"
typography:
  wordmark:
    fontFamily: "Unbounded Variable, Sora Variable, sans-serif"
    fontSize: "1.08em"
    fontWeight: 600
    letterSpacing: "0.06em"
  display:
    fontFamily: "Sora Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.1rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Sora Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.85rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  panel-title:
    fontFamily: "Sora Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
  body:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  mono:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "12px"
rounded:
  chip: "999px"
  control: "8px"
  field: "12px"
  panel: "12px"
  sheet: "16px"
spacing:
  page-x: "24px"
  page-y: "24px"
  panel: "16px"
  gap: "16px"
  rail-open: "240px"
  rail-closed: "68px"
components:
  button-primary:
    backgroundColor: "{colors.aurora-green}"
    textColor: "{colors.on-aurora}"
    rounded: "{rounded.control}"
    padding: "6px 14px"
  button-primary-light:
    backgroundColor: "{colors.day-green}"
    textColor: "{colors.day-surface}"
  button-primary-disabled:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.haze}"
  button-secondary:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.frost}"
    rounded: "{rounded.control}"
    padding: "6px 14px"
  search-field:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.frost}"
    rounded: "{rounded.field}"
    padding: "12px 16px 12px 44px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.haze}"
    rounded: "{rounded.chip}"
    padding: "4px 12px"
  panel:
    backgroundColor: "{colors.night-surface}"
    rounded: "{rounded.panel}"
  nav-item-active:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.frost}"
    rounded: "{rounded.control}"
---

# Design System: ORBIT

## Overview

ORBIT is a learner's atlas of systems, lit like the northern lights over a night sky. The interface is a working app first (Operate mode): the world lends type, palette, density and one signature move, while navigation, panels, fields and buttons stay familiar web controls. The 3D Visual Learning Studio is the centre: graphite models with color-coded glowing accents on a deep night stage.

The app ships a dark theme (default when the system prefers dark) and a light theme, switched from the header and remembered per browser. The 3D stage is a planetarium window: it stays night in both themes and re-scopes the night tokens for everything drawn over it.

The signature move is the **orbit ring**, a ring with a node riding it: it is the logo, it marks the active navigation item (the node travels slowly), and it echoes the pulse ring around a selected 3D part.

## Colors

### Primary
- **Aurora green** (dark `#34e3b0`, light `#087a5c`): the single action and selection accent: primary buttons, links, focus rings, the active nav ring, selected chips, the caret, and the logo's node. Text on a filled accent uses On-aurora `#032419` in dark and white in light.

### Secondary
- **Violet** (dark `#a78bfa`, light `#6d4fe0`): the logo's planet, generated-content markers ("Designed by …"), shortcut icons.
- **Glacier cyan** (dark `#5ccfe6`, light `#0a7ea0`): data series and the private-network zone in the 3D stage.

### Neutral
- Dark: **Night** `#06121a` ground, **Night surface** `#0b1d27` panels and rail, **Night raised** `#12293a` hover and active, **Graticule** `#1d3a4c` borders. **Frost** `#e8fbf6` text, **Haze** `#97b7b8` secondary text.
- Light: **Day sky** `#f2f8f7` ground, white surfaces, **Day raised** `#e6f1ef`, **Day line** `#cfe1de`, **Day ink** `#0a2530` text, **Day muted** `#47656b` secondary text.
- **Stage night** `#05111a`: the 3D stage in both themes.

### Status
- **Amber** warnings (dark `#ffb547`, light `#b45309`), **Red giant** errors (`#ff6b85` / `#cc2348`), **Lime** success and "model connected" (`#86e07a` / `#2f7d32`).

### Named Rules
- **One aurora.** Aurora green marks what you can act on or what is selected; never decoration.
- **Color encodes kind.** A 3D part's color is the same on its model, its label bubble, its parts-grid number and its explanation header. Number badges always use dark ink on the part color, in both themes.
- **The stage is always night.** Anything placed over the 3D stage uses the night tokens, whatever the app theme.

## Typography

Unbounded (wide, rounded geometric, self-hosted) is reserved for the ORBIT wordmark, echoing the round mark. Sora carries page titles, panel titles and headings. Figtree carries running text and controls at 15px / 1.55. JetBrains Mono is only for code, API paths and step numbers.

### Hierarchy
- Wordmark: Unbounded 600, +0.06em tracking.
- Display (Home question): Sora 2.1rem / 600 / -0.03em. Page title: 1.85rem / 600 / -0.025em with a 0.95rem muted description. Panel title: 0.9rem / 600.
- Body 15px Figtree; captions and chips 12px; 3D labels 12px / 600.

### Named Rules
- Heading base styles live in the base layer so utilities (such as the wordmark face) override them. No eyebrows or kickers above headings.

## Layout

Pages fill the available width (capped at 1720px only for very wide monitors) and never use narrow fixed-width columns; content reflows into more columns as space grows: Memory puts its form and type filters in a sticky 22rem column beside a 1-to-3 column memory grid, Home pairs the hero with "Ready to explore" and runs its panels three across, Skills and Settings lay panels out in two columns. A left navigation rail (240px) that collapses to a 68px icon rail with tooltips, remembered per browser; a slim header (workspace, model status, theme toggle, sign out); a scrolling main area with 24px padding. On Visual Learning: search first, then aligned "Built-in" and "Generate" chip rows, then a two-column body. The left column holds the 3D stage, a dense multi-column parts grid, and the requirements and request-flow panels. The right 22rem column (explanation, hand gestures) is pinned and scrolls on its own, so details stay in view while the left column scrolls. On phones the rail becomes a horizontal bar led by the mark, and columns stack.

## Elevation & Depth

Depth comes from tone steps and Graticule borders, not shadows. The only shadows are a soft accent glow under primary buttons and a diffuse shadow under the sign-in sheet. Floating chrome over the 3D stage uses translucent night chips with a light blur.

## Shapes

Chips and badges are pills; controls 8px; fields and panels 12px; the sign-in sheet 16px. The orbit ring and planet are the only circles used as ornament.

## Components

### Buttons
Primary: Aurora fill with On-aurora text (white in light) and a soft glow; disabled turns neutral rather than dimmed green. Secondary: raised fill with a border. Ghost: muted text that brightens on hover (used for the theme toggle and sign out).

### Chips
Pill outline with muted text. A selected built-in system fills with the accent at about 14%; the generated system currently shown fills with Violet at 15%.

### Cards / Containers
Panels: surface fill, border, 12px radius, header divided by a rule. Never nest panels.

### Inputs / Fields
Ground or surface fill with a border that turns accent on focus; the main search carries a leading search icon.

### Navigation
Lucide icons at 15px. Active item: raised fill, semibold label, accent icon, and the orbit ring with a travelling node. Collapsed rail: icons only, labels as tooltips and accessible names, a collapse/expand control at the bottom.

### Orbit mark (signature)
A Violet planet with a white highlight, a tilted ring drawn in two halves so it wraps around the planet (back half dim Violet, front half in the text color), and an Aurora node on the ring. Colors follow the theme; the favicon fixes them on a Night tile.

## Do's and Don'ts

### Do:
- Use the accent for exactly one job: what you can act on or what is selected.
- Keep a 3D part's color identical everywhere it appears.
- Check both themes for every new surface; keep light-mode text at 4.5:1 or better.

### Don't:
- Don't use gradient text, decorative glass, or emoji as icons in app chrome.
- Don't add a second action accent.
- Don't let the 3D stage follow the light theme.
