import type { Pulsar, RelativePulsar } from "./types"
import { GC_DIST_KPC } from "./constants"

const DEG = Math.PI / 180

// PSR J names of the 14 pulsars on the original 1972 Pioneer plaque (Drake, Sagan & Salzman)
// Source: johnstonsarchive.net/astro/pulsarmap.html, derived from
// Sagan, Sagan & Drake "A Message from Earth" (Science, 1972)
export const PIONEER_PULSAR_NAMES: readonly string[] = [
  "J1731-4744",
  "J1456-6843",
  "J1243-6423",
  "J0835-4510",
  "J0953+0755",
  "J0826+2637",
  "J0534+2200",
  "J0528+2200",
  "J0332+5434",
  "J2219+4754",
  "J2018+2839",
  "J1935+1616",
  "J1932+1059",
  "J1645-0317",
]

// Hand-picked Pioneer plaque values from 7yl4r/pulsarMap, designed for
// VISUAL fidelity with the iconic 1972 engraving rather than physical accuracy.
// Source: https://github.com/7yl4r/pulsarMap/blob/gh-pages/js/drawMap.js
//   - dist: ratio of galactic-center distance (NOT real kpc)
//   - angle: degrees from GC direction in canvas y-down convention
//   - period: in hydrogen 21cm spin-flip transition units
const SEVEN_YL4R_PULSARS: ReadonlyArray<{
  name: string
  dist: number
  angle: number
  period: number
}> = [
  { name: "J1731-4744", dist: 0.27, angle: 17,   period: 1178486506 },
  { name: "J1456-6843", dist: 0.02, angle: -49,  period: 374101871 },
  { name: "J1243-6423", dist: 0.56, angle: 58,   period: 551117432 },
  { name: "J0835-4510", dist: 0.15, angle: 95,   period: 126726823 },
  { name: "J0953+0755", dist: 0.01, angle: 129,  period: 359455043 },
  { name: "J0826+2637", dist: 0.02, angle: 162,  period: 753751947 },
  { name: "J0534+2200", dist: 0.18, angle: 174,  period: 47057538 },
  { name: "J0528+2200", dist: 0.11, angle: 177,  period: 5320116676 },
  { name: "J0332+5434", dist: 0.07, angle: -145, period: 1014906390 },
  { name: "J2219+4754", dist: 0.10, angle: -97,  period: 764842161 },
  { name: "J2018+2839", dist: 0.03, angle: -68,  period: 792520205 },
  { name: "J1935+1616", dist: 0.40, angle: -52,  period: 509549854 },
  { name: "J1932+1059", dist: 0.01, angle: 45,   period: 321746104 },
  { name: "J1645-0317", dist: 0.04, angle: -16,  period: 550675372 },
]

// 7yl4r's rounded H frequency value (we use 1420405751.768 in binary-encoding.ts)
const H_FREQ_7YL4R = 1420405752

// Compute RelativePulsar[] for the original Pioneer plaque using 7yl4r's
// hand-picked artistic values. Returns the iconic 1972 visual, not real
// astronomy. Distances are scaled by GC_DIST_KPC so the renderer's kpc→px
// conversion produces the same pixel lengths as 7yl4r's ratio approach.
export function computePioneerPlaque(_pulsars: Pulsar[]): RelativePulsar[] {
  return SEVEN_YL4R_PULSARS.map((p) => {
    // Convert 7yl4r's "ratio of GC distance" to a kpc value that, when
    // run through the renderer's `dist * (GC_DIST_PX / GC_DIST_KPC)`,
    // produces exactly `dist * GC_DIST_PX` pixels.
    const fakeKpc = p.dist * GC_DIST_KPC
    const fakePeriodSec = p.period / H_FREQ_7YL4R
    // 7yl4r's angle is in canvas y-down (positive = down). Our angle convention
    // is math y-up (positive = up), so negate for SVG rendering.
    const angleRad = -p.angle * DEG
    // Approximate galactic longitude derived from the artistic angle —
    // 7yl4r's angles happen to be close to real galactic longitudes.
    const glDeg = (((-p.angle % 360) + 360) % 360)

    const pulsar: Pulsar = {
      name: p.name,
      gl: glDeg,
      gb: 0,
      dist: fakeKpc,
      p0: fakePeriodSec,
      p1: null,
    }
    return {
      pulsar,
      gl: glDeg,
      gb: 0,
      dist: fakeKpc,
      angle: angleRad,
      score: 1.0,
    }
  })
}
