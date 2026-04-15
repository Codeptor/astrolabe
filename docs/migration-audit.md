# Next.js → Astro migration audit

Exhaustive inventory of every Next.js-specific surface in the Astrolabe repo
with a verdict per item (trivial / needs design / blocker). Scope: what
binds the app to Next.js today. Target design is out of scope (that's
architect's task).

Repo snapshot: Next 16 App Router, React 19, Tailwind v4, pnpm, Turbopack,
`next-themes@0.4.6`, one API route, one full-page client component
(`app/page.tsx`, 1128 lines), ~4.7 kLOC total, all math framework-agnostic
under `lib/*`. No middleware, no instrumentation, no `.env*` files, no
Server Components besides the RSC shell files themselves.

## 1. Legend

- **trivial** — direct rewrite in Astro / drop-in replacement
- **needs design** — requires an architectural decision (how / where /
  what to replace with); Astro has a path but there's more than one
- **blocker** — Astro has no first-class equivalent, or the port demands
  a meaningful behavior change

## 2. Entry points

### 2.1 Root layout — `app/layout.tsx`
- Exports `metadata: Metadata` (L8–L69), `viewport: Viewport` (L71–L80),
  and a React `RootLayout` rendering `<html>` / `<body>` / `<ThemeProvider>`.
- `SITE_URL` falls back to `process.env.NEXT_PUBLIC_SITE_URL` (L5–L6).
- Applies `fontFamily: var(--font-mono)` inline and `suppressHydrationWarning`
  on `<html>` (needed by `next-themes` to avoid theme-flash warnings).
- Verdict: **needs design**. Astro has no layout-level `metadata` object —
  tags must be emitted into `<head>` in an `.astro` layout (or a `<SEO/>`
  component). `next-themes` is React-only; island-scoped. Whether the
  provider lives in the Astro layout as a React island or is replaced by
  a tiny vanilla theme bootstrap is an architect call.

### 2.2 Main page — `app/page.tsx` (1128 lines)
- Top-level `"use client"` (L1). One giant component holding *all* UI:
  header, plaque, sidebar, modals, onboarding, footer.
- Next-specific imports:
  - `useRouter`, `useSearchParams` from `next/navigation` (L4, 79–80, 135)
  - `useTheme` from `next-themes` (L5, 81, 127)
- URL ↔ state syncing via `router.replace(\`/${search}\`, { scroll: false })`
  (L131–L136) and a URL→state effect that reads `searchParams` (L140–L147).
  Wrapped in a `<Suspense fallback={<div className="h-svh" />}>` at L70–L76
  because `useSearchParams` requires it during prerender.
- Wraps a fetch of `/data/pulsars.json` and `/data/stars.json` at mount
  (L114–L122), so the page is already SPA-on-load — no SSR data benefit
  to preserve.
- Global keyboard shortcuts (L376–L525), `Web Audio` voice refs, SVG refs
  for export, clipboard API use, `localStorage` use — all strictly client.
- Verdict: **needs design**. Port as one `client:load` React island is
  trivial code-wise but keeps the 1128-line monolith. Replacing
  `next/navigation` is the real design decision:
  - swap `router.replace` → `history.replaceState` + `window.dispatchEvent(new PopStateEvent(...))` (vanilla)
  - swap `useSearchParams` → a small hook that reads `location.search` and
    subscribes to `popstate`
  - `Suspense` wrapper becomes unnecessary once `useSearchParams` is gone
  Mechanical, but touches the core of how the page re-renders.

## 3. Next.js special files (`app/` conventions)

### 3.1 `app/sitemap.ts`
- `MetadataRoute.Sitemap` exporter with two URLs (root + `?mode=1972`)
  and `process.env.NEXT_PUBLIC_SITE_URL` fallback (L1–L21).
- Verdict: **trivial**. Astro generates sitemap via `@astrojs/sitemap`
  integration; the two hardcoded entries can move to that config or to a
  static `public/sitemap.xml`.

### 3.2 `app/robots.ts`
- `MetadataRoute.Robots` exporter (L1–L16) with `allow: "/"`, `disallow:
  "/api/"`, `sitemap`, `host`.
- Verdict: **trivial**. Static `public/robots.txt` replacement. Note:
  `disallow: /api/` is moot once the API route is replaced (see §4).

### 3.3 `app/opengraph-image.tsx` (295 lines)
- Uses `ImageResponse` from `next/og` (L1). Builds a full JSX-in-Satori
  composition: hydrogen hyperfine SVG, figures, pulsar radial map (same
  math/constants as `components/plaque.tsx`), solar-system strip, meta
  row. Hardcoded 14 Pioneer pulsar coordinates mirrored from
  `lib/pioneer-original.ts` (L10–L25).
- No external dependency on runtime state — produces one fixed
  1200×630 PNG.
- Verdict: **needs design**. `next/og` is Vercel-only (Satori + resvg).
  Options in Astro:
  1. Pre-generate the OG image once with a build-time script that uses
     `satori` + `@resvg/resvg-js` directly, output to `public/og.png`.
  2. Serve it from an Astro endpoint using the same libs.
  3. Render the SVG manually and rasterize with `sharp`.
  All three are mechanical once chosen — but the dep pinning (Satori
  JSX vs string-built SVG) matters. Architect call.

### 3.4 `app/icon.svg`
- Static 32×32 radial-lines favicon (L1–L13).
- Verdict: **trivial**. Move to `public/icon.svg` (or `public/favicon.svg`)
  and reference with `<link rel="icon" href="/icon.svg">`.

### 3.5 `app/error.tsx`
- `"use client"` component with `reset()` prop, `error.digest` display,
  `useEffect(console.error)` on mount (L1–L45).
- Verdict: **needs design**. Astro has no file-based "error UI" convention.
  Options: custom `src/pages/500.astro` (only catches server errors on SSR
  routes), a top-level React error boundary inside the page island, or
  drop it entirely (this is a client-only SPA; runtime errors can be
  caught by a React `ErrorBoundary` around the main island). The Next
  `reset()` contract doesn't exist in Astro — any port changes semantics.

### 3.6 `app/not-found.tsx`
- Tiny `Link`-to-home 404 page with its own `metadata: { title: "not found" }`
  (L1–L30). Uses `next/link` (L1).
- Verdict: **trivial**. `src/pages/404.astro` with a plain `<a href="/">`.

### 3.7 `app/globals.css` (190 lines)
- Tailwind v4 `@import "tailwindcss"` (L1) + `@theme inline` CSS-vars block
  (L3–L11) + four theme color blocks keyed on class selectors
  `:root, .dark`, `.light`, `.gold`, `.blueprint` (L13–L48). The `.dark`
  etc. classes are set by `next-themes` on `<html>`.
- Three `@font-face` rules pointing at `/fonts/*` (L50–L72).
- `@layer base`, themed slider + themed scrollbar styles.
- Verdict: **trivial for CSS itself**; **coupled** to the theme-class-on-
  `<html>` strategy (see §4.1). Same stylesheet can be reused as-is.

## 4. Library-level Next.js couplings

### 4.1 `next-themes` (0.4.6)
- `<ThemeProvider attribute="class" defaultTheme="dark"
  themes={["dark","light","gold","blueprint"]} enableSystem={false}>` in
  `app/layout.tsx:89–94`.
- `useTheme().setTheme(appState.theme)` in `app/page.tsx:127` driven by
  an effect watching the app-state theme slot.
- Reference also in `lib/state.ts:19` (comment).
- The library works by toggling a class on `<html>`; it handles the SSR
  flash-of-wrong-theme with an inlined script.
- Verdict: **needs design**. `next-themes` is marketed as "Next.js" but
  is actually framework-agnostic React — it works in any React tree. Two
  options:
  1. Keep `next-themes`; mount it inside the React island rendered via
     `client:load`. It will still write the class to `<html>`. The
     flash-suppression script has to be added manually to the Astro
     layout head because the provider isn't rendered in SSR HTML.
  2. Drop `next-themes`. Write ~30 lines of vanilla TS in an Astro
     `<script is:inline>` that reads `localStorage` and toggles the
     class pre-paint, plus a tiny React hook that reads/writes it.
  Either way, `<html suppressHydrationWarning>` semantics don't transfer
  (Astro partial hydration doesn't hydrate the shell), so the inline
  bootstrap script is required to avoid a flash.

### 4.2 `next/navigation`
- Only in `app/page.tsx` (L4, 79–80, 135, 140–147). Covered in §2.2.
- Verdict: **trivial to replace mechanically** (vanilla History API
  wrapper), but the replacement must be designed so state-sync timing
  stays idempotent (the `lastPushedSearch` guard at L111 and L133 relies
  on precise semantics of `router.replace` not re-triggering the URL→state
  effect synchronously).

### 4.3 `next/og`
- Only in `app/opengraph-image.tsx`. Covered in §3.3.

### 4.4 `next/server` (`NextRequest`)
- Only in `app/api/star-resolve/route.ts:1,4`. Covered in §5.

### 4.5 `next/link`
- Only in `app/not-found.tsx:1,22`. Trivial.

### 4.6 Type imports (`Metadata`, `Viewport`, `MetadataRoute`)
- `app/layout.tsx:3`, `app/not-found.tsx:2`, `app/sitemap.ts:1`,
  `app/robots.ts:1`. Pure type imports; disappear on removal of the
  respective files.

### 4.7 `process.env.NEXT_PUBLIC_SITE_URL`
- Read in `app/layout.tsx:6`, `app/robots.ts:4`, `app/sitemap.ts:4`.
- Verdict: **trivial**. Astro exposes build-time env via `import.meta.env`
  (`PUBLIC_*` prefix for client exposure). One rename each call site.

### 4.8 `tsconfig.json`
- `"plugins": [{ "name": "next" }]` (L22–L24), `include` has
  `.next/types/**/*.ts` and `.next/dev/types/**/*.ts` (L36–L37), plus
  `next-env.d.ts`. `paths: { "@/*": ["./*"] }` (L26–L30) — the `@/` alias
  is load-bearing everywhere (`lib/*`, `components/*`).
- Verdict: **trivial**. Drop the Next plugin and generated type refs,
  add Astro's `.astro/types.d.ts` reference, keep the `@/*` alias. Astro's
  default `tsconfig` via `"extends": "astro/tsconfigs/strict"` handles
  most of this.

### 4.9 `next-env.d.ts`
- References `next` and `next/image-types/global`. Delete.

## 5. API surface

### 5.1 `app/api/star-resolve/route.ts` (20 lines)
- Single `GET` handler: reads `?name=`, calls
  `resolveStar(name)` from `lib/simbad.ts`, returns JSON with
  `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`.
- Imports `NextRequest` from `next/server`.
- Consumers: `components/star-search.tsx:113` fetches
  `/api/star-resolve?name=...` as a debounced fallback when the local
  star catalogue doesn't match the query well enough.
- Verdict: **needs design**. Requires an architecture decision:
  1. Astro endpoint at `src/pages/api/star-resolve.ts` with
     `export const GET: APIRoute = ...` (one-to-one port; needs SSR
     adapter if the site is otherwise static — e.g. `@astrojs/vercel`
     or `@astrojs/node`).
  2. Call SIMBAD directly from the client (drops the server hop and
     removes the only dynamic backend), trading off CORS (Sesame and
     SIMBAD TAP both allow anonymous CORS requests, so this is feasible)
     and the `s-maxage` CDN caching.
  3. Static adapter + keep the endpoint as on-demand via
     `export const prerender = false` on the route.
  Upstream dep (`lib/simbad.ts`) is framework-agnostic — no Next imports
  in it; only `fetch` with `next: { revalidate: 86400 }` passthrough
  options (L60, L107) that will be silently ignored in any non-Next
  environment but should be removed for cleanliness.

### 5.2 `lib/simbad.ts` custom fetch options
- `fetch(..., { next: { revalidate: 86400 } })` at L60 and L107. These
  are Next-only `RequestInit` extensions.
- Verdict: **trivial**. Remove the `next:` key; cache lives at the HTTP
  layer (the endpoint's `Cache-Control`) already.

## 6. `'use client'` boundaries

Ten files carry `"use client"`:

1. `app/page.tsx:1` — main SPA
2. `app/error.tsx:1`
3. `components/star-search.tsx:1`
4. `components/pulsar-list.tsx:1`
5. `components/export-button.tsx:1`
6. `components/theme-toggle.tsx:1`
7. `components/algorithm-picker.tsx:1`
8. `components/onboarding.tsx:1`
9. `components/embed-modal.tsx:1`
10. `components/coord-picker.tsx:1`

Notably NOT marked `"use client"` but still client-only:
- `components/plaque.tsx` (uses `useState`, `useEffect`, `forwardRef`) —
  gets pulled in as a client module transitively by the parent `"use
  client"` page.
- `components/pulsar-tooltip.tsx` (uses `useState`).

Server-touching code is limited to: the API route file, the three
metadata exporters (`layout`, `sitemap`, `robots`), `opengraph-image.tsx`,
and `not-found.tsx`'s metadata export.

Verdict: **trivial**. Every `"use client"` directive is dead weight in
Astro — islands just pass `client:load` / `client:idle` at the mount
site. The files themselves need no edits beyond the directive being
deletable.

## 7. Font loading strategy

No `next/font` usage anywhere. Fonts are self-hosted in
`public/fonts/*.{woff2,ttf}` and declared via raw `@font-face` in
`app/globals.css:50–72`:
- `Tronica Mono` (10 kB woff2, body monospace)
- `Nippo` (29 kB woff2, variable display 100–900)
- `Asset` (112 kB ttf, used in SVG export fallback)

`font-display: swap` on all three. No preload hints.

Verdict: **trivial**. The `@font-face` rules and `public/fonts/`
directory transfer verbatim to Astro (`public/` maps to `public/` 1:1).
Optional improvement: add `<link rel="preload" as="font" ...>` for
Tronica in the layout head.

## 8. `next.config.mjs` headers

Defines three `headers()` groups for `/(.*)`, `/fonts/:path*`,
`/data/:path*`:

- Global security headers: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy: camera=(),
  microphone=(), geolocation=(), interest-cohort=()`.
- `/fonts/*`: `Cache-Control: public, max-age=31536000, immutable`.
- `/data/*`: `Cache-Control: public, max-age=3600, s-maxage=86400,
  stale-while-revalidate=604800`.

Also set: `reactStrictMode: true`, `poweredByHeader: false`,
`compress: true`.

Verdict: **needs design** (but mechanical per option chosen). Astro has
no built-in headers config; headers are a deploy-target concern:
- Vercel: `vercel.json` → `headers: [...]` with the same shape.
- Netlify: `_headers` file.
- Cloudflare Pages: `_headers` file.
- Node/Express adapter: middleware.
- Plain static host (e.g. GitHub Pages): can't set `X-Frame-Options`
  from HTML; `Permissions-Policy` and `Referrer-Policy` can be set via
  `<meta>`, security headers can't.

The `X-Frame-Options: SAMEORIGIN` rule is in tension with the
`EmbedModal` feature (`components/embed-modal.tsx:25`) which hands users
an `<iframe src="https://astrolabe.bhanueso.dev/?...">` snippet to embed
elsewhere. This is already a live contradiction in Next — worth flagging
to the architect.

`poweredByHeader: false` is Next-default-on behavior; Astro doesn't
emit `X-Powered-By` at all. `compress: true` is delegated to the hosting
layer in Astro.

## 9. Runtime APIs that are already framework-agnostic

Flagging these because they're easy to mis-diagnose as Next-specific but
aren't — they survive the port untouched:
- `fetch("/data/pulsars.json")`, `fetch("/data/stars.json")` — plain
  `public/` serving.
- `Web Audio API` (`lib/pulsar-audio.ts`)
- `localStorage` (`components/star-search.tsx:63–78`,
  `components/onboarding.tsx:5`)
- `navigator.clipboard` (`app/page.tsx:283–288`,
  `components/embed-modal.tsx:28–29`)
- `URL.createObjectURL` / `<canvas>` / `XMLSerializer`
  (`components/export-button.tsx`)
- `window.addEventListener("keydown")` / `popstate` is not used today
  (the state-sync path goes through `useSearchParams`, which should
  become a `popstate` subscription in the port — see §2.2).
- All of `lib/*` except the two `next: { revalidate }` flags in
  `simbad.ts` (§5.2).
- `lib/__tests__/*.test.ts` — vitest only, no Next dependency.

## 10. Summary table

| Item | File(s) | Verdict |
|---|---|---|
| Root layout metadata + viewport | `app/layout.tsx` | needs design |
| Main page (next/navigation, next-themes, Suspense) | `app/page.tsx` | needs design |
| Sitemap | `app/sitemap.ts` | trivial |
| Robots | `app/robots.ts` | trivial |
| OG image (next/og) | `app/opengraph-image.tsx` | needs design |
| Icon | `app/icon.svg` | trivial |
| Error boundary | `app/error.tsx` | needs design |
| 404 | `app/not-found.tsx` | trivial |
| Globals CSS (Tailwind v4 + theme classes) | `app/globals.css` | trivial |
| `next-themes` provider | `app/layout.tsx`, `app/page.tsx` | needs design |
| `next/navigation` URL state | `app/page.tsx` | needs design |
| `next/link` | `app/not-found.tsx` | trivial |
| `NEXT_PUBLIC_SITE_URL` | 3 files | trivial |
| tsconfig Next plugin + types | `tsconfig.json`, `next-env.d.ts` | trivial |
| API route `/api/star-resolve` | `app/api/star-resolve/route.ts`, `lib/simbad.ts`, `components/star-search.tsx` | needs design |
| `lib/simbad.ts` `next: { revalidate }` | `lib/simbad.ts` | trivial |
| `'use client'` directives (10 files) | see §6 | trivial |
| Font loading (self-hosted @font-face) | `app/globals.css`, `public/fonts/` | trivial |
| Security + cache headers | `next.config.mjs` | needs design |

**No blockers identified.** Every binding has a clear Astro-side path.
The four "needs design" clusters (theme bootstrap, URL state, OG image
generation, API route adapter + headers) are the substance of what the
architect must decide before the port begins.
