# Astrolabe — Design Spec

> "What would your Pioneer plaque look like if you launched from Proxima Centauri?"

An interactive pulsar map generator that creates a custom Pioneer-plaque-style star map from any position in the galaxy.

## Core Concept

User selects a star (or enters galactic coordinates) → app computes direction and distance from that position to known pulsars → selects the 14 best pulsars for triangulation → renders an SVG plaque in the Pioneer/Voyager line-art style with binary-encoded period tick marks.

## Stack

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS v4
- **Fonts**: Tronica Mono (mono/body), Nippo (display/headings)
- **Rendering**: SVG (crisp at any size, exportable)
- **Computation**: Client-side (coordinate transforms, pulsar selection)
- **Data**: Static JSON processed from ATNF Pulsar Catalogue (v2.7.0, 4,351 pulsars)
- **Package manager**: pnpm
- **Deployment**: Vercel

## Data Pipeline

### Source

ATNF Pulsar Catalogue tarball: `https://www.atnf.csiro.au/research/pulsar/psrcat/downloads/psrcat_pkg.tar.gz`

### Processing Script

A Node.js script (`scripts/process-catalogue.ts`) that:

1. Downloads `psrcat_pkg.tar.gz`
2. Extracts `psrcat.db` (text format, `@---` delimited records)
3. Parses each pulsar record for: `PSRJ`, `RAJ`, `DECJ`, `P0` (or `1/F0`), `P1` (or derived from `F1`), `DIST_DM`
4. Converts RA/Dec (J2000) → galactic coordinates (l, b) using standard IAU transformation
5. Filters: must have position + period + distance
6. Outputs `public/data/pulsars.json`

### Output Format

```json
[
  {
    "name": "J0337+1715",
    "gl": 169.99,
    "gb": -30.04,
    "dist": 1.3,
    "p0": 0.002732588,
    "p1": 1.7666e-20
  }
]
```

- `gl`/`gb`: galactic longitude/latitude in degrees
- `dist`: distance in kiloparsecs (kpc)
- `p0`: barycentric period in seconds
- `p1`: period derivative (dimensionless, can be null)

Expected: ~3,800-4,000 pulsars after filtering for required fields.

### Star Picker Data

Static curated JSON (`public/data/stars.json`) of ~150-200 notable/nearby stars:

```json
[
  {
    "name": "Sol",
    "gl": 0,
    "gb": 0,
    "dist": 0,
    "aliases": ["Sun", "Earth"]
  },
  {
    "name": "Proxima Centauri",
    "gl": 313.93,
    "gb": -1.93,
    "dist": 0.00129,
    "aliases": ["Alpha Centauri C"]
  }
]
```

Curated for recognizability: well-known stars (Sirius, Betelgeuse, Vega, Polaris), nearest stars, famous exoplanet hosts (TRAPPIST-1, Kepler-22), plus galactic landmarks. Users can also enter arbitrary galactic coordinates (l, b, dist) manually.

### Refresh

Manual: run `pnpm run update-catalogue` to re-download and re-process. The ATNF catalogue updates a few times per year. No automated schedule needed.

## Coordinate Math

### Galactic Position Transform

Given an observer at position O (in galactic Cartesian: x, y, z from gl, gb, dist) and a pulsar at position P:

1. Convert both positions from spherical galactic (l, b, d) → Cartesian (x, y, z):
   - `x = d * cos(b) * cos(l)`
   - `y = d * cos(b) * sin(l)`
   - `z = d * sin(b)`

2. Compute relative vector: `V = P - O`

