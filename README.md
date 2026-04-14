# Astrolabe

Interactive Pioneer-plaque-style pulsar map generator.

Astrolabe lets you pick an observer anywhere in the galaxy, select a pulsar
set optimized for triangulation, and render the result as a clean SVG map in
the visual language of the 1972 Pioneer plaque.

## Demo

- Live site: <https://astrolabe.bhanueso.dev>
- Source: <https://github.com/codeptor/astrolabe>

## Features

- Select any observer from a curated local star catalogue.
- Resolve additional stars through CDS Sesame / SIMBAD fallback.
- Enter custom galactic or equatorial coordinates.
- Toggle between the computed map and the hand-matched 1972 plaque mode.
- Choose pulsars with GDOP, fastest, closest, longest, stable, or random
  selection strategies.
- Shift the epoch with a time slider to apply synthetic proper motion and
  pulsar spin-down.
- Export the current map as SVG, PNG, or print SVG with legend block.
- Share the exact current view through URL state or iframe embed code.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Scripts

```bash
pnpm dev               # start Next.js dev server with Turbopack
pnpm build             # production build
pnpm start             # serve production build
pnpm test              # run vitest
pnpm test:watch        # watch mode
pnpm update-catalogue  # download and reprocess the ATNF pulsar catalogue
```

## How To Use

1. Search for a star in the header, or open `coords` and enter a custom
   observer position.
2. Adjust the pulsar count and selection algorithm.
3. Use the epoch slider to move backward or forward in time.
4. Hover a pulsar line to inspect it, click to lock it, click the footer
   tooltip to copy its data.
5. Export or share the current view.

### Keyboard Shortcuts

- `/` focus star search
- `R` random curated star
- `Shift+R` random galactic point
- `K` custom coordinates
- `M` toggle 1972 mode
- `A` cycle algorithm
- `T` cycle theme
- `S` toggle audio
- `G` toggle rings
- `L` toggle pulsar list
- `[` / `]` decrease or increase pulsar count
- `,` / `.` move epoch by 10 kyr
- `<` / `>` move epoch by 1 Myr
- `0` reset epoch
- `Tab` / `Shift+Tab` cycle locked pulsars
- `?` open help
- `Esc` close panels or reset

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- `next-themes`
- Vitest
- pnpm

All plaque computation happens client-side. The only server path is the
`/api/star-resolve` route used for SIMBAD-backed star lookup.

## Architecture

### Main Files

- `app/page.tsx`: application shell, URL state sync, controls, and data loading
- `components/plaque.tsx`: SVG plaque renderer
- `lib/coordinates.ts`: galactic and Cartesian coordinate transforms
- `lib/pulsar-selection.ts`: pulsar selection strategies, including GDOP
- `lib/binary-encoding.ts`: pulsar period to binary tick encoding
- `lib/proper-motion.ts`: synthetic time-machine drift and spin evolution
- `lib/pioneer-original.ts`: fixed 1972 plaque reconstruction
- `scripts/process-catalogue.ts`: ATNF tarball to `public/data/pulsars.json`

### Data

- `public/data/pulsars.json`: 3,924 processed pulsars from ATNF v2.7.0
- `public/data/stars.json`: 97 curated stars for the picker

Source catalogue:
<https://www.atnf.csiro.au/research/pulsar/psrcat/>

## Data Pipeline

`pnpm update-catalogue` downloads the ATNF tarball, extracts `psrcat.db`,
parses pulsar periods and distance estimates, converts RA/Dec to galactic
coordinates, and writes the processed JSON used by the app.

Distance preference in the processor:

1. `DIST1`
2. `DIST_DM`
3. `PX` converted to kpc

## URL State

The app serializes shareable state into query params:

- `mode`: `1972` or computed mode
- `from`: observer (`star` or `coord:l=...,b=...,d=...`)
- `p`: locked pulsar
- `n`: pulsar count
- `rings`: rings toggle
- `theme`: active theme
- `algo`: selection algorithm
- `e`: epoch offset in years

## Verification

Current repo verification surface:

```bash
pnpm test
pnpm build
```

At the time of writing, both pass.

## Caveats

- SIMBAD fallback only returns stars with a usable parallax-derived distance.
- The time-machine motion is synthetic and deterministic, not measured proper
  motion from ATNF.
- The 1972 mode prioritizes visual fidelity to the original plaque over strict
  modern astrophysical accuracy.

## License

MIT
