# Astrolabe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive Pioneer-plaque-style pulsar map generator that renders custom star maps from any galactic position.

**Architecture:** Single-page Next.js App Router app. Static JSON data (processed from ATNF catalogue) loaded client-side. Pure TypeScript math libraries for coordinate transforms and pulsar selection. SVG rendering for the plaque. Space-black dark-first aesthetic.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4, TypeScript, SVG, vitest, pnpm

**Spec:** `docs/specs/2026-04-07-astrolabe-design.md`

---

## File Map

```
astrolabe/
├── app/
│   ├── layout.tsx              # Root layout, font loading, theme provider
│   ├── page.tsx                # Main page, loads data, wires components
│   └── globals.css             # Tailwind v4, @font-face, design tokens
├── components/
│   ├── plaque.tsx              # SVG plaque renderer (radial lines + ticks)
│   ├── star-search.tsx         # Combobox autocomplete for star picker
│   ├── pulsar-tooltip.tsx      # Hover/click tooltip for active pulsar line
│   ├── export-button.tsx       # SVG/PNG download
│   └── theme-toggle.tsx        # Dark/light switch
├── lib/
│   ├── types.ts                # Pulsar, Star, PlaqueData interfaces
│   ├── coordinates.ts          # RA/Dec→galactic, galactic↔Cartesian, relative position
│   ├── binary-encoding.ts      # Period → binary tick marks (hydrogen spin-flip units)
│   └── pulsar-selection.ts     # Scoring + greedy angular-spread selection
├── public/
│   ├── data/
│   │   ├── pulsars.json        # Processed ATNF catalogue (~4000 entries)
│   │   └── stars.json          # Curated notable stars (~30 entries)
│   └── fonts/
│       ├── TronicaMono-Regular.woff2
│       └── Nippo-Variable.woff2
├── scripts/
│   └── process-catalogue.ts    # Downloads ATNF tarball → parses psrcat.db → outputs pulsars.json
├── vitest.config.ts
├── package.json
├── tsconfig.json
└── next.config.mjs
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `postcss.config.mjs`
- Create: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- Copy: `public/fonts/Nippo-Variable.woff2` from kharcha

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /home/esoteric/astrolabe
pnpm init
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript @types/react @types/react-dom @types/node
pnpm add -D tailwindcss@latest @tailwindcss/postcss postcss
pnpm add -D vitest @testing-library/react jsdom
pnpm add next-themes
```

Add scripts to `package.json`:
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "update-catalogue": "npx tsx scripts/process-catalogue.ts"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.mjs**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}
export default nextConfig
```

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
```

- [ ] **Step 5: Create postcss.config.mjs**

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
```

- [ ] **Step 6: Copy Nippo font**

```bash
cp /home/esoteric/kharcha/apps/web/public/fonts/Nippo-Variable.woff2 /home/esoteric/astrolabe/public/fonts/
```

- [ ] **Step 7: Create app/globals.css**

Design tokens: space-black default, near-white light mode. Tronica Mono + Nippo font faces.

```css
@import "tailwindcss";

@theme inline {
  --font-mono: "Tronica Mono", ui-monospace, SFMono-Regular, monospace;
  --font-display: "Nippo", system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-accent: var(--accent);
}

:root {
  --background: oklch(0.05 0.005 260);
  --foreground: oklch(0.92 0 0);
  --muted: oklch(0.45 0 0);
  --line: oklch(0.88 0 0);
  --accent: oklch(0.75 0.05 220);
}

.light {
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.12 0 0);
  --muted: oklch(0.55 0 0);
  --line: oklch(0.12 0 0);
  --accent: oklch(0.45 0.08 240);
}