3. Convert V back to spherical → new (l', b', d') as seen from observer

4. The angle on the plaque is `l'` (galactic longitude from observer). The line length is proportional to `d'` (distance from observer).

### RA/Dec to Galactic Conversion

Standard IAU transformation (J2000 epoch):
- North Galactic Pole: RA = 192.85948, Dec = 27.12825
- Galactic Center: l = 0 corresponds to RA = 266.40510, Dec = -28.93617
- Position angle of NGP: 122.93192 degrees

Implemented as a pure function, no external dependencies needed.

## Pulsar Selection Algorithm

Given the observer's position, select the 14 best pulsars for triangulation:

### Scoring

Each pulsar gets a composite score:

1. **Period stability** (weight: 0.4) — lower `|P1|` is better. Millisecond pulsars with P1 < 1e-18 score highest. Pulsars without P1 get a neutral score.

2. **Distance** (weight: 0.3) — closer pulsars (as seen from observer) score higher. Log-scaled to avoid domination by the nearest few.

3. **Angular isolation** (weight: 0.3) — during greedy selection, prefer pulsars that maximize the minimum angular separation from already-selected pulsars. This ensures good geometric spread for triangulation.

### Selection Process

1. Score all pulsars by stability × distance
2. Pick the highest-scoring pulsar first
3. Iteratively pick the next pulsar that maximizes: `base_score × min_angular_separation_from_selected`
4. Stop at 14 pulsars

### Galactic Center Reference

The 15th line (longest, horizontal) always points toward the galactic center (l=0, b=0) from the observer's position. This is the reference line, not a pulsar.

## Plaque Rendering (SVG)

### Layout

- Center point: observer's position (origin)
- 14 radial lines emanating from center, one per selected pulsar
- Each line's angle = pulsar's galactic longitude as seen from observer (mapped to 360 degrees)
- Each line's length = proportional to distance (log scale, normalized so the farthest pulsar fills ~40% of the viewport radius)
- 1 reference line (horizontal, extending to the right edge) → direction to galactic center
- Optional: hydrogen atom diagram near center (two circles connected by a line, as on the original plaque)

### Binary Tick Marks

Each pulsar line has tick marks encoding the period in binary:

- Unit: hydrogen spin-flip transition period = 1 / 1,420,405,751.768 Hz ≈ 0.7040 ns
- Period in units = `P0 / 0.7040e-9`
- Convert to binary
- Tick encoding: long tick = 1, short tick = 0
- Read from center outward (MSB closest to center)

### Styling

- **Default (dark)**: thin white lines on space black — the canonical space aesthetic
- **Light mode**: thin black lines on near-white (for print/export)
- Line width: 1px
- Tick marks: perpendicular to the line, long = 6px, short = 3px
- Clean, no decorative elements — faithful to the original Pioneer aesthetic

### Interactions

- **Hover a line** → tooltip appears: pulsar name, period (ms), distance (kpc/ly), stability rating
- **Click a line** → locks the tooltip (click elsewhere to dismiss)
- **Touch**: tap to select, tap elsewhere to deselect

### Animation

When switching origin stars:
- Lines smoothly rotate and rescale to new positions (CSS transitions on SVG transform attributes)
- Duration: ~600ms, cubic-bezier easing (matching kharcha's animation curve)

## Page Layout

Single-page app, centered layout, matching kharcha's spatial feel.

### Header (fixed top)

- Left: project name "astrolabe" in Tronica Mono, small
- Right: dark/light toggle, export button

### Main Content (centered)

- **Star search**: combobox/autocomplete at top. Type a star name → filtered dropdown. Also accepts raw coordinates: "l=180 b=0 d=8.5"
- **Meta line**: below search — "14 pulsars · from Sol · 0 kpc from galactic center" in tiny mono text (like kharcha's "49 days · 4 sources · 8 models")
- **Plaque SVG**: centered, responsive (scales with viewport), square aspect ratio
- **Active pulsar details**: below plaque when a line is hovered/selected — name, period, distance, stability (like kharcha's day breakdown tooltip)

### Footer (fixed bottom)

- "data: ATNF Pulsar Catalogue v2.7.0 · 4,351 pulsars" — attribution

## Export

- **SVG**: download the plaque as a standalone SVG file (embedded styles, no external deps)
- **PNG**: render SVG to canvas, export as PNG at 2x resolution
- Filename: `astrolabe-{star-name}.svg` / `.png`

## File Structure

```
astrolabe/
├── app/
│   ├── layout.tsx          # Root layout, fonts, theme provider
│   ├── page.tsx            # Main page
│   └── globals.css         # Tailwind, font faces, theme vars
├── components/
│   ├── plaque.tsx          # SVG plaque renderer
│   ├── star-search.tsx     # Combobox star picker
│   ├── pulsar-tooltip.tsx  # Hover/click tooltip
│   ├── export-button.tsx   # SVG/PNG export
│   └── theme-toggle.tsx    # Dark/light switch
├── lib/
│   ├── coordinates.ts      # Galactic coordinate math
│   ├── pulsar-selection.ts # Scoring + greedy selection algorithm
│   ├── binary-encoding.ts  # Period → binary tick marks
│   └── types.ts            # Pulsar, Star, PlaqueConfig types
├── public/
│   ├── data/
│   │   ├── pulsars.json    # Processed ATNF catalogue
│   │   └── stars.json      # Curated star list
│   └── fonts/
│       └── TronicaMono-Regular.woff2
├── scripts/
│   └── process-catalogue.ts  # ATNF tarball → JSON
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.mjs
```

## Design Tokens

Space-themed dark-first design. Not a kharcha clone — shares the minimal/monospace DNA but with a space-black identity.

```css
:root {
  --background: oklch(0.05 0.005 260);    /* space black, faint cool undertone */
  --foreground: oklch(0.92 0 0);          /* off-white text */
  --muted: oklch(0.45 0 0);              /* dim grey for secondary text */
  --line: oklch(0.88 0 0);               /* plaque lines — bright white-ish */
  --accent: oklch(0.75 0.05 220);        /* subtle cool accent for hover/active */
  --font-mono: "Tronica Mono", ui-monospace, monospace;
  --font-display: "Nippo", system-ui, sans-serif;
  --radius: 0;
}

.light {
  --background: oklch(0.98 0 0);          /* near-white for print/export */
  --foreground: oklch(0.12 0 0);
  --muted: oklch(0.55 0 0);
  --line: oklch(0.12 0 0);
  --accent: oklch(0.45 0.08 240);
}
```

## Non-Goals (for v1)

- 3D galaxy visualization / interactive star map
- User accounts / saved plaques
- Real-time API fetching (static JSON is sufficient)
- Mobile-native app
- Sound effects / haptics (maybe v2)
- Shareable URLs with encoded position (maybe v2)
