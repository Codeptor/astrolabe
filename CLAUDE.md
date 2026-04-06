# Astrolabe

Interactive Pioneer-plaque-style pulsar map generator.

## Commands

```bash
pnpm dev                # dev server (turbopack)
pnpm build              # production build
pnpm test               # run tests (vitest)
pnpm update-catalogue   # re-download ATNF catalogue and regenerate pulsars.json
```

## Architecture

Single-page Next.js App Router app. All computation client-side.

- `lib/coordinates.ts` — galactic coordinate math (RA/Dec <-> galactic <-> Cartesian)
- `lib/binary-encoding.ts` — pulsar period -> binary tick marks (hydrogen spin-flip units)
- `lib/pulsar-selection.ts` — greedy selection of 14 best pulsars for triangulation
- `components/plaque.tsx` — SVG renderer for the pulsar map
- `scripts/process-catalogue.ts` — ATNF tarball -> pulsars.json

## Data

- `public/data/pulsars.json` — processed from ATNF Pulsar Catalogue v2.7.0 (3,924 pulsars)
- `public/data/stars.json` — curated list of 29 notable stars for the picker
- Source: https://www.atnf.csiro.au/research/pulsar/psrcat/

## Fonts

- Tronica Mono (monospace body)
- Nippo (display headings)

## Stack

- Next.js 16 (App Router), React 19, Turbopack
- Tailwind CSS v4, next-themes
- vitest for testing
- pnpm
