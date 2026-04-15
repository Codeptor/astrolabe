# Astrolabe: Next.js → Astro Migration Plan

Target: port the Astrolabe Next 16 App Router SPA to Astro v6 while keeping
100% visual/functional parity, tests green, and deploy to Vercel.

Source of truth verified against the current Astro docs (v6, April 2026):
getting-started, integrations-guide/react, integrations-guide/vercel,
styling (Tailwind v4), endpoints, integrations-guide/sitemap,
framework-components (client directives), upgrade-to/v6. OG image choice
verified against `vercel.com/docs/og-image-generation` (confirms
`@vercel/og` ships with `framework=other` support — standalone).

Also consumes `docs/migration-audit.md` (explorer's Next.js surface
inventory) and team-lead's six decisions on top of it.

---

## 0. Team-lead decisions baked in

1. **Theme loader.** Drop `next-themes`; inline `<script is:inline>` in
   layout `<head>` reads `localStorage.theme` (or `matchMedia` fallback)
   and sets `class="…"` on `<html>` before any island hydrates.
   `theme-toggle.tsx` stays as part of the island — reads/writes
   `document.documentElement.classList` + `localStorage` directly. No
   provider. §7.
2. **URL state.** Vanilla `history.replaceState` + `popstate` listener.
   **Preserve the `lastPushedSearch` idempotency guard** (compare
   serialized state before pushing) — the audit flagged that dropping
   it breaks subtly. §12.
3. **OG image.** Runtime endpoint, parameterized per observer/state.
   Use `@vercel/og`'s `ImageResponse` (which wraps Satori + Resvg
   internally — confirmed in Vercel docs §Technical details). The
   library ships a `framework=other` entry point so it runs inside an
   Astro endpoint on Vercel without Next. §8.
4. **`/api/star-resolve`.** Keep server-side as an Astro endpoint with
   `export const prerender = false` under `@astrojs/vercel`. SIMBAD
   CORS is unreliable across the Sesame/TAP paths, per-star CDN caching
   via `s-maxage=86400` is valuable, and keeping SIMBAD parsing server
   side trims the client bundle. §9.
5. **X-Frame-Options prod bug.** `next.config.mjs:15` sets
   `X-Frame-Options: SAMEORIGIN` globally, but
   `components/embed-modal.tsx:25` hands users an `<iframe>` embed
   snippet — so external embeds are **blocked in production today**.
   In the new `vercel.json` drop `X-Frame-Options` entirely and
   substitute `Content-Security-Policy: frame-ancestors *` (or
   `frame-ancestors 'self' https://*.example.com` if Bhanu later
   supplies an allowlist). Called out as its own step (§14 step 12b).
6. **1128-line `page.tsx` split.** Ported as a **single `client:load`
   React island** in this pass. The suggested three-island split
   (`PlaqueIsland` / `PickerIsland` / `ControlsIsland`) is deferred to
   a follow-up: all ten components read/write the same `appState`
   object in the current code, so splitting requires hoisting state
   into URL params or a shared store (Zustand / Jotai / context) — a
   feature change, not a 1:1 port. This trade-off is documented in §4
   and logged as an explicit follow-up in §16.

---

## 1. Why this is a clean fit

Astrolabe is already a single-page SPA whose entire runtime is client-side:

- `app/page.tsx` is `"use client"` from the top, 1128 lines, holds all
  state in React, fetches `/data/*.json` from the browser, uses
  URL-as-state via `next/navigation`.
- The only true server surfaces are `app/api/star-resolve/route.ts`
  (SIMBAD proxy) and the convention files `opengraph-image.tsx`,
  `sitemap.ts`, `robots.ts`, `icon.svg`.
- No next/image, no next/font, no Server Components, no server actions,
  no middleware, no ISR — nothing that needs translation beyond syntax.

Astro is a strictly better fit: static shell + one React island + one
on-demand endpoint for `/api/star-resolve` + one on-demand endpoint for
`/og.png`. Zero framework overhead on the critical path.

---

## 2. Target project skeleton