@font-face {
  font-family: "Tronica Mono";
  src: url("/fonts/TronicaMono-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Nippo";
  src: url("/fonts/Nippo-Variable.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@layer base {
  * {
    @apply border-foreground/10;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 8: Create app/layout.tsx**

```tsx
import "./globals.css"
import { ThemeProvider } from "next-themes"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "astrolabe",
  description: "what would your Pioneer plaque look like?",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-svh antialiased"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          value={{ dark: "", light: "light" }}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 9: Create placeholder app/page.tsx**

```tsx
export default function Page() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-muted text-xs">astrolabe</p>
    </div>
  )
}
```

- [ ] **Step 10: Verify dev server starts**

```bash
cd /home/esoteric/astrolabe && pnpm dev
```

Visit `http://localhost:3000`. Expect: space-black page with "astrolabe" centered in dim grey Tronica Mono.

- [ ] **Step 11: Init git and commit**

```bash
cd /home/esoteric/astrolabe
git init
echo -e "node_modules/\n.next/\n*.tsbuildinfo" > .gitignore
git add -A
git commit -m "init: scaffold next.js project with tailwind v4 and fonts"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Create type definitions**

```ts
export interface Pulsar {
  name: string
  gl: number   // galactic longitude (degrees)
  gb: number   // galactic latitude (degrees)
  dist: number // distance (kpc)
  p0: number   // barycentric period (seconds)
  p1: number | null // period derivative
}

export interface Star {
  name: string
  gl: number
  gb: number
  dist: number // kpc
  aliases: string[]
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface RelativePulsar {
  pulsar: Pulsar
  gl: number     // galactic longitude from observer (degrees)
  gb: number     // galactic latitude from observer (degrees)
  dist: number   // distance from observer (kpc)
  angle: number  // angle on plaque (radians, 0 = right)
  score: number
}

export interface PlaqueData {
  origin: Star | { name: string; gl: number; gb: number; dist: number }
  pulsars: RelativePulsar[]
  gcAngle: number // angle to galactic center from observer (radians)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "add type definitions for pulsars, stars, and plaque data"
```

---

### Task 3: Coordinate Math Library

**Files:**
- Create: `lib/coordinates.ts`
- Create: `lib/__tests__/coordinates.test.ts`

- [ ] **Step 1: Write tests for RA/Dec to galactic conversion**

Use known reference values: the Crab Pulsar (J0534+2200) has RA=83.633deg, Dec=+22.0145deg, expected gl~184.56, gb~-5.78.

```ts
import { describe, it, expect } from "vitest"
import {
  raDecToGalactic,
  galacticToCartesian,
  cartesianToGalactic,
  relativePosition,
} from "../coordinates"

describe("raDecToGalactic", () => {
  it("converts Crab Pulsar RA/Dec to galactic coords", () => {
    const { gl, gb } = raDecToGalactic(83.633, 22.0145)
    expect(gl).toBeCloseTo(184.56, 0)
    expect(gb).toBeCloseTo(-5.78, 0)
  })

  it("converts galactic center RA/Dec correctly", () => {
    const { gl, gb } = raDecToGalactic(266.417, -29.008)
    expect(gl).toBeCloseTo(0, 0)
    expect(gb).toBeCloseTo(0, 0)
  })
})

describe("galacticToCartesian", () => {
  it("galactic center direction gives x=d, y~0, z~0", () => {
    const v = galacticToCartesian(0, 0, 8.5)
    expect(v.x).toBeCloseTo(8.5, 5)
    expect(v.y).toBeCloseTo(0, 5)
    expect(v.z).toBeCloseTo(0, 5)
  })

  it("north galactic pole gives z=d", () => {
    const v = galacticToCartesian(0, 90, 1.0)
    expect(v.x).toBeCloseTo(0, 5)
    expect(v.y).toBeCloseTo(0, 5)
    expect(v.z).toBeCloseTo(1.0, 5)
  })
})

describe("cartesianToGalactic", () => {
  it("round-trips through Cartesian", () => {
    const gl = 123.45, gb = -30.5, dist = 2.5
    const cart = galacticToCartesian(gl, gb, dist)
    const result = cartesianToGalactic(cart)
    expect(result.gl).toBeCloseTo(gl, 4)
    expect(result.gb).toBeCloseTo(gb, 4)
    expect(result.dist).toBeCloseTo(dist, 4)
  })
})

describe("relativePosition", () => {
  it("returns identity for observer at origin", () => {
    const observer = { gl: 0, gb: 0, dist: 0 }
    const target = { gl: 90, gb: 0, dist: 1.0 }
    const rel = relativePosition(observer, target)
    expect(rel.gl).toBeCloseTo(90, 4)
    expect(rel.gb).toBeCloseTo(0, 4)
    expect(rel.dist).toBeCloseTo(1.0, 4)
  })

  it("computes correct distance for opposing positions", () => {
    const observer = { gl: 180, gb: 0, dist: 1.0 }
    const target = { gl: 0, gb: 0, dist: 1.0 }
    const rel = relativePosition(observer, target)
    expect(rel.dist).toBeCloseTo(2.0, 4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- lib/__tests__/coordinates.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement coordinates.ts**

```ts
const DEG = Math.PI / 180
const RAD = 180 / Math.PI

// IAU J2000 galactic coordinate constants
const RA_NGP = 192.85948 * DEG
const DEC_NGP = 27.12825 * DEG
const L_NCP = 122.93192 * DEG
const SIN_DEC_NGP = Math.sin(DEC_NGP)
const COS_DEC_NGP = Math.cos(DEC_NGP)

import type { Vec3 } from "./types"

export function raDecToGalactic(raDeg: number, decDeg: number): { gl: number; gb: number } {
  const ra = raDeg * DEG
  const dec = decDeg * DEG
  const sinDec = Math.sin(dec)
  const cosDec = Math.cos(dec)
  const dRa = ra - RA_NGP

  const sinB = sinDec * SIN_DEC_NGP + cosDec * COS_DEC_NGP * Math.cos(dRa)
  const gb = Math.asin(sinB)

  const y = cosDec * Math.sin(dRa)
  const x = sinDec * COS_DEC_NGP - cosDec * SIN_DEC_NGP * Math.cos(dRa)
  let gl = (L_NCP - Math.atan2(y, x)) * RAD
  gl = ((gl % 360) + 360) % 360

  return { gl, gb: gb * RAD }
}

export function galacticToCartesian(glDeg: number, gbDeg: number, dist: number): Vec3 {
  const l = glDeg * DEG
  const b = gbDeg * DEG
  return {
    x: dist * Math.cos(b) * Math.cos(l),
    y: dist * Math.cos(b) * Math.sin(l),
    z: dist * Math.sin(b),
  }
}

export function cartesianToGalactic(v: Vec3): { gl: number; gb: number; dist: number } {
  const dist = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (dist === 0) return { gl: 0, gb: 0, dist: 0 }
  const gb = Math.asin(v.z / dist) * RAD
  let gl = Math.atan2(v.y, v.x) * RAD
  gl = ((gl % 360) + 360) % 360
  return { gl, gb, dist }
}

export function relativePosition(
  observer: { gl: number; gb: number; dist: number },
  target: { gl: number; gb: number; dist: number },
): { gl: number; gb: number; dist: number } {
  const o = galacticToCartesian(observer.gl, observer.gb, observer.dist)
  const t = galacticToCartesian(target.gl, target.gb, target.dist)
  const rel: Vec3 = { x: t.x - o.x, y: t.y - o.y, z: t.z - o.z }
  return cartesianToGalactic(rel)
}

export function angularSeparation(
  l1: number, b1: number,
  l2: number, b2: number,
): number {
  const la = l1 * DEG, ba = b1 * DEG
  const lb = l2 * DEG, bb = b2 * DEG
  const cosAngle =
    Math.sin(ba) * Math.sin(bb) +
    Math.cos(ba) * Math.cos(bb) * Math.cos(la - lb)
  return Math.acos(Math.min(1, Math.max(-1, cosAngle))) * RAD
}

// Distance to galactic center from Sol in kpc
const GC_DIST = 8.178

export function galacticCenterAngle(observer: { gl: number; gb: number; dist: number }): number {
  const gc = relativePosition(observer, { gl: 0, gb: 0, dist: GC_DIST })
  return Math.atan2(
    Math.sin(gc.gl * DEG) * Math.cos(gc.gb * DEG),
    Math.cos(gc.gl * DEG) * Math.cos(gc.gb * DEG),
  )
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- lib/__tests__/coordinates.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/coordinates.ts lib/__tests__/coordinates.test.ts
git commit -m "add galactic coordinate math with tests"
```

---

### Task 4: Binary Encoding Library

**Files:**
- Create: `lib/binary-encoding.ts`
- Create: `lib/__tests__/binary-encoding.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from "vitest"
import { periodToBinary, binaryToTicks, periodToTicks } from "../binary-encoding"

describe("periodToBinary", () => {
  it("encodes a 1-second period", () => {
    // 1s / 7.04024e-10s = ~1,420,405,752 units
    const bits = periodToBinary(1.0)
    expect(bits).toBeGreaterThan(1_000_000_000n)
  })

  it("encodes Crab Pulsar period (0.0334 s)", () => {
    const bits = periodToBinary(0.0334)
    expect(bits).toBeGreaterThan(47_000_000n)
    expect(bits).toBeLessThan(48_000_000n)
  })
})

describe("binaryToTicks", () => {
  it("converts small value to tick marks", () => {
    const ticks = binaryToTicks(0b1010n)
    expect(ticks).toEqual([1, 0, 1, 0])
  })

  it("handles large binary values", () => {
    const ticks = binaryToTicks(47_441_552n)
    expect(ticks[0]).toBe(1)
    expect(ticks.length).toBeGreaterThan(20)
  })
})

describe("periodToTicks", () => {
  it("produces a non-empty array for any positive period", () => {
    const ticks = periodToTicks(0.001)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks[0]).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- lib/__tests__/binary-encoding.test.ts
```

- [ ] **Step 3: Implement binary-encoding.ts**

```ts
const H_FREQ = 1_420_405_751.768 // Hz — hydrogen 21cm spin-flip
const H_PERIOD = 1 / H_FREQ       // ~7.04024e-10 seconds

export function periodToBinary(periodSeconds: number): bigint {
  const units = Math.round(periodSeconds / H_PERIOD)
  return BigInt(units)
}

export function binaryToTicks(value: bigint): (0 | 1)[] {
  if (value === 0n) return [0]
  const bits: (0 | 1)[] = []
  let v = value
  while (v > 0n) {
    bits.unshift((v & 1n) === 1n ? 1 : 0)
    v >>= 1n
  }
  return bits
}

export function periodToTicks(periodSeconds: number): (0 | 1)[] {
  return binaryToTicks(periodToBinary(periodSeconds))
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- lib/__tests__/binary-encoding.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/binary-encoding.ts lib/__tests__/binary-encoding.test.ts
git commit -m "add binary encoding for pulsar periods"
```

---

### Task 5: Data Pipeline — Process ATNF Catalogue

**Files:**
- Create: `scripts/process-catalogue.ts`
- Create: `public/data/stars.json`
- Output: `public/data/pulsars.json`

- [ ] **Step 1: Create the processing script**

`scripts/process-catalogue.ts` — downloads the ATNF tarball, extracts `psrcat.db`, parses it, converts RA/Dec to galactic coords, outputs clean JSON.

The ATNF `psrcat.db` format: text records separated by `@---` lines. Each field is `KEY  VALUE  [uncertainty]  [reference]`. Period is in `P0` (seconds) or `F0` (Hz, P0=1/F0). Distance in `DIST_DM` (kpc).

Key parsing details:
- RAJ format: `HH:MM:SS.sss` → convert to degrees (* 15)
- DECJ format: `[+-]DD:MM:SS.s` → convert to degrees
- Some pulsars have `F0` instead of `P0`: derive `P0 = 1/F0`
- Some have `F1` instead of `P1`: derive `P1 = -F1/F0^2`
- Filter: must have PSRJ + RAJ + DECJ + (P0 or F0) + DIST_DM

Use `child_process.execFileSync` for downloading (safer than `exec`). Include the RA/Dec to galactic conversion inline (same IAU constants as `lib/coordinates.ts`).

- [ ] **Step 2: Run the script**

```bash
pnpm add -D tsx
cd /home/esoteric/astrolabe && npx tsx scripts/process-catalogue.ts
```

Expected output: "Wrote ~3800-4100 pulsars to public/data/pulsars.json"

- [ ] **Step 3: Verify output**

```bash
head -20 public/data/pulsars.json
cat public/data/pulsars.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))"
```

Spot-check a known pulsar (Crab: J0534+2200 should have gl~184.56, gb~-5.78, p0~0.0334).

- [ ] **Step 4: Create curated stars.json**

`public/data/stars.json` — hand-curated list of ~30 notable stars with galactic coordinates (sourced from SIMBAD). Include Sol as default, plus well-known stars (Proxima Centauri, Sirius, Betelgeuse, Vega, etc.), famous exoplanet hosts (TRAPPIST-1), and Sgr A* as a galactic landmark.

All coordinates should be verified against SIMBAD during implementation. Distances in kpc.

- [ ] **Step 5: Commit**

```bash
git add scripts/process-catalogue.ts public/data/pulsars.json public/data/stars.json
git commit -m "add ATNF catalogue processor and star data"
```

---

### Task 6: Pulsar Selection Algorithm

**Files:**
- Create: `lib/pulsar-selection.ts`
- Create: `lib/__tests__/pulsar-selection.test.ts`

- [ ] **Step 1: Write tests**

Test with synthetic pulsars at known positions. Verify:
- Selects exactly 14 (or fewer if pool is smaller)
- Prefers stable millisecond pulsars (low |P1|)
- Ensures angular spread (no two selected pulsars within ~5 degrees)

```ts
import { describe, it, expect } from "vitest"
import { selectPulsars } from "../pulsar-selection"
import type { Pulsar } from "../types"

function makePulsar(name: string, gl: number, gb: number, dist: number, p0: number, p1: number | null = null): Pulsar {
  return { name, gl, gb, dist, p0, p1 }
}

describe("selectPulsars", () => {
  // Create 15 pulsars spread around the sky
  const pulsars = Array.from({ length: 15 }, (_, i) =>
    makePulsar(`P${i}`, i * 24, (i % 3 - 1) * 20, 1 + i * 0.3, 0.001 + i * 0.001, 1e-20 + i * 1e-18)
  )

  it("selects exactly 14 pulsars", () => {
    const result = selectPulsars(pulsars, { gl: 0, gb: 0, dist: 0 })
    expect(result.length).toBe(14)
  })

  it("returns fewer if not enough pulsars", () => {
    const result = selectPulsars(pulsars.slice(0, 5), { gl: 0, gb: 0, dist: 0 })
    expect(result.length).toBe(5)
  })

  it("each selected pulsar has a valid angle", () => {
    const result = selectPulsars(pulsars, { gl: 0, gb: 0, dist: 0 })
    for (const rp of result) {
      expect(rp.angle).toBeGreaterThanOrEqual(-Math.PI)
      expect(rp.angle).toBeLessThanOrEqual(Math.PI)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- lib/__tests__/pulsar-selection.test.ts
```

- [ ] **Step 3: Implement pulsar-selection.ts**

Scoring: 60% period stability (lower |P1| = better), 40% distance (closer = better, log-scaled).
Selection: greedy — pick best base score first, then iteratively pick the candidate that maximizes `baseScore * angularIsolationFactor`.

See spec for full algorithm details. Key function signature:

```ts
export function selectPulsars(
  pulsars: Pulsar[],
  origin: { gl: number; gb: number; dist: number },
  count?: number, // default 14
): RelativePulsar[]
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- lib/__tests__/pulsar-selection.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pulsar-selection.ts lib/__tests__/pulsar-selection.test.ts
git commit -m "add pulsar selection algorithm with angular spread optimization"
```

---

### Task 7: SVG Plaque Renderer

**Files:**
- Create: `components/plaque.tsx`

- [ ] **Step 1: Create plaque.tsx**

Core visual component. Takes `PlaqueData` and renders an SVG with:
- 14 radial lines from center, one per selected pulsar
- Each line's angle = pulsar's galactic longitude from observer
- Each line's length = proportional to distance (log scale)
- Binary tick marks perpendicular to each line (long=1, short=0)
- 1 galactic center reference line (extends to edge)
- Center dot at observer position

Use `forwardRef` so parent can get SVG element ref for export.

SVG viewBox: `0 0 600 600`. Lines use `stroke-line` class (themed). Active/hovered line uses `stroke-accent`.

Interactions: `onMouseEnter`/`onMouseLeave` for hover, `onClick` for lock. Invisible wider hit area (strokeWidth=12) behind each line for easier interaction.

Tick mark layout: distribute evenly along the line, long tick = 6px perpendicular, short tick = 3px.

CSS transitions on all SVG attributes: `600ms cubic-bezier(0.16, 1, 0.3, 1)` for smooth animation when switching stars.

- [ ] **Step 2: Wire into page temporarily to verify rendering**

Update `app/page.tsx` to load pulsars.json, call `selectPulsars`, and render the `Plaque` component. Verify visually that lines radiate correctly from center with tick marks.

- [ ] **Step 3: Commit**

```bash
git add components/plaque.tsx
git commit -m "add SVG plaque renderer with binary tick marks"
```

---

### Task 8: Star Search Component

**Files:**
- Create: `components/star-search.tsx`

- [ ] **Step 1: Create star-search.tsx**

A combobox that filters stars by name/alias. Also accepts raw galactic coordinates: `l=180 b=0 d=8.5`.

Features:
- Text input with bottom border only (no box), placeholder shows current star
- Dropdown appears on focus/typing, max 20 results
- Fuzzy match on name and aliases
- Coordinate parsing: regex for `l=NUM b=NUM d=NUM`
- Enter key selects first result (or parsed coordinates)
- Escape closes dropdown
- Click outside closes dropdown

Styling: 11px Tronica Mono, muted placeholder, accent on focus border. Dropdown items: 10px, star name left, distance right.

- [ ] **Step 2: Commit**

```bash
git add components/star-search.tsx
git commit -m "add star search combobox with coordinate input support"
```

---

### Task 9: Tooltip, Theme Toggle, Export

**Files:**
- Create: `components/pulsar-tooltip.tsx`
- Create: `components/theme-toggle.tsx`
- Create: `components/export-button.tsx`

- [ ] **Step 1: Create pulsar-tooltip.tsx**

Shows details for the hovered/locked pulsar line:
- Pulsar name (13px, Nippo display font): "PSR J0534+2200"
- Meta line (10px, muted): period (formatted as us/ms/s) · distance (kpc) · stability rating (exceptional/high/moderate/low)
- Empty div with same height when no pulsar selected (prevents layout shift)

- [ ] **Step 2: Create theme-toggle.tsx**

Button that toggles dark/light via `next-themes`. Text only: shows "light" when dark, "dark" when light. 10px muted text.

- [ ] **Step 3: Create export-button.tsx**

Two buttons: "svg" and "png".
- SVG export: clone SVG node, inline computed stroke/fill colors as a `<style>` element, serialize to blob, trigger download as `astrolabe-{star-name}.svg`
- PNG export: render SVG to offscreen canvas at 2x resolution, export as PNG

Takes `svgRef` (ref to the plaque SVG element) and `starName` as props.

- [ ] **Step 4: Commit**

```bash
git add components/pulsar-tooltip.tsx components/theme-toggle.tsx components/export-button.tsx
git commit -m "add tooltip, theme toggle, and export components"
```

---

### Task 10: Page Assembly — Wire Everything Together

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Build the full page**

Client component that:
1. Fetches `pulsars.json` and `stars.json` on mount
2. Manages state: origin star, hovered pulsar, locked pulsar
3. Computes `PlaqueData` via `selectPulsars` (memoized on origin change)
4. Renders layout:
   - Fixed header: "astrolabe" left, theme toggle + export right
   - Star search combobox centered above plaque
   - Meta line: "14 pulsars · from {name} · {dist} kpc to galactic center"
   - Plaque SVG centered
   - Pulsar tooltip below plaque
   - Fixed footer: "data: ATNF Pulsar Catalogue v2.7.0 · {count} pulsars"

Loading state: "loading catalogue..." in dim pulsing text.

Click on background dismisses locked pulsar.

- [ ] **Step 2: Update plaque.tsx to support forwardRef**

Wrap `Plaque` with `forwardRef` so parent can pass `svgRef` through for export.

- [ ] **Step 3: Verify full app works**

```bash
pnpm dev
```

Check at `http://localhost:3000`:
- Space-black background with Tronica Mono text
- Star search → type "Prox" → shows Proxima Centauri
- Plaque renders 14 radial lines with binary ticks from center
- Hover line → tooltip shows pulsar name, period, distance
- Click line → locks tooltip, click background → unlocks
- Switch stars → lines animate to new positions
- Export SVG/PNG produces valid files
- Theme toggle switches correctly
- Responsive on mobile (plaque scales down)

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/plaque.tsx
git commit -m "wire up full page with star search, plaque, and export"
```

---

### Task 11: Polish and Final Verification

- [ ] **Step 1: Build check**

```bash
pnpm build
```

Fix any TypeScript or build errors.

- [ ] **Step 2: Visual verification**

Check in browser:
- Lines animate smoothly when switching stars (600ms cubic-bezier)
- Binary ticks are readable (not too dense)
- Galactic center reference line is visually distinct (longer than pulsar lines)
- Tooltip doesn't overflow viewport
- Mobile responsive
- Dark and light modes both look correct

- [ ] **Step 3: Create CLAUDE.md**

```markdown
# Astrolabe

Interactive Pioneer-plaque-style pulsar map generator.

## Commands

pnpm dev                # dev server (turbopack)
pnpm build              # production build
pnpm test               # run tests (vitest)
pnpm update-catalogue   # re-download ATNF catalogue → regenerate pulsars.json

## Architecture

Single-page Next.js App Router app. All computation client-side.

- `lib/coordinates.ts` — galactic coordinate math (RA/Dec <-> galactic <-> Cartesian)
- `lib/binary-encoding.ts` — pulsar period -> binary tick marks (hydrogen spin-flip units)
- `lib/pulsar-selection.ts` — greedy selection of 14 best pulsars for triangulation
- `components/plaque.tsx` — SVG renderer for the pulsar map
- `scripts/process-catalogue.ts` — ATNF tarball -> pulsars.json

## Data

- `public/data/pulsars.json` — processed from ATNF Pulsar Catalogue v2.7.0
- `public/data/stars.json` — curated list of notable stars for the picker
- Source: https://www.atnf.csiro.au/research/pulsar/psrcat/

## Fonts

- Tronica Mono (monospace body)
- Nippo (display headings)
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "add CLAUDE.md and polish"
```
