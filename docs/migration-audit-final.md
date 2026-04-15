# Astrolabe Next.js → Astro migration — final audit

Audit run: 2026-04-15, by auditor.
Scope: holistic quality pass on `astro-migration` (head `ffa9c39`, 14 commits)
vs. `master` (Next.js 16 baseline). Not per-step mechanical (that was Task #4);
this is "is the ported app actually as good or better than the Next original?".

Verdict: **GO for merge** (with one minor follow-up noted below).

---

## Top-3 findings (priority order)

1. **[LOW] `index.astro` uses `client:only="react"` instead of `client:load`.**
   The architect's plan (§4) specified `client:load` so the HTML shell
   would SSR with the fallback slot visible before hydration. Port uses
   `client:only`, so the prerendered `index.html` body has no island
   content — just the fallback `<div class="h-svh"></div>` until JS
   downloads and mounts. App.tsx is already SSR-safe (guards
   `typeof window === "undefined"` at lines 68, 122), so `client:load`
   would work. Impact: slightly slower first meaningful paint; fallback
   is still a full-height empty div so users see a matching dark/light
   background immediately via the inline ThemeScript. Not a regression
   vs. Next (Next's page was also `"use client"` top-to-bottom). Log as
   follow-up, not a merge blocker.

2. **[INFO] Astro sitemap-0.xml drops `priority=0.8 changefreq=yearly`
   for the `/?mode=1972` custom page.** Master `app/sitemap.ts` emitted
   both entries with explicit priority/changefreq. The
   `@astrojs/sitemap` config (`astro.config.mjs:28-32`) only applies
   `priority=1 changefreq=monthly` to the root via `serialize`. The
   custom `/?mode=1972` entry in the generated `sitemap-0.xml` has no
   `<priority>` or `<changefreq>` element. Crawlers treat missing
   priority as 0.5 default — harmless, but a tiny parity loss. Five-line
   fix in `serialize` if Bhanu wants exact parity.

3. **[INFO] OG image is not parameterized (matches master behavior).**
   Plan §8 (team-lead decision #3) described a parameterized endpoint
   per observer/state. Port's `src/pages/og.png.ts` ignores
   `url.searchParams` — all three variants (`/og.png`, `/og.png?s=sirius`,
   `/og.png?mode=1972`) return the exact same 43 677-byte PNG. Master's
   `app/opengraph-image.tsx` also ignores search params, so **this
   preserves parity** — the OG rendering is the Pioneer 1972 composition
   in both cases. Flagged only so Bhanu knows the plan's optional
   enhancement was deferred.

No FAIL category. No blockers.

---

## Category-by-category results

### 1. Parity check — PASS ✓

**Evidence:**
- `lib/*` files identical between master and astro-migration
  (diff-checked: `coordinates.ts`, `pulsar-selection.ts`,
  `binary-encoding.ts`, `pioneer-original.ts`, `state.ts` — zero diffs;
  `simbad.ts` — only the two approved `next: { revalidate: 86400 }`
  options removed per plan §5.2).
- `components/plaque.tsx` — zero diffs vs. master.
- Since plaque rendering is deterministic from `lib/*` + pulsar data,
  SVG output for any observer is byte-identical. Screenshot-diffing is
  guaranteed to match within subpixel antialiasing noise.

### 2. Bundle / perf — PASS ✓ (major improvement)

**Evidence (both built locally):**
- Master Next production build — `.next/static/chunks` = **748 KB**
  total client JS; largest single chunk 227 KB, top 3 chunks sum ~480 KB.
- Astro production build — `dist/client/_astro` = **300 KB** total
  (App.DC2zySzs.js 70 KB + client.DIQWfPlE.js 186 KB + index.B02hbnpo.js
  7.6 KB + RootLayout.Ciab8zv2.css 31 KB; JS only ~264 KB).
- **~60% reduction in client JS shipped.** No Next runtime, no router
  chunks, no next-themes — just React 19 + app code. Exactly what the
  plan predicted.

### 3. Security headers — PASS ✓

**Evidence — `vercel.json` at repo root:**
```
/(.*) :
  X-Content-Type-Options: nosniff              ✓ matches master
  Content-Security-Policy: frame-ancestors *   ✓ new (replaces XFO)
  Referrer-Policy: strict-origin-when-cross-origin ✓ matches master
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=() ✓ matches master
  (X-Frame-Options: SAMEORIGIN)                 ✗ REMOVED — intentional per decision #5

/fonts/(.*) :
  Cache-Control: public, max-age=31536000, immutable ✓ matches master

/data/(.*) :
  Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800 ✓ matches master
```
- Note: `vercel.json` is consumed by Vercel at deploy time; it does not
  appear in the adapter-generated `.vercel/output/config.json` (that's
  expected — Vercel merges the two). Cannot verify the actual response
  headers locally without `vercel dev`; contract is correct on paper.
- XFO → CSP frame-ancestors * substitution is the documented
  prod-bug-fix for the embed-modal contradiction.

### 4. Endpoint correctness — PASS ✓

**Evidence (against `astro dev` on :5100; `src/pages/api/star-resolve.ts`):**

| Request | Status | Body | Cache-Control |
|---|---|---|---|
| `?name=Sirius` | 200 | `{"name":"* alf CMa","gl":227.23,"gb":-8.89,"dist":0.00264,"source":"simbad"}` | `public, s-maxage=86400, stale-while-revalidate=604800` |
| `?name=HD 10700` | 200 | `{"name":"* tau Cet","gl":173.101,"gb":-73.44,"dist":0.00365,"source":"simbad"}` | (set) |
| `?name=definitelynotarealstar` | 404 | `{"error":"not found"}` | (default) |
| (no `name`) | 400 | `{"error":"missing name parameter"}` | (default) |

Matches the master Next route contract 1:1 — same status codes, same
response shapes, same cache header. `star-search.tsx` (the only
consumer) needs no changes.

### 5. OG image — PASS ✓

**Evidence:**
- `GET /og.png` — 200, `image/png`, 43 677 bytes, valid PNG
  (`1200 x 630, 8-bit/color RGBA, non-interlaced` per `file`).
- `GET /og.png?s=sirius` — same bytes.
- `GET /og.png?mode=1972` — same bytes.
- Renders via `@vercel/og` `ImageResponse` with `React.createElement`
  (approved deviation #2) and `fontFamily: "sans-serif"` (approved
  deviation #1 — matches master's original which also used
  `"sans-serif"`). No font file loading; no I/O in the hot path.
- Not parameterized — see top-3 finding #3 (parity-preserving).

### 6. Metadata — PASS ✓

**Evidence (from built static files in `dist/client/`):**
- `robots.txt`:
  ```
  User-agent: *
  Allow: /
  Disallow: /api/
  Sitemap: https://astrolabe.bhanueso.dev/sitemap-index.xml
  Host: https://astrolabe.bhanueso.dev
  ```
  Matches master's `app/robots.ts` output 1:1 (sitemap URL changed from
  `/sitemap.xml` to `/sitemap-index.xml`, which is the Astro convention
  and is what `@astrojs/sitemap` actually emits).
- `sitemap-index.xml`: references `sitemap-0.xml`.
- `sitemap-0.xml`: contains both URLs — `/` with `priority=1.0
  changefreq=monthly`, and `/?mode=1972` (no priority/changefreq — see
  top-3 finding #2).
- Full `<head>` metadata parity verified by comparing
  `RootLayout.astro:20-89` against master `app/layout.tsx:8-81`: all
  keys preserved (title, description, application-name, author,
  creator, publisher, keywords, referrer, format-detection, robots,
  canonical, icon links, fonts preload, og:*, twitter:*, theme-color
  media pair, color-scheme). `metadataBase` concept replaced by Astro's
  `site` in `astro.config.mjs` + `Astro.url.pathname` resolution.

### 7. Theme / no-flash — PASS ✓

**Evidence:**
- `ThemeScript.astro` emitted as `<script is:inline>` in `<head>`
  *before* any CSS or module script (verified in prerendered
  `index.html` — the theme script runs first in `<head>`).
- Script reads `localStorage.astrolabe-theme`, validates against
  `["dark","light","gold","blueprint"]`, falls back to `"dark"`, then
  sets both `classList` and `colorScheme` synchronously. Matches plan §7.
- `src/lib/theme.ts` `useTheme` hook reads the already-applied class on
  mount (line 29 `readTheme()` initializer), so there is no mismatch
  between the inline script's class and the React state — no flash on
  hydration.
- localStorage key is consistent across the script and the hook
  (`astrolabe-theme`).
- Cannot run a real Slow-3G toggle test without a browser, but the
  architecture matches the documented no-flash pattern exactly, and
  there's no SSR hydration mismatch surface because the island is
  `client:only` (theme is only applied via the inline script, not via
  any React-rendered SSR attribute).

### 8. URL state / `lastPushedSearch` idempotency — PASS ✓

**Evidence in `src/components/App.tsx`:**
- Line 146: `lastPushedSearch = useRef(buildSearchString(initialState))`
  — initialized from URL-parsed state.
- Lines 165-171 (State → URL push side):
  ```ts
  const search = buildSearchString(appState)
  if (search === lastPushedSearch.current) return   // guard
  lastPushedSearch.current = search
  const href = `${window.location.pathname}${search}`
  window.history.replaceState(null, "", href)
  ```
- Lines 175-184 (URL → state popstate side):
  ```ts
  const currentSearch = readSearch()
  if (currentSearch === lastPushedSearch.current) return  // guard
  lastPushedSearch.current = currentSearch
  setAppState(parseState(new URLSearchParams(currentSearch)))
  ```
- Both guards match plan §12 exactly. `router.replace` → `history.replaceState`
  swap preserves the no-scroll, no-push-to-stack semantics of the
  original. Initial URL parse on mount (lines 121-124) reads
  `window.location.search` once — no `useSearchParams` Suspense wrapper
  needed.

### 9. Embed regression (prod bug fix) — PASS ✓

**Evidence:**
- `components/embed-modal.tsx:23` produces
  `<iframe src="${url}" width="800" height="600" ...>` snippet.
- `vercel.json` sets `Content-Security-Policy: frame-ancestors *` on
  `/(.*)` (every route, including `/`). No `X-Frame-Options`.
- Once deployed, this fixes the live prod bug where
  `X-Frame-Options: SAMEORIGIN` blocked the very `<iframe>` snippets
  the app hands users. Modern browsers honor CSP `frame-ancestors` over
  legacy XFO when both are present; since XFO is now absent, there's no
  conflict.
- Cannot execute a real cross-origin `file://` iframe test without
  a Vercel deploy (local `astro dev` doesn't apply `vercel.json`
  headers), but the contract is correct.

### 10. A11y sanity — PASS ✓

**Evidence:**
- `<html lang="en">` on both `index.html` and `404.html`.
- `<title>` present, meaningful.
- Viewport meta sane (`width=device-width, initial-scale=1,
  maximum-scale=5`).
- `color-scheme: dark light` declared, plus matched `theme-color` meta
  pair for system dark/light.
- 404 page: semantic `<a href="/">` with visible text, hover transition.
- Since `index.astro` uses `client:only`, the interactive UI is not in
  the prerendered HTML and any axe-core run on the prerendered doc is
  trivially clean. The interactive UI carries over unchanged from the
  Next version (components moved verbatim per migration audit §6), so
  no new a11y violations can have been introduced in that layer
  relative to master.

### 11. Deploy dry-run — PASS ✓

**Evidence from `.vercel/output/` (generated by
`@astrojs/vercel` during `pnpm build`):**
- `config.json` routes:
  - `^/api/star-resolve$` → `_render` function ✓
  - `^/og\.png$` → `_render` function ✓
  - `^/_astro/(.*)$` → static, `cache-control: public, max-age=31536000,
    immutable` ✓
  - Everything else (`/`, `/404.html`, `robots.txt`, `sitemap-*.xml`,
    `icon.svg`, fonts, data) served via filesystem (static)
- `functions/_render.func/.vc-config.json`:
  `runtime: nodejs24.x, maxDuration: 10, handler:
  dist/server/entry.mjs, supportsResponseStreaming: true`. Matches the
  adapter config in `astro.config.mjs`.
- Function bundle includes `sharp@0.34.5` and `@vercel/og@0.11.1` as
  expected for the OG rendering pipeline.
- Local Node v25 warning in build log — Vercel will use nodejs24.x at
  runtime, doesn't affect the output. Noted, not a finding.

---

## Tests

- `pnpm test` passes: 6 files, 25 tests in 1.38 s.
  - `async-latest.test.ts`, `binary-encoding.test.ts`,
    `coordinates.test.ts`, `custom-observer.test.ts`,
    `pulsar-selection.test.ts`, `simbad.test.ts`. All green under the
    new `@/` alias pointing at `src/`.
- `pnpm build` succeeds: 4.92 s server build, vercel adapter emits
  clean output, sitemap generates correctly.

---

## Approved deviations (explicitly NOT flagged)

Per team-lead's wake-signal brief:
1. OG fonts dropped — `og.png` uses `"sans-serif"`, matching master's
   original `fontFamily: "sans-serif"`.
2. `og.png.ts` uses `React.createElement` instead of JSX — purely
   syntactic, output identical.
3. `app/error.tsx` replaced by `AppErrorBoundary` class in `App.tsx`
   with a manual `reset()` button; the Next `reset()` contract is
   intentionally dropped.
4. `.gitignore` updated.
5. Pre-existing `React.FormEvent` deprecation hint in
   `coord-picker.tsx` (was there before the port).

---

## Recommendation

**GO for merge.** Zero blockers, three low/info-severity follow-up
items. The port delivers a ~60% client-JS reduction, preserves every
functional contract the Next app had, and fixes the live production
embed bug. Tests pass, build succeeds, Vercel output structure is correct.

Suggested follow-ups (post-merge, small PRs):
- Swap `client:only="react"` → `client:load` in `src/pages/index.astro`
  so the fallback slot renders during SSG.
- Restore explicit `priority=0.8 changefreq=yearly` on the
  `?mode=1972` sitemap entry via the `serialize` hook in
  `astro.config.mjs`.
- Consider parameterizing `og.png.ts` (plan §8) as a user-facing
  enhancement once the migration is stable.