```
astrolabe/
├── astro.config.mjs              # integrations: react, vercel, sitemap
├── tsconfig.json                 # extends astro/tsconfigs/strict, jsx: react-jsx
├── vercel.json                   # security headers (replaces next.config headers())
├── package.json                  # pnpm, scripts retargeted to astro
├── vitest.config.ts              # alias updated to src/
├── public/
│   ├── data/                     # pulsars.json, stars.json — unchanged
│   ├── fonts/                    # Tronica, Nippo, Asset — unchanged
│   │   └── og/                   # Tronica.ttf, Nippo.ttf — added for OG renderer
│   └── icon.svg                  # moved from app/icon.svg
├── src/
│   ├── env.d.ts                  # /// <reference types="astro/client" />
│   ├── pages/
│   │   ├── index.astro           # root page, renders <App client:load />
│   │   ├── 404.astro             # replaces app/not-found.tsx
│   │   ├── og.png.ts             # dynamic OG endpoint (prerender=false)
│   │   ├── robots.txt.ts         # static endpoint
│   │   └── api/
│   │       └── star-resolve.ts   # GET endpoint, prerender=false
│   ├── layouts/
│   │   └── RootLayout.astro      # <html>, head, ThemeScript, font preloads
│   ├── components/
│   │   ├── ThemeScript.astro     # inline no-flash theme script
│   │   ├── App.tsx               # the old page.tsx body, as one island
│   │   └── … (all existing .tsx moved verbatim)
│   ├── lib/                      # all existing lib/ moved verbatim
│   └── styles/
│       └── global.css            # moved from app/globals.css
└── scripts/
    └── process-catalogue.ts      # unchanged
```

Path alias `@/*` is preserved via `tsconfig.json` `paths`, now pointing
to `./src/*`.

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

Removed: `next`, `next-themes`, `@tailwindcss/postcss`, `postcss`.

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
  output: "static",
  trailingSlash: "never",
  adapter: vercel({
    imageService: false,
    webAnalytics: { enabled: false },
    maxDuration: 10,
  }),
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !page.includes("/api/") &&
        !page.endsWith("/og.png") &&
        !page.endsWith("/robots.txt"),
      serialize(item) {
        if (item.url === `${SITE}/`) {
          return { ...item, priority: 1, changefreq: "monthly" }
        }
        return item
      },
      customPages: [`${SITE}/?mode=1972`],
    }),
  ],
  vite: { plugins: [tailwindcss()] },
})
```

Rationale:
- `output: "static"` + per-route `prerender = false` is the v6 canonical
  way to mix static and on-demand. Using `output: "server"` would force
  every page onto a Vercel function needlessly.
- The `@astrojs/vercel` adapter is required even in static mode so the
  on-demand endpoints (`/api/star-resolve`, `/og.png`) deploy as
  serverless functions instead of being prerendered at build time.
- Sitemap `filter`/`serialize`/`customPages` reproduce the current two
  entries (`/` priority 1 monthly, `/?mode=1972` priority 0.8 yearly).

---

## 4. Rendering mode & island boundaries

### Single island (this pass)

Per team-lead decision #6, port `page.tsx` as **one island** hydrated
with `client:load`:

```astro
---
import RootLayout from "../layouts/RootLayout.astro"
import { App } from "../components/App"
---
<RootLayout title="Astrolabe — interactive Pioneer plaque pulsar map">
  <App client:load>
    <div slot="fallback" class="h-svh" />
  </App>
