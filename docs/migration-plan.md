# Astrolabe: Next.js → Astro Migration Plan

Target: port the Astrolabe Next 16 App Router SPA to Astro v6 while keeping
100% visual/functional parity, tests green, and deploy to Vercel.

Source of truth verified against the current Astro docs (v6, April 2026):
getting-started, integrations-guide/react, integrations-guide/vercel,
styling (Tailwind v4), endpoints, integrations-guide/sitemap,
framework-components (client directives), upgrade-to/v6.

---

## 1. Why this is a clean fit

Astrolabe is already a single-page SPA whose entire runtime is client-side:

- `app/page.tsx` is `"use client"` from the top, 1128 lines, holds all state
  in React, fetches `/data/*.json` from the browser, uses URL-as-state via
  `next/navigation`.
- The only true server surface is `app/api/star-resolve/route.ts` (SIMBAD
  proxy) and the convention files `opengraph-image.tsx`, `sitemap.ts`,
  `robots.ts`, `icon.svg`.
- No next/image, no next/font, no Server Components, no server actions,
  no middleware, no ISR — nothing that needs translation beyond syntax.

Astro is a strictly better fit: static shell + one React island + one
on-demand endpoint for `/api/star-resolve`. Zero framework overhead on the
critical path.

---

## 2. Target project skeleton

```
astrolabe/
├── astro.config.mjs              # integrations: react, vercel, sitemap
├── tsconfig.json                 # extends astro/tsconfigs/strict, jsx: react-jsx
├── vercel.json                   # security headers (replaces next.config headers())
├── package.json                  # pnpm, scripts retargeted to astro
├── vitest.config.ts              # unchanged (pure lib/ tests, no Astro pieces)
├── public/
│   ├── data/                     # pulsars.json, stars.json — unchanged
│   ├── fonts/                    # Tronica, Nippo, Asset — unchanged
│   └── icon.svg                  # moved from app/icon.svg (static asset)
├── src/
│   ├── env.d.ts                  # /// <reference types="astro/client" />
│   ├── pages/
│   │   ├── index.astro           # root page, renders <App client:only="react" />
│   │   ├── 404.astro             # replaces app/not-found.tsx
│   │   ├── og.png.ts             # dynamic OG endpoint (satori standalone)
│   │   ├── robots.txt.ts         # static endpoint, returns robots rules
│   │   └── api/
│   │       └── star-resolve.ts   # GET endpoint, prerender = false
│   ├── layouts/
│   │   └── RootLayout.astro      # <html>, metadata, ThemeScript, font links
│   ├── components/
│   │   ├── ThemeScript.astro     # inline no-flash theme script (replaces next-themes)
│   │   ├── App.tsx               # thin wrapper around the old page.tsx body
│   │   └── … (all existing components moved verbatim, .tsx stays .tsx)
│   ├── lib/                      # all existing lib/ moved verbatim
│   └── styles/
│       └── global.css            # moved from app/globals.css (unchanged)
└── scripts/
    └── process-catalogue.ts      # unchanged (tsx runner)
```

Path alias `@/*` is preserved via `tsconfig.json` `paths`, now pointing to
`./src/*`.

---

## 3. Integrations

Install via `pnpm astro add react vercel sitemap` — but pin packages first
so the interactive prompt doesn't guess versions:

```jsonc
// package.json (relevant deps only)
{
  "dependencies": {
    "astro": "^6.0.0",
    "@astrojs/react": "^4.4.0",
    "@astrojs/vercel": "^10.0.0",
    "@astrojs/sitemap": "^3.5.0",
    "@tailwindcss/vite": "^4.2.2",
    "tailwindcss": "^4.2.2",
    "@vercel/og": "^0.8.5",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "lucide-react": "^1.7.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "jsdom": "^29.0.1",
    "typescript": "^6.0.2",
    "vitest": "^4.1.2"
  }
}
```

Removed: `next`, `next-themes`, `@tailwindcss/postcss`, `postcss`
(PostCSS config and file deleted — Tailwind v4 goes through the Vite
plugin now, per current Astro styling docs).

