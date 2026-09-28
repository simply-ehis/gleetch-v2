# APP_MAP.md
# Gleetch — Project Change & Impact Map

> Purpose: not to explain how Gleetch works, but what breaks (or should be
> reviewed) when something changes. See AGENT.md for the governing
> constitution this map serves.

---

## Effects Engine

### Purpose
The deterministic transform pipeline: takes seeded randomness + a chain of
effect ids + intensity, produces transformed image/text/audio data or
generated CSS. This is the one system every tab ultimately calls into.

### Responsible Components
- `core/rng.js` — seeded PRNG (`prng(seed)`), noise (`fbm`, `vnoise`),
  `seedFromString` — seed space now 2^31 via `crypto.getRandomValues`
- `core/blend.js` — `lerpBuffer`/`intensityLerp` (guarantees intensity 0=int identity, 1=full)
- `core/formats.js` — editable ratios (ORIGINAL/1:1/4:3/16:9/9:16/21:9/custom up to 2048, cover/contain) + `resolveDims`
- `core/procedural.js` — infinite procedural layering (1-3 patterns, distinct families, blend modes)
- `effects/registry.js` — `ALL_EFFECTS`, `getEffectsFor`, `getEffectById`,
  `applyEffectChain`, `applyVideoEffectChain`, `buildWebCSS`,
  `randomEffectSelection` (signature chains plus category-aware variety; rerolls retain the full palette and reject only an identical chain)
- `effects/image/*.js`, `effects/text/*.js`, `effects/audio/*.js`,
  `effects/web/*.js` — the actual effect functions (this round adds `painterly.js`, `print.js`,
  `geometric2.js`, `photoTone.js`, `textile.js`, `corruption2.js`, `craft.js`, `atmosphere.js`; `text/overflow.js` adds copy-safe line-breaking and Unicode overflow text treatments)

### Depends On
Nothing internal — this is the foundation layer. External: none (pure JS).

### Used By
- Every tab component (VisualTab, TextTab, AudioTab, VideoTab, WebTab)
- `patterns/registry.js` indirectly (patterns use `core/color.js`,
  `core/rng.js` but not the effect chain itself)
- `core/recipe.js` (recipe `a` field is a list of effect ids valid against
  this registry)

### Public Interfaces
- `getEffectsFor(mediaType)` — the only thing UI components should use to
  populate an effect picker; never hardcode an effect list
- `applyEffectChain(data, ids, ctx, rng)` — image/text/audio, includes
  `mediaType` in `ctx` for collision-safe id resolution (see Notes)
- `applyVideoEffectChain(data, ids, ctx, clipSeed, frameSeed)` — video only;
  filters `realtimeSafe: false` effects automatically
- `buildWebCSS(ids, intensity, rng)` — web only, different return shape
  (`{keyframes?, animation?, rules?}` instead of transformed data)

### Configuration
None — no config files. Effect metadata (category, mediaTypes, flags) lives
inline in each effect's registry entry.

### Documentation
CONTRIBUTING.md's "Adding a new effect" section is the canonical how-to.

### Skills
None specific — plain JS, no framework needed to modify effect math itself.

### When Modified Also Review
- **Pattern Registry** if a new effect references or blends with patterns
  (only `effects/image/overlay.js` does this today)
- **Any tab component** that hardcodes a default `algos` array — those
  defaults must reference real ids in this registry, or the tab throws on
  mount
- **`effects/presets.js`** — every preset's `algos` list must contain only
  ids valid for that preset's media type (`tests/registry.test.mjs`
  enforces this, but a human should still sanity-check new presets)