</RootLayout>
```

Why `client:load` and not `client:only`:
- The audit recommends `client:load`. We want the HTML shell to render
  during SSG so the fallback is visible immediately — the React code
  then hydrates on top.
- Components like `StarSearch`, `CoordPicker` etc. guard their
  `window`/`localStorage` access inside `useEffect`, so SSR of the shell
  is safe.

Why one island, not three:
- All ten components share a single `appState` object (`AppState` in
  `lib/state.ts`) plus several siblings: `hoveredPulsar`, `lockedPulsar`,
  `toast`, `infoOpen`, `sidebarOpen`, `coordOpen`, `embedOpen`,
  `audioEnabled`, `voiceRef`, `svgRef`, `containerRef`. Splitting
  requires either:
    - Moving all cross-cutting state into URL params (partial — some
      aren't serialized today: `audioEnabled`, `toast`, refs).
    - Adding a store (Zustand / Jotai / context provider) — a new
      dependency and state architecture.
  Either path is a feature change, not a port. Deferred per team-lead.

Split follow-up is §16. Island boundaries for that future pass:
- `PlaqueIsland` — `plaque.tsx` + `pulsar-tooltip.tsx`, `client:load`
  (above the fold, interactive instantly).
- `PickerIsland` — `star-search.tsx` + `coord-picker.tsx`,
  `client:visible` (in the sidebar, below the fold on mobile).
- `ControlsIsland` — `theme-toggle.tsx` + `algorithm-picker.tsx` +
  `pulsar-list.tsx` + `export-button.tsx` + `embed-modal.tsx` +
  `onboarding.tsx`, `client:idle`.
The enabling work: introduce a tiny store (my recommendation: Zustand
with a single `useAppStore` shape mirroring current `AppState`), move
URL sync into a `useEffect` in the store file, and replace today's
`setAppState` call sites with `useAppStore` selectors.

---

## 5. Tailwind v4 integration

Current recommended path per Astro styling docs: `@tailwindcss/vite`
(not `@astrojs/tailwind`, which is legacy). The PostCSS path also
works, but the Vite plugin is the official recommendation for v4.

Steps:
1. Delete `postcss.config.mjs` and the `@tailwindcss/postcss` dep.
2. Add `@tailwindcss/vite` to `vite.plugins` in `astro.config.mjs`.
3. Move `app/globals.css` → `src/styles/global.css` verbatim — the
   `@import "tailwindcss"` and `@theme inline` blocks are v4 syntax and
   need no changes.
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
`public/fonts/` and loaded via `@font-face` in `globals.css`. Keep as is.

Add explicit `<link rel="preload">` hints in `RootLayout.astro` for the
two above-the-fold fonts (Tronica, Nippo) — implicit under Next's
auto-preload, explicit under Astro:

```astro
<link rel="preload" href="/fonts/TronicaMono-Regular.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/Nippo-Variable.woff2" as="font" type="font/woff2" crossorigin />
```

Asset.ttf is used only by the SVG export path in the browser — no
preload.

### OG renderer note

`@vercel/og` only supports `ttf`, `otf`, `woff` (NOT `woff2`), per
Vercel docs §Limitations. Add `public/fonts/og/Tronica.ttf` and
`public/fonts/og/Nippo.ttf` (converted once via `woff2-decompress` or
fontforge during migration). The browser still uses the woff2 files;
only the OG endpoint loads the `.ttf` variants via `fs.readFile`.

---

## 7. Theme toggle replacement (no-flash)

Per team-lead decision #1: drop `next-themes`. Two pieces.

### `src/components/ThemeScript.astro`

Rendered at the top of `<head>` in `RootLayout.astro`, before any other
script or stylesheet blocking resources:

```astro
---
// Runs synchronously in <head> before paint — prevents theme flash.
// No `matchMedia` fallback: the app defaults to `dark` (see lib/state.ts
// DEFAULT_STATE.theme), enableSystem was false in the old next-themes
// config, so we faithfully keep system-preference off.
---
<script is:inline>
  (() => {
    const KEY = "astrolabe-theme"
    const VALID = ["dark", "light", "gold", "blueprint"]
    let t = "dark"
    try {
      const saved = localStorage.getItem(KEY)
      if (saved && VALID.includes(saved)) t = saved
    } catch {}
    document.documentElement.classList.add(t)
    document.documentElement.style.colorScheme = t === "light" ? "light" : "dark"
  })()
</script>
```

### Inside the island (`theme-toggle.tsx`, unchanged surface)

The component today calls an external hook (`useTheme` from
`next-themes`). After the port, that hook becomes a thin vanilla wrapper:

```ts
// src/lib/theme.ts
import { useCallback, useEffect, useState } from "react"
import type { Theme } from "@/lib/state"

const KEY = "astrolabe-theme"
const VALID: Theme[] = ["dark", "light", "gold", "blueprint"]