### astro.config.mjs

```ts
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import vercel from "@astrojs/vercel"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"

const SITE = process.env.ASTRO_SITE ?? "https://astrolabe.bhanueso.dev"

export default defineConfig({
  site: SITE,
  output: "static",                    // default; /api/star-resolve opts in via prerender=false
  trailingSlash: "never",
  adapter: vercel({
    imageService: false,               // no images to optimize
    webAnalytics: { enabled: false },  // user hasn't opted in
    maxDuration: 10,                   // SIMBAD proxy is the only function
  }),
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !page.includes("/api/") && !page.endsWith("/og.png") && !page.endsWith("/robots.txt"),
      serialize(item) {
        if (item.url === `${SITE}/`) return { ...item, priority: 1, changefreq: "monthly" }
        return item
      },
      customPages: [`${SITE}/?mode=1972`],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
```

Rationale:
- `output: "static"` + per-route `prerender = false` is the v6 canonical
  way to mix static and on-demand. Using `output: "server"` would
  force every page onto a Vercel function needlessly.
- The `@astrojs/vercel` adapter is still required even in static mode so
  the one on-demand endpoint deploys as a serverless function instead of
  being prerendered at build time.
- Sitemap `filter`/`serialize`/`customPages` reproduce the current two
  entries (`/` priority 1 monthly, `/?mode=1972` priority 0.8 yearly).

---

## 4. Rendering mode & island boundaries

Astrolabe has one big interactive surface; splitting it into many islands
would be busywork that burns perf (each island = its own React root +
hydration payload). Keep it as a single island.

### Island boundary

One island, hydrated with `client:only="react"`:

```astro
---
import RootLayout from "../layouts/RootLayout.astro"
import { App } from "../components/App"
---
<RootLayout title="Astrolabe — interactive Pioneer plaque pulsar map">
  <App client:only="react" />
</RootLayout>
```

Why `client:only` and not `client:load`:
- The root component uses `useSearchParams`, `window`, `document`,
  `localStorage`, and audio context on mount. SSR would produce a shell
  that gets immediately thrown away. `client:only` skips the SSR render
  and ships the same shell placeholder the current `<Suspense fallback>`
  already shows (`<div className="h-svh" />`).
- Matches the current Next behaviour exactly (whole page is `"use client"`).

### Per-component mapping (why each stays inside the single island)

| Component | LOC | Lives in App? | Reason |
|---|---|---|---|
| `plaque.tsx` | 389 | yes | SVG renderer, needs live props from state |
| `star-search.tsx` | 297 | yes | shares `pulsars`/`stars` state, keyboard focus |
| `export-button.tsx` | 317 | yes | reads svgRef, full state for export |
| `coord-picker.tsx` | 192 | yes | writes to appState |
| `pulsar-list.tsx` | 126 | yes | hover/lock state shared |
| `pulsar-tooltip.tsx` | 123 | yes | portal following svgRef |
| `onboarding.tsx` | 123 | yes | reads app state |
| `embed-modal.tsx` | 111 | yes | reads current URL state |
| `algorithm-picker.tsx` | 84 | yes | mutates appState.algorithm |
| `theme-toggle.tsx` | 68 | yes | calls into theme system |

All ten components are tightly coupled through `appState` in `page.tsx`.
Trying to extract (say) `ThemeToggle` as its own `client:load` island
would force lifting theme state into URL params or localStorage wiring
that already exists — net negative.

The only thing extracted from the island is the **theme boot script**,
below, which runs before React hydrates to prevent FOUC.

---

## 5. Tailwind v4 integration

Current recommended path per Astro styling docs: `@tailwindcss/vite` (NOT
`@astrojs/tailwind`, which is legacy). The PostCSS path also works but
the Vite plugin is the official recommendation for v4.

Steps:

1. Delete `postcss.config.mjs` and the `@tailwindcss/postcss` dep.
2. Add `@tailwindcss/vite` to `vite.plugins` in `astro.config.mjs` (shown above).
3. Move `app/globals.css` → `src/styles/global.css` verbatim — the
   `@import "tailwindcss"` and `@theme inline` blocks are v4 syntax and
   require no changes.
