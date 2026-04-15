# Astrolabe

Interactive Pioneer-plaque-style pulsar map generator.

## Commands

```bash
pnpm dev                # Astro dev server (vite), :4321
pnpm build              # production build (static + serverless functions)
pnpm preview            # preview the production build
pnpm test               # run tests (vitest)
pnpm update-catalogue   # re-download ATNF catalogue and regenerate pulsars.json
```

## Architecture

Single-page Astro app with one React island. All computation client-side.
Only `/api/star-resolve` and `/og.png` run server-side (Vercel functions).

- `src/pages/index.astro` — static shell, mounts `<App client:load>`
- `src/components/App.tsx` — application root (port of old `app/page.tsx`)
- `src/lib/coordinates.ts` — galactic coordinate math (RA/Dec <-> galactic <-> Cartesian)
- `src/lib/binary-encoding.ts` — pulsar period -> binary tick marks (hydrogen spin-flip units)
- `src/lib/pulsar-selection.ts` — greedy selection of 14 best pulsars for triangulation
- `src/lib/theme.ts` — vanilla theme hook (no provider)
- `src/components/plaque.tsx` — SVG renderer for the pulsar map
- `src/components/ThemeScript.astro` — inline no-flash theme loader
- `src/layouts/RootLayout.astro` — `<head>` metadata, fonts, theme script
- `src/pages/api/star-resolve.ts` — SIMBAD-backed star lookup (serverless)
- `src/pages/og.png.ts` — runtime OG image via `@vercel/og`
- `scripts/process-catalogue.ts` — ATNF tarball -> pulsars.json

## Data

- `public/data/pulsars.json` — processed from ATNF Pulsar Catalogue v2.7.0 (3,924 pulsars)
- `public/data/stars.json` — curated list of 29 notable stars for the picker
- Source: https://www.atnf.csiro.au/research/pulsar/psrcat/

## Fonts

- Tronica Mono (monospace body)
- Nippo (display headings)

## Stack

- Astro v6 (static output + Vercel adapter)
- React 19 as an island via `@astrojs/react`
- Tailwind CSS v4 via `@tailwindcss/vite`
- `@vercel/og` for OG image rendering
- vitest for testing
- pnpm

## Deploy

Vercel. `astro.config.mjs` uses `@astrojs/vercel` adapter with `output: 'static'`;
only routes with `export const prerender = false` (star-resolve, og.png) become
serverless functions. Security headers live in `vercel.json` — note `CSP: frame-ancestors *`
instead of `X-Frame-Options` so the embed-modal iframe works cross-origin.
