# DESIGN.md
# Gleetch — Visual Language & UX

> Every value below is pulled directly from `src/index.css` as it actually
> exists, not aspirational. If this document and the CSS ever disagree,
> the CSS is correct and this document is stale — fix the document.

---

## Identity

Gleetch is a glitch-art tool. The UI should demonstrate what it does, not
just describe it — the interface itself carries the aesthetic, not just
the output canvas. This is the single governing design principle: **the
chrome is part of the pitch.**

The counter-principle, equally important: chaos lives in the decorative
layer, stability lives in the instrument layer. Someone using this
repeatedly to dial in precise effects needs controls that are legible and
predictable at rest. Glitch treatment is **event-driven only** — hover,
click, load, idle-pulse on a long timer — never ambient constant motion on
anything the user is actively reading or interacting with.

---

## Typography

Two typefaces, both monospace, both loaded from Google Fonts:

- **`VT323`** — display face. Used for the logo and large numeric/label
  moments (busy-state text). Chunky, retro-terminal character.
- **`Share Tech Mono`** (with `'Courier New', monospace` as fallback) —
  body face. Every control, label, and piece of body text.

No serif, no sans-serif, no third typeface. If a design need seems to call
for one, that's a signal to reconsider the design, not add a font.

Exception: `FONT SHUFFLE`'s self-previewing button (see UI / Tab
Components in APP_MAP.md) renders its own label in whatever Unicode
typeface it's demonstrating — that's the one deliberate, functional break
from the two-typeface rule, and it's earned (the button is demonstrating
exactly the thing it does).

Text effects may intentionally exceed their normal line box, but they must
remain selectable, copyable Unicode text. Overflow is an output treatment,
never an excuse to make the editor or its controls unstable.

---

## Color Palette

Background depth (darkest to lightest):

| Value | Role |
|---|---|
| `#0A0A1C` | Deepest — canvas/preview backgrounds |
| `#0E0E22`, `#14142A` | Root background, `<body>` |
| `#18183A`, `#1A1A3A`, `#1A1A40` | Sidebar / panel surfaces |
| `#1E1E40`, `#222248`, `#252550` | Borders, dividers |
| `#2A2A50`–`#2E2E58` | Header border, hover borders |

Text (dim to bright, roughly matching how "active" something is):

| Value | Role |
|---|---|
| `#3A3A70`, `#4A4A80` | Inactive labels, disabled states |
| `#5A5A90`, `#8080B0` | Secondary/muted body text |
| `#9A9AC0`, `#B0B0E0`, `#C0C0E0` | Active/readable body text |
| `#E0E0FF` | Primary text, brightest |

Accent (the only saturated colors in the palette — used deliberately
sparingly, so they carry weight when they appear):

| Value | Role |
|---|---|
| `#FF2D6B` (hot pink/red) | Primary accent — logo, active tab, primary actions |
| `#00E5FF` (cyan) | Secondary accent — hover states, "clean-tone" category |
| `#FFB800` (amber) | Tertiary accent — shuffle button, warnings |
| `#5A2A3A` | The one muted/desaturated accent, used narrowly |

**Rule:** new UI never introduces a new color outside this table without a
real reason. The palette is already expressive enough for anything this
app needs — a "new feature needs a new color" instinct is usually actually
"this feature should reuse an existing accent for a consistent meaning."

---

## Category-Coded Effect Buttons

Every effect button's hover treatment is derived from its `category` field
in the effects registry — not hand-assigned per button. This is the
clearest expression of "the chrome demonstrates the product":

| Category | Treatment | Why |
|---|---|---|
| `corruption` | Brief RGB-split flicker (~1.6s cycle, mostly still) | Same chromatic-aberration trick the logo already uses |
| `clean-tone` | Steady cyan inset border, zero motion | Deliberate contrast with corruption — "this one's the controlled version" |
| `distortion` | Slight skew on hover | Cheap, immediate, reads as "this warps things" |
| `stylize` | Cycling border hue | Playful, matches the category's artistic bent |
| `overlay` | Soft double-exposure text-shadow | Echoes blend-mode compositing |
| `typography` | Self-previews using the real effect on its own label | Free and literal — no CSS trick needed |