4. Import it once from `RootLayout.astro`:

```astro
---
import "../styles/global.css"
---
```

The existing theme CSS (`:root/.dark/.light/.gold/.blueprint`), slider
styles, scrollbar styles, and `@font-face` declarations all carry over
unchanged.

---

## 6. Fonts

No `next/font` to replace — fonts are already self-hosted woff2/ttf in
`public/fonts/` and loaded via `@font-face` in `globals.css`. Keep as-is.

Add explicit `<link rel="preload">` hints in `RootLayout.astro` for the
two fonts above the fold (Tronica, Nippo) — this is a small perf win
that was implicit under Next's auto-preload but not under Astro:

```astro
<link rel="preload" href="/fonts/TronicaMono-Regular.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/Nippo-Variable.woff2" as="font" type="font/woff2" crossorigin />
```

Asset.ttf is only used by the OG image generator (server-side Satori),
not by the browser — no preload.

---

## 7. Theme toggle replacement (no-flash)

`next-themes` is Next-specific and relies on a React provider. Replace
with a small inline script + React hook, both reading/writing the same
`html` class.

### `src/components/ThemeScript.astro`

```astro
---
// Runs synchronously in <head> before paint — prevents theme flash.
---
<script is:inline>
  (() => {
    const key = "astrolabe-theme"
    const valid = ["dark", "light", "gold", "blueprint"]
    let t
    try { t = localStorage.getItem(key) } catch {}
    if (!valid.includes(t)) t = "dark"
    document.documentElement.classList.add(t)
    document.documentElement.style.colorScheme = t === "light" ? "light" : "dark"
  })()
</script>
```

### `src/lib/theme.ts`

Small hook `useTheme()` that mirrors `next-themes`' surface (current
string + `setTheme(next)`), reading initial value from the class on
`<html>`, writing to localStorage + class on change. Replaces the single
import `import { useTheme } from "next-themes"` in `page.tsx` with
`import { useTheme } from "@/lib/theme"`.

Keep the four themes (`dark`, `light`, `gold`, `blueprint`) as a typed
literal union in `lib/state.ts` — already is.

---

## 8. Metadata, robots, sitemap, icon, OG

| Next convention | Astro replacement |
|---|---|
| `app/layout.tsx` metadata export | `<head>` block in `src/layouts/RootLayout.astro` — plain `<meta>` tags, props-driven |
| `app/layout.tsx` viewport export | `<meta name="viewport">` + `<meta name="theme-color">` (light/dark `media`) |
| `app/sitemap.ts` | `@astrojs/sitemap` integration (see §3) |
| `app/robots.ts` | `src/pages/robots.txt.ts` static endpoint returning `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: …/sitemap-index.xml\n` |
| `app/icon.svg` | `public/icon.svg` + `<link rel="icon" type="image/svg+xml" href="/icon.svg" />` in layout |
| `app/not-found.tsx` | `src/pages/404.astro` — static page using RootLayout |
| `app/error.tsx` | not portable (Next-specific error boundary). Replace with a top-level React `ErrorBoundary` inside `App.tsx` using the same copy + `console.error` |
| `app/opengraph-image.tsx` | `src/pages/og.png.ts` dynamic endpoint using `@vercel/og` (standalone — works in Astro endpoints) |

### OG endpoint (`src/pages/og.png.ts`)

`@vercel/og` is not tied to Next. Import `ImageResponse` from
`@vercel/og`, export a GET handler, set `prerender = false` so it runs
on-demand (keeps the image fresh without rebuild), and return the same
JSX tree from the existing `opengraph-image.tsx` verbatim.

Satori requires explicit fonts — load the same woff2/ttf files from
`public/fonts/` via `fs.readFile` at request time (or bundle with
`?arraybuffer` vite import if we stay static). Opt for fs.readFile so
the file stays tiny.

Layout references `<meta property="og:image" content="/og.png" />`
explicitly (Astro doesn't auto-wire OG images the way Next's conventions
did).

---

## 9. `/api/star-resolve` port