function readClassTheme(): Theme {
  if (typeof document === "undefined") return "dark"
  for (const t of VALID) {
    if (document.documentElement.classList.contains(t)) return t
  }
  return "dark"
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readClassTheme)

  useEffect(() => {
    // Sync on mount in case the inline script ran with a value the
    // SSR HTML didn't reflect.
    setThemeState(readClassTheme())
  }, [])

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement
    VALID.forEach((v) => root.classList.remove(v))
    root.classList.add(next)
    root.style.colorScheme = next === "light" ? "light" : "dark"
    try { localStorage.setItem(KEY, next) } catch {}
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}
```

All call sites in the codebase use `useTheme().setTheme(...)` — one
import rewrite in `page.tsx` (`next-themes` → `@/lib/theme`), no
behavior change.

---

## 8. OG image endpoint

Per team-lead decision #3 (runtime, parameterized). Implementation
choice, verified in Vercel docs: use `@vercel/og` (not hand-wired
`satori` + `@resvg/resvg-js`) because:

- Vercel's docs explicitly show a `framework=other` entry point — the
  library is not Next-specific.
- `@vercel/og` wraps Satori + Resvg internally. Using the raw libs
  means pinning two deps separately and replicating the PNG-encoding
  glue the library already ships.
- On Vercel Node runtime the `new Response(…)` contract is "fully
  supported" — our Astro endpoint returns a Response.

### `src/pages/og.png.ts`

```ts
import type { APIRoute } from "astro"
import { ImageResponse } from "@vercel/og"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { renderOgTree } from "@/lib/og-tree"

export const prerender = false

const FONTS_DIR = resolve(process.cwd(), "public/fonts/og")

let cachedFonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }> | null = null

async function loadFonts() {
  if (cachedFonts) return cachedFonts
  const [tronica, nippo] = await Promise.all([
    readFile(resolve(FONTS_DIR, "Tronica.ttf")),
    readFile(resolve(FONTS_DIR, "Nippo.ttf")),
  ])
  cachedFonts = [
    { name: "Tronica Mono", data: tronica.buffer, weight: 400, style: "normal" },
    { name: "Nippo",        data: nippo.buffer,   weight: 400, style: "normal" },
  ]
  return cachedFonts
}

export const GET: APIRoute = async ({ url }) => {
  const fonts = await loadFonts()
  // parse URL state → same AppState shape the client uses, so the OG
  // image can reflect the currently shared view.
  const tree = renderOgTree(url.searchParams)
  return new ImageResponse(tree, { width: 1200, height: 630, fonts })
}
```

`lib/og-tree.tsx` holds the existing `opengraph-image.tsx` JSX body,
adapted to take a `URLSearchParams` argument so each shared URL can
render its own variant (observer, locked pulsar, algorithm, color
preset). The current Pioneer-mode geometry (from `lib/pioneer-original.ts`
constants) is the fallback tree for unparameterized requests — exact
pixel parity with the existing OG image.

Layout references the image explicitly:

```astro
<meta property="og:image" content={`${SITE}/og.png${url.search}`} />
<meta name="twitter:image" content={`${SITE}/og.png${url.search}`} />
```

(using the current URL's search params in SSG so static generators like
Slack/Discord fetch the variant matching the share link).

---

## 9. `/api/star-resolve` port

Per team-lead decision #4 — keep server-side, prerender=false, under
`@astrojs/vercel`.

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
- Same cache headers, same status codes, same response shape — so
  `components/star-search.tsx` (the only consumer) needs no change.
- `prerender = false` puts this route on a Vercel serverless function
  even though `output` is `"static"`.
- `@/lib/simbad.ts` needs one cleanup: remove the two
  `fetch(..., { next: { revalidate: 86400 } })` options (audit §5.2).
  CDN caching lives at the endpoint's `Cache-Control` header anyway.

---

## 10. Security headers via `vercel.json`

**Important: fixes a live production bug** (team-lead decision #5).
The Next config today sets `X-Frame-Options: SAMEORIGIN` globally —
which blocks the `<iframe>` snippets `embed-modal.tsx` hands users.
External embeds are broken in production right now. The new config
drops `X-Frame-Options` and uses modern CSP `frame-ancestors *`.

```jsonc
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors *" },
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