- **`core/recipe.js`** — recipe encode/decode doesn't validate that `a`
  contains real ids (only that it's an array); a recipe built from a
  removed/renamed effect id will silently no-op that step, not throw

### Regression Checklist
- Every effect in `ALL_EFFECTS` still runs on boundary inputs (intensity 0
  and 1, 1×1 images, empty strings, zero-length audio) — see
  `tests/edge-cases.test.mjs`
- No duplicate `{id, mediaType}` pairs — see `tests/registry.test.mjs`
- `getEffectById(id, mediaType)` still resolves unambiguously when the same
  id exists for two media types (currently `stutter`, `noiseInject` — text
  vs audio)
- Effects tagged `stableAcrossFrames: true` still hold steady within a
  video clip and vary across clips/reroll
- Effects tagged `realtimeSafe: false` are still skipped by
  `applyVideoEffectChain` but still reachable via plain `applyEffectChain`
  (the full-quality frame capture path)

### Breaking Risk
**High.** Every tab depends on this. A signature change to any `apply*`
function requires updating every caller.

### Notes
Effect ids are only guaranteed unique **within** a media type, not
globally — `stutter` exists as both a text effect (repeats characters) and
an audio effect (repeats sample chunks). `getEffectById` and
`applyEffectChain`/`applyVideoEffectChain` all take a `mediaType` to
disambiguate. This was a real bug once (id collision resolved to whichever
effect came first in the array regardless of caller, crashing the Audio
tab) — see CHANGELOG.md's 3.0.0 entry. Never call `getEffectById(id)`
without the media type unless you're certain the id can't collide.

---

## Pattern Registry

### Purpose
120 generative patterns (draw directly to a canvas context, seeded) used
by the Visual tab's "generate" mode and by the overlay effects — now composited
via `core/procedural.js` into infinite layered compositions (quality-gated 1-3 layers).

### Responsible Components
- `patterns/<family>.js` (mathematical, geometric, natural, signal,
  generative, artistic, texture-mineral, texture-organic)
- `patterns/registry.js` — merges all families into `PATTERNS`,
  `getPatternById`

### Depends On
`core/color.js`, `core/rng.js` (`fbm`, `vnoise`)

### Used By
- VisualTab (generate mode now via `core/procedural.js` layering)
- `effects/image/overlay.js` (blends a random pattern onto real content)

### Public Interfaces
- `PATTERNS` array, each `{id, label, fn, family}`
- `fn(ctx, W, H, rng)` — every pattern's call signature, no exceptions

### Configuration
None.

### Documentation
CONTRIBUTING.md covers the collision-check requirement before adding one.

### Skills
None specific.

### When Modified Also Review
- **Effects Engine** if changing what `overlay.js` draws from
- `tests/patterns.test.mjs`'s collision check — will fail loudly on a
  duplicate id, but conceptual redundancy (two patterns that just look
  the same) is a human judgment call the test can't catch

### Regression Checklist
- `PATTERNS.length` stays in sync with what the README/tagline claims
  (this drifted out of sync twice already — see CHANGELOG.md)
- Every pattern still draws without throwing against the mock canvas
  (`tests/helpers/mock-canvas.mjs`)
- No id collisions with the effects registry either (pattern ids and
  effect ids are separate namespaces today, but a shared id would be
  confusing even if not technically broken)

### Breaking Risk
**Medium.** Contained to `patterns/` + `overlay.js` + VisualTab's generate
mode. Doesn't touch text/audio/web at all.

### Notes
`p_radar` (in `patterns/signal.js`) computes a base hue it never uses —
known, deliberately left alone. Removing that dead code would shift every
subsequent `rng()` draw in that function and change its seeded output for
existing seeds. See the ESLint warning it produces; it's suppressed by
choice, not oversight.

---

## Video Pipeline

### Purpose
Real-time canvas-based video glitching, optional independent audio-track
processing, and export (combined, video-only, audio-only, or a
full-quality single frame).

### Responsible Components
- `components/VideoTab.jsx` — orchestration, RAF loop
- `components/useVideoAudioTrack.js` — decodes the video's audio track
  independently (own AudioContext lifecycle)
- `components/useVideoExport.js` — all export paths, including the
  full-quality frame capture
- `components/VideoAudioTrackPanel.jsx` — presentational only
- `effects/video/export.js` — MediaRecorder wrapper, audio/video stream
  muxing
- `effects/audio/process-buffer.js` — shared with the Audio Pipeline

### Depends On
Effects Engine (`applyVideoEffectChain` for live/continuous,
`applyEffectChain` directly for full-quality capture), Audio Pipeline's
`processAudioBuffer`

### Used By
Nothing else — this is a leaf system.

### Public Interfaces
None exported beyond the component itself; the two hooks are only used by
VideoTab today, not designed as a general-purpose API yet.

### Configuration
None.

### Documentation
CHANGELOG.md's 3.0.0 entry explains the audio-track separation design and
the `stableAcrossFrames` mechanism this pipeline depends on.

### Skills
None specific — browser MediaRecorder/Web Audio APIs, no framework needed.

### When Modified Also Review
- **Effects Engine** — any change to `applyVideoEffectChain`'s filtering
  logic (`stableAcrossFrames`, `realtimeSafe`) directly changes what plays
  back live vs what's export-only vs what's full-quality-capture-only
- **Audio Pipeline** — `processAudioBuffer` is shared; a signature change
  breaks both AudioTab and VideoTab's audio track
- Browser compatibility — `requestVideoFrameCallback` (used with a
  `requestAnimationFrame` fallback), `canvas.captureStream`, and
  `AudioContext.createMediaStreamDestination` all have some Safari
  version-dependent quirks; changing the export pipeline should be
  spot-checked in Safari, not just Chrome

### Regression Checklist
- Video RAF loop never reads stale closures (this was a real bug once —
  see the ref-based `renderFrame` pattern and why it exists, documented
  inline in VideoTab.jsx)
- AudioContext is closed on unmount (repeated tab visits used to exhaust
  the browser's AudioContext limit — see CHANGELOG.md)
- `stableAcrossFrames` effects (`duotone`, `hueRotate`, `lensWarp`,
  `lineDistortion`, `void`, `sigil`, `wraith`) hold steady within a clip
- `realtimeSafe: false` effects (`oilPaint`, `overlay*`) never run during
  live playback or continuous export, only full-quality capture
- Object URLs (video blob, exported file blobs) are revoked, not leaked

### Breaking Risk
**Medium-High.** Genuinely hard to fully verify without a real browser +
real video files with audio — the author flagged not having test assets
for this; see `sample-assets/` for generated fixtures that at least
exercise every code path (with-audio, without-audio, combined/split
export) even without hand-verified perceptual correctness.

### Notes
This is the one area of the app the author explicitly could not
end-to-end test themselves (no local audio/video files). Treat any
video-pipeline change with extra caution until real-world testing
confirms current behavior is solid.

---

## Audio Pipeline

### Purpose
Standalone audio file upload, effect chain application, waveform preview,
playback, WAV export.

### Responsible Components
`components/AudioTab.jsx`, `effects/audio/corruption.js`,
`effects/audio/clean-tone.js`, `effects/audio/process-buffer.js`,
`core/wav-encoder.js`

### Depends On
Effects Engine (`applyEffectChain`, `mediaType: 'audio'`)

### Used By
Video Pipeline (shares `process-buffer.js` for its independent audio
track)

### Public Interfaces
`processAudioBuffer(audioCtx, audioBuffer, algos, intensity, seed, effectParams)`
— the one function both AudioTab and VideoTab call. `effectParams` added
in the params-wiring round (default `{}`, fully backward compatible);
`AudioTab.jsx` now carries `effectParams` state the same way
`VisualTab.jsx` does, and `useVideoAudioTrack.js` carries the equivalent
`audioEffectParams` for the video tab's audio track.

### Configuration
None.

### Documentation
None beyond inline comments and CHANGELOG.md's audio clean-tone parity
entry.

### Skills
None specific — Web Audio API.

### When Modified Also Review
- **Video Pipeline** if changing `process-buffer.js`'s signature
- **Effects Engine** if adding a new audio effect id — check for
  collisions with text effect ids (see Effects Engine's Notes)

### Regression Checklist
- AudioContext closed on unmount, playing audio stopped on unmount
  (same class of bug as the Video Pipeline had)
- `softCompress` still genuinely reduces dynamic range (this had a real
  gain-calculation bug once — division by envelope applied unconditionally
  even when not compressing; see `tests/audio-clean-tone.test.mjs`)
- Both `corruption` and `clean-tone` categories present (parity gap that
  was open for most of this project's history — see CHANGELOG.md)

### Breaking Risk
**Low-Medium.** Self-contained; only genuine external dependency is on
Video Pipeline via the shared buffer processor.

### Notes
See sample-assets/sample-tone.wav for a test fixture — `ECHO` and `WARM
LOWPASS` are the two easiest effects to verify audibly on a pure tone.

---

## Web/CSS Engine

### Purpose
Generates real CSS (not a screenshot/canvas trick) for glitch effects,
previewed live, exported as file / snippet / bookmarklet.

### Responsible Components
`components/WebTab.jsx`, `effects/web/glitch.js`, `effects/web/overlay.js`,
`effects/web/stylize.js`

### Depends On
Effects Engine (`buildWebCSS`)

### Used By
Nothing else — leaf system.

### Public Interfaces
None beyond the component; `buildWebCSS` is the real interface, owned by
the Effects Engine. As of the params-wiring round, `buildWebCSS` takes an
`effectParams` 4th argument (mirrors `applyEffectChain`/
`applyVideoEffectChain`) and `WebTab.jsx` carries `effectParams` state the
same way `VisualTab.jsx` does.

### Configuration
None.

### Documentation
`docs/using-the-web-tab.md` — full user-facing walkthrough, verified
against the actual UI rather than written from memory.

### Skills
None specific.

### When Modified Also Review
- **Effects Engine**'s `buildWebCSS` if adding a web effect — remember the
  composability note: two effects animating the *same* CSS property will
  have the later-selected one win where they overlap (normal CSS cascade,
  not a bug, but worth being deliberate about when picking which property
  a new effect touches)
- `docs/using-the-web-tab.md` if any button label, preset name, or export
  option changes — that doc was written by checking every label against
  the real component, and it drifting out of sync defeats its purpose

### Regression Checklist
- Bookmarklet output is still a syntactically valid `javascript:` URI
- All 4 presets still produce valid, non-empty CSS
- Import-your-own-CSS still combines correctly with generated CSS

### Breaking Risk
**Low.** Fully self-contained; nothing else in the app depends on it.

### Notes
No backend, so there is no way to load an arbitrary cross-origin URL and
inject into it directly — the bookmarklet is the actual (not a fallback)
solution, since it runs in the context of whatever page the user already
has open, sidestepping the cross-origin restriction entirely rather than
working around it insecurely.

---

## Recipe Sharing

### Purpose
Makes any tab's already-deterministic `{seed, algos, intensity, channel?, format?}`
state shareable as a compact URL, since the app's whole architecture
already guarantees that state fully determines output. Visual recipes now carry `f:{id,w,h,fit}`.

### Responsible Components
`core/recipe.js`, `core/formats.js` (format prefs + `clampDim`), `components/CopyRecipeButton.jsx`

### Depends On
Nothing (pure functions; reads/writes `window.location` and
`navigator.clipboard`)

### Used By
Every tab (each renders one `<CopyRecipeButton>`), `gleetch.jsx` (reads an
incoming recipe on mount, routes it to the right tab)

### Public Interfaces
`encodeRecipe`, `decodeRecipe`, `getRecipeFromURL`, `buildRecipeURL`,
`clearRecipeFromURL`

### Configuration
None.

### Documentation
Inline comments in `core/recipe.js` cover the design rationale (terse JSON
+ URL-safe base64, not a custom binary format).

### Skills
None specific.

### When Modified Also Review
- **Every tab component** — each one reads `initialRecipe?.a`,
  `initialRecipe?.i`, (VisualTab also `.c`) as its `useState` initial
  value. A recipe shape change means updating every tab's read site, not
  just the encoder.
- **`gleetch.jsx`** — owns routing an incoming recipe's `t` field to the
  right tab and seeding shared `seed` state from `s`

### Regression Checklist
- `decodeRecipe` never throws on malformed input — always returns `null`
  (verified in `tests/recipe-and-video-quality.test.mjs`)
- Encoded output stays URL-safe (no `+`, `/`, `=`)
- Round-trip is exact (encode then decode reproduces the original object)

### Breaking Risk
**Low.** New system, narrow surface area, fails safe by design.

### Notes
Deliberately does not attempt to encode uploaded content (images, audio,
video files) — only the effect "recipe" applied to whatever the recipient
loads themselves. That's the correct scope: the recipe is the reproducible
part; the source media never was.

---

## UI / Tab Components

### Purpose
Presentation layer — one component per tab, shared building blocks
(`AlgoPanel`, `PresetPanel`, `UploadZone`, `ShuffleButton`, `ScrambleText`,
`ActiveChainList`, `CopyRecipeButton`).

### Responsible Components
`components/*.jsx`

### Depends On
Effects Engine (via `getEffectsFor`, `getEffectById` for display),
Recipe Sharing, `src/index.css`

### Used By
`gleetch.jsx`

### Public Interfaces
None — these are leaf UI components, not consumed outside `components/`.

### Configuration
`src/index.css` — category-coded hover treatments read the effect's
`category` field directly, so a new category with no matching CSS rule
falls back to no special treatment (not broken, just undecorated).

### Documentation
CHANGELOG.md's UI-glitch-treatment entry explains the category-coding
design (event-driven only, never ambient, so controls stay legible at
rest — a deliberate accessibility/usability choice, not an oversight).

### Skills
None specific — plain CSS, no framework.

### When Modified Also Review
- **`src/index.css`**'s mobile breakpoint (860px) — any new interactive
  element needs a touch-target check (44px minimum) added there
- **Effects Engine** if a component assumes a specific effect shape that
  changes

### Regression Checklist
- Every category in the registry has a matching CSS treatment (no
  orphans) — was manually verified once; worth re-checking after adding
  a category
- Mobile layout still stacks correctly, touch targets still ≥44px
- `AlgoPanel`'s typography self-preview (`FONT SHUFFLE` rendering its own
  button label) stays deterministic, not re-shuffling every render

### Breaking Risk
**Medium.** Wide surface area (every tab), but mostly presentational —
logic bugs here tend to be visible immediately, not silent.

### Notes
`ActiveChainList` and `CopyRecipeButton` are generic across all 5 tabs by
design — never fork them per-tab; if a tab needs different behavior,
that's a sign the shared component's contract needs to grow, not that the
tab should reimplement it locally.

---

## App Shell / Routing

### Purpose
Tab routing, shared `seed`/`reroll` state, global paste/keyboard handling,
incoming-recipe routing on load.

### Responsible Components
`gleetch.jsx`

### Depends On
Every tab component, Recipe Sharing, `core/canvas-utils.js` (paste
handler)

### Used By
`main.jsx` (mount point)

### Public Interfaces
None — this is the app's root component.

### Configuration
None.

### Documentation
None dedicated; the component is short and mostly self-explanatory.

### Skills
None specific.

### When Modified Also Review
- **Every tab** if changing what props they receive (`seed`, `onReroll`,
  `initialRecipe`, and VisualTab's extra `mode`/`uploadedImg` pair)
- **Recipe Sharing** if changing how an incoming recipe is parsed/routed

### Regression Checklist
- Global paste (image → Visual tab) still works from any tab
- `SPACE` reroll still ignored while focus is in a text input/textarea
- Incoming `?recipe=` URL still routes to the correct tab and seeds state
  correctly, then clears the URL param after applying

### Breaking Risk
**High.** Single point of failure for the whole app — if this breaks,
nothing renders.

### Notes
Deliberately thin. Resist the temptation to move tab-specific logic up
into this file "for convenience" — it should stay a router plus shared
seed state, nothing more.

---

# Critical Flows

## Effect Application (image/text/audio, non-video)

User picks effect(s) + intensity
↓
Tab component holds `algos[]` (order = execution order) + `intensity`
↓
`applyEffectChain(data, algos, {mediaType, ...}, prng(seed))`
↓
For each id: `getEffectById(id, mediaType)` → `effect.fn(...)`
↓
Result rendered (canvas / text output / played audio)

## Video Live Playback

Video frame ready
↓
`renderFrame()` draws frame to hidden work canvas
↓
`applyVideoEffectChain` — filters `realtimeSafe: false`, applies
`stableAcrossFrames` seed logic
↓
Result drawn to visible output canvas
↓
`requestAnimationFrame` (via ref indirection) schedules next frame

## Video Full-Quality Frame Capture

User clicks "FULL QUALITY FRAME"
↓
`captureFullQualityFrame` draws current video frame to hidden work canvas
↓
`applyEffectChain` (unfiltered — includes `oilPaint`/`overlay*`)
↓
Result drawn to a **fresh offscreen canvas** (not the visible output
canvas, so the live preview is undisturbed)
↓
Downloaded as PNG

## Recipe Share → Load

User builds a chain, clicks "COPY RECIPE LINK"
↓
`buildRecipeURL({t, s, a, i, c?})` → clipboard
↓
(recipient opens the URL)
↓
`gleetch.jsx` mount: `getRecipeFromURL()` → `decodeRecipe`
↓
`setTab(recipe.t)`, `setSeed(recipe.s)`, `incomingRecipe` passed to that
tab as a prop
↓
Tab's `useState(initialRecipe?.a ?? default)` picks it up on first render
↓
URL param cleared via `clearRecipeFromURL()`

---

# Shared Dependencies

- **Effects Engine** (`effects/registry.js`) — every tab, Recipe Sharing
- **`core/rng.js`** — Effects Engine, Pattern Registry, both call `prng()`
  independently; never share a single `rng()` instance across systems
- **`effects/audio/process-buffer.js`** — Audio Pipeline and Video
  Pipeline both call `processAudioBuffer` directly

# High Impact Areas

- **Effects Engine** — touches every tab; see its "Breaking Risk: High"
- **App Shell** — single point of failure; see its "Breaking Risk: High"
- **`src/index.css`** — no dedicated system entry above since it's pure
  styling, but it's read by every UI component (category-coded treatment,
  mobile breakpoint) and has drifted/regressed silently before (the
  "viewer is smaller, not bigger" regression documented in CHANGELOG.md)
  — treat layout/sizing CSS changes with the same care as logic changes

# External Dependencies

| Dependency | Why chosen | If deprecated | Notes |
|---|---|---|---|
| React 18 + Vite | Standard, fast dev loop, zero-config-friendly | Would need a real migration, not a drop-in swap | No React 19 upgrade yet — deliberate, not stale (see `npm outdated` in CI logs) |
| Browser MediaRecorder API | Zero-dependency video export | ffmpeg.wasm considered and explicitly rejected — needs COOP/COEP hosting headers, breaks the one-command static-host deploy story | See CHANGELOG.md for the tradeoff reasoning |
| Browser Web Audio API | Zero-dependency audio decode/process/encode | No realistic alternative that stays zero-dependency | `decodeAudioData` codec support varies slightly by browser; AAC/MP4 and WAV are the safest bets (see sample-assets) |
| Node's built-in `node:test` | Zero test-framework dependency, consistent with the rest of the project's dependency stance | Jest/Vitest would work fine if ever needed | Chosen deliberately over Jest/Vitest, not for lack of awareness of them |

# Architectural Decisions

**Decision:** Effect ids are unique per-media-type, not globally.
**Reason:** Some concepts (e.g. "stutter") make sense in both text and
audio but need completely different implementations; forcing globally
unique ids would mean awkward naming (`textStutter`/`audioStutter`) for no
real benefit.
**Alternatives considered:** Globally unique ids (rejected — naming
awkwardness for no upside); a single flat namespace with a warning on
collision (rejected — silent footgun, exactly what caused the real bug
this decision now prevents).
**Trade-offs:** Every lookup must pass `mediaType`, or risk the exact
collision bug that happened once already.
**Status:** Adopted, enforced by `tests/registry.test.mjs`.

**Decision:** `realtimeSafe: false` effects are filtered from
`applyVideoEffectChain` but not removed from the video effect picker.
**Reason:** Lets the user select `oilPaint`/`overlay*` for video content
and get real value from them (via full-quality frame capture) without
either (a) silently producing a stuttering/broken live preview by running
them in real time, or (b) hiding them entirely and losing the capability.
**Alternatives considered:** ffmpeg.wasm-based full-quality continuous
video export (rejected — hosting complexity, see External Dependencies);
a hand-rolled ZIP-of-frames export (considered, not built — meaningful
CRC32/ZIP-format implementation risk for a v3 feature, deferred).
**Trade-offs:** No continuous full-quality video export exists yet — only
full-quality single frames. Honestly scoped rather than half-built.
**Status:** Adopted for the still-frame case; continuous full-quality
video export remains open (see "Still Open" below).

# Still Open

- No continuous full-quality video export (frame-sequence or ffmpeg.wasm)
  — see the Architectural Decision above
- Engine (core/patterns/effects) not yet extracted as a standalone
  package — deliberately deferred by the project owner until an actual
  plugin-host target exists, not an oversight
- Video Pipeline is the one area without real-world (human-verified)
  testing — see its Notes section