```ts
// src/pages/api/star-resolve.ts
import type { APIRoute } from "astro"
import { resolveStar } from "@/lib/simbad"

export const prerender = false

export const GET: APIRoute = async ({ url }) => {
  const name = url.searchParams.get("name")
  if (!name) {
    return Response.json({ error: "missing name parameter" }, { status: 400 })
  }
  const result = await resolveStar(name)
  if (!result) {
    return Response.json({ error: "not found" }, { status: 404 })
  }
  return Response.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  })
}
```

Notes:
- `url.searchParams.get` replaces `NextRequest.nextUrl.searchParams.get`.
- Same cache headers, same status codes, same shape.
- `prerender = false` puts this route on a Vercel serverless function
  even though `output` is `"static"`.
- `@/lib/simbad.ts` is unchanged — it uses `fetch` which is universal.

Client code (`star-search.tsx`) calls `/api/star-resolve?name=...` —
the path stays identical, no client changes.

---

## 10. Security headers via `vercel.json`

Astro doesn't have a `headers()` equivalent to Next's config. The
canonical Vercel deployment path is `vercel.json`:

```jsonc
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()" }
      ]
    },
    {
      "source": "/fonts/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/data/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" }]
    }
  ]
}
```

Byte-for-byte the same headers the current `next.config.mjs` emits.
`poweredByHeader: false` / `compress: true` are Next-only — Vercel
strips `x-powered-by` by default and gzips automatically, so nothing to
port.

---

## 11. Vitest updates

`vitest.config.ts` only needs the `@` alias redirected:

```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: { environment: "jsdom" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
})
```

All existing tests are in `lib/__tests__/*.test.ts` and exercise pure
functions (coordinates, pulsar selection, binary encoding, simbad
response parsing, custom observer, async-latest). None touch Next APIs
— moving `lib/` → `src/lib/` keeps them green with just the alias
update. Test script stays `vitest run`.

Test list that must stay green:
- `async-latest.test.ts`
- `binary-encoding.test.ts`
- `coordinates.test.ts`
- `custom-observer.test.ts`
- `pulsar-selection.test.ts`
- `simbad.test.ts`

---

## 12. `page.tsx` → `App.tsx` translation

Mechanical, mostly search-and-replace:

- Drop `"use client"` (Astro islands are already client-only by directive).
- `import { useRouter, useSearchParams } from "next/navigation"` →
  drop entirely; replace with `new URLSearchParams(window.location.search)`
  reads and `window.history.replaceState(null, "", "?" + searchString)`
  writes. `router.replace({ search })` becomes
  `history.replaceState(null, "", "?" + buildSearchString(next))`. A
  `popstate` listener keeps state in sync on back/forward, replacing
  the `searchParams` effect.
- `import { useTheme } from "next-themes"` →
  `import { useTheme } from "@/lib/theme"` (see §7).
- Swap the outer `<Suspense fallback=…>` for a plain render — Astro's
  `client:only` handles the placeholder via an optional `fallback` slot
  (`<App client:only="react"><div slot="fallback" class="h-svh" /></App>`
  — confirmed against current framework-components docs).
- Move the ErrorBoundary (from §8) around the render root to replace
  `app/error.tsx` behaviour.

No other Next-specific imports appear in the component tree (searched
all ten components — only `page.tsx` touches `next/navigation` and
`next-themes`).

---

## 13. Scripts

```jsonc
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "start": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "update-catalogue": "tsx scripts/process-catalogue.ts",
    "astro": "astro"
  }
}
```

No turbopack flag; Astro dev uses Vite + Rolldown (v6 default) and is
plenty fast for this app.

---

## 14. Ordered migration sequence

The migrator should execute these in order. Each step is small enough
to verify (type-check + tests) before moving to the next.

1. **Scaffold branch & deps.** Create `migrate/astro` branch. Remove
   `next`, `next-themes`, `@tailwindcss/postcss`, `postcss`. Add
   `astro`, `@astrojs/react`, `@astrojs/vercel`, `@astrojs/sitemap`,
   `@tailwindcss/vite`, `@vercel/og`. Delete `next.config.mjs`,
   `next-env.d.ts`, `postcss.config.mjs`.