Changes vs. the current `next.config.mjs headers()`:
- **Removed** `X-Frame-Options: SAMEORIGIN` (see above).
- **Added** `Content-Security-Policy: frame-ancestors *` — modern
  superset, allows iframe embeds (which is the product intent).
- Everything else preserved byte-for-byte.

If Bhanu wants a tighter allowlist later, swap `frame-ancestors *` for
`frame-ancestors 'self' https://example.org https://*.bhanueso.dev` —
one line, no code change.

`poweredByHeader: false` / `compress: true` are Next-only — Vercel
strips `x-powered-by` by default and gzips automatically, so nothing to
port there.

---

## 11. Vitest updates

Alias only:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: { environment: "jsdom" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
})
```

All existing tests are in `lib/__tests__/*.test.ts` and exercise pure
functions — none touch Next APIs. Moving `lib/` → `src/lib/` keeps them
green.

Must stay green:
- `async-latest.test.ts`
- `binary-encoding.test.ts`
- `coordinates.test.ts`
- `custom-observer.test.ts`
- `pulsar-selection.test.ts`
- `simbad.test.ts`

---

## 12. `page.tsx` → `App.tsx` translation

Three import rewrites and **one carefully preserved idempotency guard**
(team-lead decision #2).

### Drop/replace

- Drop `"use client"` (islands are client by directive).
- `import { useRouter, useSearchParams } from "next/navigation"` →
  drop entirely; replace with the URL-state helper below.
- `import { useTheme } from "next-themes"` →
  `import { useTheme } from "@/lib/theme"` (§7).
- `<Suspense>` wrapper becomes unnecessary once `useSearchParams` is
  gone — the island itself handles loading via its `h-svh` fallback
  slot.

### URL state: preserve `lastPushedSearch` idempotency

The current code guards against feedback loops in two places:
- `lastPushedSearch` ref set to the initial serialization (L111).
- Every `setAppState` path writes to the URL via
  `router.replace({ search })` and stashes the new search string in
  `lastPushedSearch` (~L133).
- The URL → state effect compares `searchParams.toString()` to
  `lastPushedSearch.current` and only re-parses if they differ.

Port preserves this verbatim, just swaps the mechanism:

```ts
import { useEffect, useRef, useState } from "react"
import { parseState, buildSearchString, type AppState, DEFAULT_STATE } from "@/lib/state"

function readSearch(): URLSearchParams {
  return typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search)
}

function useUrlState(): [AppState, (next: AppState) => void] {
  const [appState, setAppState] = useState<AppState>(() =>
    typeof window === "undefined" ? DEFAULT_STATE : parseState(readSearch())
  )
  const lastPushedSearch = useRef<string>(buildSearchString(appState))

  // Browser back/forward → state.
  useEffect(() => {
    function onPop() {
      const next = window.location.search.replace(/^\?/, "")
      // Idempotency guard: ignore our own pushes.
      if (next === lastPushedSearch.current) return
      setAppState(parseState(new URLSearchParams(next)))
      lastPushedSearch.current = next
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  // State → URL.
  const update = (next: AppState) => {
    setAppState(next)
    const nextSearch = buildSearchString(next)
    if (nextSearch === lastPushedSearch.current) return
    lastPushedSearch.current = nextSearch
    const qs = nextSearch ? `?${nextSearch}` : window.location.pathname
    window.history.replaceState(null, "", qs)
  }

  return [appState, update]
}
```

`router.replace({ search }, { scroll: false })` becomes
`history.replaceState` (doesn't scroll, no `pages` concept needed).
`useSearchParams` becomes the initial `parseState(readSearch())` + the
`popstate` listener. The idempotency guard on BOTH sides matches the
current Next behavior exactly.

### Error boundary

`app/error.tsx` doesn't translate — Astro has no Next-style error
route. Replace with a React `ErrorBoundary` around the island root in
`App.tsx`, with the same copy (`signal lost`, the `error.digest`
display, the `try again` button wired to a state reset that clears
`hoveredPulsar`/`lockedPulsar` and re-parses the URL).

### `NEXT_PUBLIC_SITE_URL`

Three call sites: `app/layout.tsx:6`, `app/robots.ts:4`,
`app/sitemap.ts:4`. After port, `astro.config.mjs` reads
`process.env.ASTRO_SITE`; layouts/endpoints read `import.meta.env.SITE`
(Astro injects the `site` config as an env var). Rename once per call
site.

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

Each step is small enough to verify (typecheck + tests + dev smoke)
before moving to the next.

1. **Scaffold branch & deps.** Create `migrate/astro`. Remove `next`,
   `next-themes`, `@tailwindcss/postcss`, `postcss`. Add `astro`,
   `@astrojs/react`, `@astrojs/vercel`, `@astrojs/sitemap`,
   `@tailwindcss/vite`, `@vercel/og`. Delete `next.config.mjs`,
   `next-env.d.ts`, `postcss.config.mjs`.

2. **Move `lib/` and `scripts/`.** `lib/` → `src/lib/`, `scripts/`
   stays at root. Delete the two `next: { revalidate: 86400 }` options
   in `lib/simbad.ts` (audit §5.2). Update `vitest.config.ts` alias to
   `src`. Run `pnpm test` — all six specs must pass before touching
   Astro. (Foundation-first: proves the port path on pure code.)

3. **Move static assets.** `public/data/`, `public/fonts/` stay put.
   Move `app/icon.svg` → `public/icon.svg`. Move `app/globals.css` →
   `src/styles/global.css` unchanged.

4. **Add OG font variants.** Convert Tronica woff2 and Nippo woff2 to
   TTF (once, via `woff2-decompress` or fontforge). Drop both under
   `public/fonts/og/`. `@vercel/og` doesn't accept woff2 (Vercel docs
   §Limitations).

5. **Write `astro.config.mjs`** per §3 — site, `output: "static"`,
   vercel adapter (maxDuration=10, imageService=false, webAnalytics
   off), react, sitemap (filter + serialize + customPages for
   `?mode=1972`), `@tailwindcss/vite` in `vite.plugins`.

6. **Write `src/env.d.ts`** (`/// <reference types="astro/client" />`).
   Update `tsconfig.json` to `extends: "astro/tsconfigs/strict"`,
   retarget `paths` `@/*` → `./src/*`, keep `jsx: "react-jsx"`.

7. **Write `src/components/ThemeScript.astro`** per §7 and
   `src/lib/theme.ts` (the vanilla React hook replacing `next-themes`).

8. **Write `src/layouts/RootLayout.astro`** with full `<head>`:
   metadata (all the current `app/layout.tsx` metadata fields as plain
   `<meta>` tags), OG/Twitter tags (with `og.png{url.search}` per §8),
   theme-color media pair, font preloads for Tronica and Nippo, icon
   link, inline `<ThemeScript />` FIRST in head.

9. **Create `src/pages/index.astro`.** Imports RootLayout, renders
   `<App client:load />` with an `h-svh` fallback slot.

10. **Move `components/`** → `src/components/` verbatim. Create
    `src/components/App.tsx` from the old `page.tsx` body. Apply the
    three import swaps (drop `"use client"`, replace `next/navigation`
    with the `useUrlState` hook per §12 — **preserving
    `lastPushedSearch` idempotency on both popstate and replaceState
    sides**, swap `next-themes` for `@/lib/theme`). Wrap in a React
    `ErrorBoundary` to replace `app/error.tsx`.

11. **Port `/api/star-resolve`** to `src/pages/api/star-resolve.ts`
    per §9. APIRoute GET, `prerender = false`, same cache headers,
    same 400/404 status codes.

12. **Port metadata routes.**
    - `src/pages/404.astro` — replaces `not-found.tsx`, static page
      using RootLayout, same copy.
    - `src/pages/robots.txt.ts` — static endpoint returning
      `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap:
      {SITE}/sitemap-index.xml\n`.
    - `src/pages/og.png.ts` — runtime endpoint using
      `@vercel/og` per §8, `prerender = false`, loads TTF fonts from
      `public/fonts/og/` via `fs.readFile`, parameterized by URL
      search params.
    - Move the current `opengraph-image.tsx` JSX body to
      `src/lib/og-tree.tsx`.

12b. **Fix the X-Frame-Options prod bug.** Write `vercel.json` per §10
     — drop `X-Frame-Options`, add `CSP: frame-ancestors *`, keep the
     other three security headers and the two cache-control blocks.
     Call this out in the PR description so Bhanu knows the embed
     feature is getting unbroken as part of the migration.

13. **Typecheck + test.** `pnpm astro check && pnpm test`. Fix any
    import path drift. All six vitest specs must pass.

14. **Dev smoke.** `pnpm dev`, open `localhost:4321`, verify:
    - no theme flash on reload (open devtools → Network → throttle →
      Slow 3G → reload; html should paint with correct theme class
      before any script);
    - URL params round-trip (change observer, verify URL updates; hit
      back, verify state reverts; bookmark, reopen, verify state
      restored);
    - star search hits `/api/star-resolve` for an obscure name (e.g.
      `HD 10700`) and gets a JSON response with cache headers;
    - `/og.png` renders both default and with query params (e.g.
      `/og.png?observer=Vega`);
    - `/robots.txt` and `/sitemap-index.xml` serve;
    - `/404` renders the custom page;
    - embed modal produces an iframe URL that actually loads in a
      different origin (open the generated iframe HTML in a file://
      page and confirm no X-Frame-Options blocks it — this is the
      regression-fix validation for §10).

15. **Production build + parity pass.** `pnpm build && pnpm preview`.
    Run the verify-parity task (#4) with the preview server. Deploy a
    Vercel preview (`vercel --prebuilt` using `.vercel/output` that
    the adapter emits) and confirm in the Vercel dashboard:
    - `/api/star-resolve` deploys as a Serverless Function.
    - `/og.png` deploys as a Serverless Function.
    - Everything else is static.
    - Response headers include CSP `frame-ancestors *`, not
      X-Frame-Options.

---

## 15. Risk notes

- `@vercel/og`'s 500 KB bundle limit applies to JSX + fonts + any
  embedded SVG. The current OG tree is ~295 LOC of SVG primitives — no
  embedded raster images — plus two TTF fonts. Estimated ~150 KB; fine.
  If the OG endpoint ever grows past 500 KB at runtime, switch to
  hand-wired `satori` (JSX → SVG) + `@resvg/resvg-js` (SVG → PNG) as
  two separate deps — same code shape, just lose the `ImageResponse`
  wrapper.
- Astro's `client:load` with React 19 StrictMode double-invokes
  effects in dev — the current code already cleans up audio refs and
  listeners, but verify during the dev smoke step.
- Tailwind v4 `@theme inline` + CSS variables is confirmed working
  with `@tailwindcss/vite` in Astro — no change needed.
- `lucide-react` ships ESM; works inside islands without change.
- SIMBAD response parsing lives in `lib/simbad.ts`; once
  `lib/` moves to `src/lib/`, the test suite (`simbad.test.ts`) will
  exercise the same code under the new alias — trust vitest, not
  grep.

---

## 16. Follow-up (post-port, out of scope for this migration)

- **Three-island split** (team-lead decision #6 deferred branch). Steps:
  1. Add `zustand` (or stick with React context); write
     `src/lib/store.ts` exposing `useAppStore` with the current
     `AppState` shape + the non-serialized siblings.
  2. Move URL sync into the store: the store owns `lastPushedSearch`,
     `popstate` listener, and the `buildSearchString`/`parseState`
     calls.
  3. Split `App.tsx` into `PlaqueIsland` / `PickerIsland` /
     `ControlsIsland` — each a top-level island rendered side-by-side
     in `index.astro` with `client:load` / `client:visible` /
     `client:idle` respectively.
  4. Delete the wrapper `App.tsx`.
  Expected win: critical-path JS drops by whatever `ControlsIsland`
  ships (currently eager; then becomes `client:idle`).
- **Frame-ancestors allowlist.** Once Bhanu decides whether the embed
  feature is public-wide or partner-only, tighten `frame-ancestors *`
  to a specific allowlist.
- **OG preview polish.** Now that `/og.png` is parameterized, add
  per-observer text ("Earth's view" / "Vega's view") and the locked
  pulsar's period/coords to the composition.
</content>
</invoke>