**When adding a new category:** it needs a matching CSS rule
(`.algo-btn.cat-<name>`) in this same block, or it silently renders with no
special treatment — not broken, just undecorated. See APP_MAP.md's UI /
Tab Components regression checklist.

---

## Motion

Two motion budgets, strictly separated:

1. **Idle/ambient** (very rare, long timers, minimal amplitude) — the
   logo's 10s idle flicker, the canvas frame's 14s idle pulse. These exist
   so the app feels quietly alive without being distracting. If you're
   tempted to make one of these more frequent or more intense, don't —
   the restraint is the point.
2. **Event-driven** (hover, click, load, busy-state) — everything else.
   Category-coded button hovers, the `ScrambleText` busy-state decode
   animation, the reroll burst.

There is no third category. Nothing animates continuously on a control
surface the user is meant to read or interact with while it's animating.

---

## Layout

- **Desktop:** sidebar (controls) + main (viewer), side-by-side, each
  scrolling independently. The effects list within the sidebar scrolls on
  its own too, separate from presets/intensity/seed, so those stay visible
  while browsing a long effect list.
- **Mobile (≤860px):** stacks vertically, sidebar first (upload/controls
  before the preview — matches an upload-first workflow), whole page
  scrolls as one natural unit rather than nested independent-scroll
  regions (which fight touch/momentum scrolling more than they help).
  Every interactive control meets a 44px minimum touch target.
- **Viewer sizing:** canvas/video output uses `width:100%; height:auto`
  (capped at 1100px wide, `max-height` as a secondary safety cap) — the
  standard responsive-replaced-element pattern. This regressed once (caps
  alone don't cause growth, only prevent overflow — see CHANGELOG.md's
  "viewer size regression" entry) and should not regress again the same
  way.
- **Format controls:** `FORMAT` row (`.fmt-row`/`.fmt-btn`) + `COVER`/`CONTAIN` toggle (`.fit-btn`) live in the Visual sidebar above presets. Custom inputs (`64–2048`) use `.fmt-input`. All follow the 44px touch target and palette.

---

## Logo & Favicon

Logo is an SVG wordmark (`src/assets/logo.svg`) — VT323-derived RGB ghost layers (#00E5FF / #FF2D6B) + slice tears on a `#0A0A1C` ground. Header renders it as `<img>` wrapped in `.logo-img` so the existing `idle`/`burst` keyframes still apply. Favicon set lives in `public/` (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192/512.png`) and is linked from `index.html` via relative `./` base. Source single master is `public/favicon.svg`; PNGs are generated from it. No `.ico` (SVG+PNG only). Never introduce a new color outside the palette for logo tweaks.

## Icons

No icon library. Never Lucide, never any icon font/SVG-sprite system.
Every "icon" in the UI is a single Unicode character (`⟳`, `⎘`, `↓`, `▶`,
`■`, `🎲`, `📷`, `🎨`, `◈`, `◎`, `✦`, `⬛`) styled with the body typeface.
This is a real constraint, not a placeholder — it keeps the whole UI
zero-asset (no icon sprite sheet, no extra font weight to load) and
consistent with the terminal/monospace identity. If a concept genuinely
has no good Unicode glyph, prefer a short text label over reaching for an
icon library.

---

## Empty / Loading / Busy States

- **Empty states** are short, in-voice sentences, not blank space —
  e.g. VideoTab's pre-upload hint, AudioTab's "UPLOAD AUDIO TO BEGIN."
  They explain what to do next, not just that nothing's there yet.
- **Busy states** use `ScrambleText` (noise characters resolving into the
  real word, e.g. "RENDERING", "PROCESSING", "EXPORTING") rather than a
  generic spinner or a plain blink — consistent with "the chrome
  demonstrates the product." A plain blink was tried first and removed
  specifically because it fought the scramble-decode effect once both
  existed on the same element (see CHANGELOG.md).
- **Success** is implicit (the result renders/downloads) rather than a
  separate toast/confirmation — deliberate, keeps the UI quiet. This is a
  judgment call, not a hard rule; revisit if user feedback says otherwise.

---

## What this document does not cover

Component-level implementation details belong in code comments and
APP_MAP.md, not here. This document is the *visual language* — colors,
type, motion rules, layout principles — not a component inventory.