2. **Move `lib/` and `scripts/` verbatim.** `lib/` → `src/lib/`,
   `scripts/` stays at root. Update `vitest.config.ts` alias to
   `src`. Run `pnpm test` — all six test files must pass. (Do this
   first so the foundation is proven before touching anything Astro.)

3. **Move static assets.** `public/data/` and `public/fonts/` stay put.
   Move `app/icon.svg` → `public/icon.svg`. Move `app/globals.css` →
   `src/styles/global.css` unchanged.

4. **Write `astro.config.mjs`** per §3, including the
   `@tailwindcss/vite` plugin and the three Astro integrations.

5. **Write `src/env.d.ts`** (`/// <reference types="astro/client" />`),
   update `tsconfig.json` to `extends: "astro/tsconfigs/strict"`,
   retarget `paths` `@/*` → `./src/*`, add `jsx: "react-jsx"`.

6. **Write `src/layouts/RootLayout.astro`** with the full `<head>`
   (metadata meta tags, OG/Twitter tags, theme-color media pair,
   font preload links, icon link, `<ThemeScript />` inline). Body
   renders the default slot inside the existing className/style.

7. **Write `src/components/ThemeScript.astro`** per §7 and
   `src/lib/theme.ts` (tiny React hook that replaces `next-themes`).

8. **Create `src/pages/index.astro`.** Imports RootLayout, renders
   `<App client:only="react">` with the `h-svh` fallback slot.

9. **Move `components/`** → `src/components/` verbatim. Create
   `src/components/App.tsx` — the body of the old `app/page.tsx`
   (`PageInner`) with the three import swaps from §12. Keep the
   outer `App` export as the top-level component used by
   `index.astro`. Wrap the render in a React `ErrorBoundary`
   (§8) to replace `app/error.tsx`.

10. **Port `/api/star-resolve`** to `src/pages/api/star-resolve.ts`
    per §9 (`prerender = false`, named GET export, APIRoute type).

11. **Port metadata routes.** `src/pages/404.astro` replaces
    `not-found.tsx`; `src/pages/robots.txt.ts` returns the robots
    rules body + sitemap URL; `src/pages/og.png.ts` uses
    `@vercel/og`'s `ImageResponse` with the full existing JSX tree
    and fs-loaded fonts (Tronica, Asset). `prerender = false` on
    og.png so it regenerates on demand.

12. **Add `vercel.json`** per §10 for security + cache headers.

13. **Typecheck + test.** `pnpm astro check && pnpm test`. Fix any
    import path drift. All six vitest specs must pass.

14. **Dev-server smoke.** `pnpm dev`, open `localhost:4321`, verify:
    page loads with no theme flash, URL params round-trip, star
    search hits `/api/star-resolve`, `/og.png` renders, `/robots.txt`
    and `/sitemap-index.xml` serve, `/404` renders the custom page.

15. **Production build + parity pass.** `pnpm build && pnpm preview`.
    Compare against the live Next build by swapping the `ASTRO_SITE`
    env var. Run the verify-parity task with the dev server up.
    Deploy preview to Vercel (`vercel --prebuilt` using the
    `.vercel/output` that the adapter emits) and confirm the serverless
    function for `/api/star-resolve` shows up and the rest are static.

---

## 15. Risk notes

- `@vercel/og` standalone use in an Astro endpoint is supported but
  less-travelled than the Next convention. If Satori font loading
  misbehaves (fs access in edge), fall back to fetching the woff2 from
  the deployed URL or embed as base64. Verify in step 14.
- Astro's `client:only` does a double-render quirk with StrictMode — if
  any component depends on `useEffect` firing exactly once, revisit.
  Current code already handles StrictMode double-effects correctly
  (audio ref nulled on cleanup).
- Tailwind v4 theme CSS uses `@theme inline` + CSS variables — confirmed
  working with `@tailwindcss/vite` in current Astro docs, no change
  needed.
- `lucide-react` ships ESM + works inside islands without change.
