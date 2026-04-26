# Astrolabe QOL: Export Presets, Mobile Controls, Reading Mode

## Goal

Improve Astrolabe's day-to-day usability without changing plaque math, pulsar selection, catalogue data, or route structure. This pass focuses on three user-facing quality-of-life areas:

- richer export presets,
- a usable mobile controls surface,
- an in-place reading mode that explains the current plaque.

## Non-Goals

- No changes to `computePlaqueData`, coordinate transforms, binary encoding, or pulsar selection.
- No rewrite of the desktop interface.
- No new server routes.
- No dependency on remote assets or services beyond the existing catalogue and SIMBAD lookup.

## Current State

The main app is a single React island in `src/components/App.tsx`. The plaque is rendered by `src/components/plaque.tsx`, exports are handled by `src/components/export-button.tsx`, and onboarding/tour behavior exists in `src/components/onboarding.tsx`, `src/components/tour-overlay.tsx`, and `src/lib/tour.ts`.

Export is currently three small buttons: SVG, PNG, and print-ready SVG. Mobile inherits the dense desktop header. The guided tour changes observer presets, while onboarding explains basics only once.

## Design

### 1. Export Presets

Replace the inline `svg`, `png`, and `print` buttons with a single `export` trigger that opens an export modal.

The modal provides one-click presets:

- `4K wallpaper`: PNG, 3840 x 2160, current theme background, no legend.
- `social square`: PNG, 2160 x 2160, current theme background, compact legend.
- `print SVG`: SVG, 16:9 canvas, current theme background, full legend.
- `clean SVG`: SVG, 16:9 canvas, current theme background, no legend.
- `transparent SVG`: SVG, 16:9 canvas, transparent background, no legend.

The modal also exposes compact options for users who want to adjust the selected preset before exporting:

- format: PNG or SVG,
- canvas: 16:9 or square,
- background: theme or transparent,
- legend: none, compact, or full,
- scale: 1x or 2x for PNG.

The default action for each preset should still be one click. Advanced options should not turn export into a multi-step flow.

### 2. Mobile Controls

Keep the current desktop header and shortcut surface. On small screens, reduce the always-visible chrome to:

- app name,
- selected observer/search,
- `random`,
- `export`,
- `controls`.

The `controls` button opens a bottom sheet with the existing actions grouped by workflow:

- view: 1972 mode, rings, algorithm, theme,
- selection: custom coordinates, presets, saved views,
- count/time: pulsar count and time-lapse controls,
- share/help: share, compare, tour, about.

The bottom sheet should close on Escape, outside click, and after route-changing links. It should use the existing app state and callbacks; it should not duplicate state parsing or introduce a second source of truth.

Footer behavior stays simple on mobile:

- keep the pulsar readout visible when a pulsar is active,
- keep zoom controls only if they fit without crowding,
- hide dense shortcut hints.

### 3. Reading Mode

Add a reading mode overlay that teaches the current plaque without changing observers. This is separate from the existing tour, which remains a curated observer tour.

Reading mode steps:

1. observer dot,
2. galactic-center reference line,
3. pulsar line direction,
4. line length as distance,
5. binary tick marks as period encoding,
6. selected-set stats, especially PDOP.

Implementation should use a small `READING_STEPS` config and `readingStep` state in `App.tsx`. The overlay should render a compact card with previous, next, finish, and close controls.

The plaque renderer should expose stable target markers for highlightable elements. For the first pass, this can be done with data attributes or CSS classes on existing SVG groups. The overlay can highlight by applying a reading-mode class to the plaque and emphasizing the relevant target type. It should avoid brittle pixel-coordinate overlays.

## Component Changes

- `src/components/export-button.tsx`
  - Keep the exported `ExportButton` API, but change its UI from three inline buttons to one trigger plus an internal modal.
  - Generalize export SVG construction to support canvas shape, legend style, background mode, output format, and scale.

- `src/components/App.tsx`
  - Replace desktop inline export buttons with the new export trigger.
  - Add mobile controls state and bottom sheet.
  - Add reading mode state and trigger.
  - Wire reading mode state into `Plaque`.

- `src/components/plaque.tsx`
  - Add stable marker attributes/classes to observer, GC line, representative pulsar line, distance geometry, and binary ticks.
  - Add an optional `readingTarget` prop or class hook for highlighting.

- New components:
  - `src/components/mobile-controls.tsx` for the bottom sheet.
  - `src/components/reading-mode.tsx` for the reading card.

## Data Flow

All controls continue to mutate the existing `AppState` through `setAppState`. URL serialization remains in `src/lib/state.ts` and should not change unless a new reading-mode URL state is explicitly required. Reading mode is transient UI state and is not serialized.

Export reads the current live SVG via `svgRef`, as it does today, so output remains tied to the actual rendered plaque.

## Error Handling

Export failures should surface through the existing toast system:

- missing SVG ref: no-op with `export unavailable`,
- image load/canvas failure: `export failed`,
- clipboard or download actions: existing success/failure toast pattern.

Mobile and reading overlays should close cleanly with Escape and not trap users behind nested overlays.

## Testing

Unit tests should cover any new pure export option mapping helpers if introduced. Existing lib tests should continue to pass.

Manual verification:

- `pnpm test`,
- `pnpm build`,
- desktop viewport: export modal opens, all presets download,
- mobile viewport: controls sheet opens, controls mutate the existing plaque state,
- reading mode: steps advance/back/close and highlights match the visible plaque elements.

## Commit Plan

Use small commits:

1. export preset modal,
2. mobile controls sheet,
3. reading mode overlay and SVG highlights.
