import type { Pulsar, RelativePulsar } from "./types"
import { relativePosition, galacticToCartesian } from "./coordinates"

const DEG = Math.PI / 180

// Characteristic age: τ = P / (2 * |P-dot|)
// Standard pulsar physics — higher = more stable/long-lived
function characteristicAge(p0: number, p1: number | null): number {
  if (p1 === null || p1 === 0) return 1e8 // unknown P-dot → penalize, not assume stable
  return p0 / (2 * Math.abs(p1))
}

// Longevity score: log-scaled characteristic age, normalized
// MSPs with τ > 10^9 years score highest
function longevityScore(p0: number, p1: number | null): number {
  const age = characteristicAge(p0, p1)
  if (age > 1e10) return 1.0
  if (age > 1e9) return 0.9
  if (age > 1e8) return 0.7
  if (age > 1e7) return 0.4
  if (age > 1e6) return 0.2
  return 0.05 // very young, unstable (e.g. Crab)
}

// Period uniqueness: prefer pulsars whose period is distinct from already-selected
function periodUniqueness(p0: number, selectedPeriods: number[]): number {
  if (selectedPeriods.length === 0) return 1.0
  let minRatio = Infinity
  for (const sp of selectedPeriods) {
    const ratio = Math.abs(Math.log(p0 / sp))
    minRatio = Math.min(minRatio, ratio)
  }
  // minRatio = 0 means identical period. > 1 means periods differ by >2.7x
  return Math.min(minRatio / 0.5, 1.0)
}

// Compute PDOP for a set of direction vectors (3D unit vectors)
// Lower PDOP = better geometric spread for triangulation
// Formula: Q = (H^T H)^-1, PDOP = sqrt(trace(Q))
// H is Nx3 matrix of unit direction vectors
export function computePDOP(unitVectors: Array<{ x: number; y: number; z: number }>): number {
  const n = unitVectors.length
  if (n < 3) return Infinity

  // Build H^T H (3x3 matrix)
  const htH = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (const v of unitVectors) {
    htH[0]![0]! += v.x * v.x
    htH[0]![1]! += v.x * v.y
    htH[0]![2]! += v.x * v.z
    htH[1]![0]! += v.y * v.x
    htH[1]![1]! += v.y * v.y
    htH[1]![2]! += v.y * v.z
    htH[2]![0]! += v.z * v.x
    htH[2]![1]! += v.z * v.y
    htH[2]![2]! += v.z * v.z
  }

  // Invert 3x3 matrix using cofactors
  const a = htH[0]![0]!, b = htH[0]![1]!, c = htH[0]![2]!
  const d = htH[1]![0]!, e = htH[1]![1]!, f = htH[1]![2]!
  const g = htH[2]![0]!, h = htH[2]![1]!, k = htH[2]![2]!

  const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g)
  if (Math.abs(det) < 1e-12) return Infinity // singular — coplanar pulsars

  const invDet = 1 / det
  // We only need the diagonal of the inverse for PDOP
  const q00 = (e * k - f * h) * invDet
  const q11 = (a * k - c * g) * invDet
  const q22 = (a * e - b * d) * invDet

  const trace = q00 + q11 + q22
  return trace > 0 ? Math.sqrt(trace) : Infinity
}

// Get 3D unit direction vector from observer to target (in galactic Cartesian)
export function unitDirection(
  observer: { gl: number; gb: number; dist: number },
  target: { gl: number; gb: number; dist: number },
): { x: number; y: number; z: number } {
  const o = galacticToCartesian(observer.gl, observer.gb, observer.dist)
  const t = galacticToCartesian(target.gl, target.gb, target.dist)
  const dx = t.x - o.x
  const dy = t.y - o.y
  const dz = t.z - o.z
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (d < 1e-10) return { x: 0, y: 0, z: 1 }
  return { x: dx / d, y: dy / d, z: dz / d }
}

export type SelectionAlgorithm =
  | "gdop"
  | "fastest"
  | "closest"
  | "longest"
  | "stable"
  | "random"

// Compute a single RelativePulsar from a Pulsar + origin (skipping selection)
function makeRelative(p: Pulsar, origin: { gl: number; gb: number; dist: number }): RelativePulsar | null {
  const rel = relativePosition(origin, { gl: p.gl, gb: p.gb, dist: p.dist })
  if (rel.dist < 1e-6) return null
  const angle = Math.atan2(
    Math.sin(rel.gl * DEG) * Math.cos(rel.gb * DEG),
    Math.cos(rel.gl * DEG) * Math.cos(rel.gb * DEG),
  )
  return { pulsar: p, gl: rel.gl, gb: rel.gb, dist: rel.dist, angle, score: 0 }
}

// Selection algorithms other than GDOP — simple sort-and-take
function simpleSelect(
  pulsars: Pulsar[],
  origin: { gl: number; gb: number; dist: number },
  count: number,
  algorithm: Exclude<SelectionAlgorithm, "gdop">,
): RelativePulsar[] {
  const all = pulsars
    .map((p) => makeRelative(p, origin))
    .filter((rp): rp is RelativePulsar => rp !== null)

  if (algorithm === "random") {
    // Fisher–Yates shuffle, then take first `count`
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[all[i], all[j]] = [all[j]!, all[i]!]
    }
    return all.slice(0, count)
  }

  const cmp: Record<typeof algorithm, (a: RelativePulsar, b: RelativePulsar) => number> = {
    fastest: (a, b) => a.pulsar.p0 - b.pulsar.p0, // shortest period first
    closest: (a, b) => a.dist - b.dist,
    longest: (a, b) => b.pulsar.p0 - a.pulsar.p0, // longest period first
    stable: (a, b) => {
      // Smallest |P-dot| = most stable. Treat null as worst.
      const ap = a.pulsar.p1
      const bp = b.pulsar.p1
      if (ap === null && bp === null) return 0
      if (ap === null) return 1
      if (bp === null) return -1
      return Math.abs(ap) - Math.abs(bp)
    },
  }

  return all.sort(cmp[algorithm]).slice(0, count)
}

export function selectPulsars(
  pulsars: Pulsar[],
  origin: { gl: number; gb: number; dist: number },
  count = 14,
  algorithm: SelectionAlgorithm = "gdop",
): RelativePulsar[] {
  if (algorithm !== "gdop") {
    return simpleSelect(pulsars, origin, count, algorithm)
  }
  // Step 1: Compute relative positions and base quality scores
  const candidates: Array<{
    pulsar: Pulsar
    rel: { gl: number; gb: number; dist: number }
    unitVec: { x: number; y: number; z: number }
    quality: number // individual pulsar quality (longevity + distance)
  }> = []

  for (const p of pulsars) {
    const rel = relativePosition(origin, { gl: p.gl, gb: p.gb, dist: p.dist })
    if (rel.dist < 1e-6) continue

    const longevity = longevityScore(p.p0, p.p1)

    // Distance score: prefer a MIX of distances
    // Nearby pulsars (<2 kpc) are good for precision
    // Distant pulsars (>4 kpc) are good for coarse localization
    // Penalty for very far pulsars (>15 kpc) — less reliable distances
    let distScore: number
    if (rel.dist < 0.5) distScore = 0.7 // very close — good but not the best (limited leverage)
    else if (rel.dist < 2) distScore = 1.0 // sweet spot for precision
    else if (rel.dist < 5) distScore = 0.9 // good for mid-range
    else if (rel.dist < 10) distScore = 0.7 // distant, useful for localization
    else distScore = 0.4 // very far, unreliable distance

    const quality = 0.5 * longevity + 0.3 * distScore + 0.2 * (p.p1 !== null ? 1 : 0.3)

    const unitVec = unitDirection(origin, { gl: p.gl, gb: p.gb, dist: p.dist })

    candidates.push({ pulsar: p, rel, unitVec, quality })
  }

  // Step 2: Pre-filter by quality + inject geometrically unique candidates
  candidates.sort((a, b) => b.quality - a.quality)
  const pool = candidates.slice(0, 200)

  // Inject candidates beyond top 200 that fill angular gaps (>30° from all pool members)
  // Prevents filtering out geometrically critical pulsars with lower quality scores
  for (const c of candidates.slice(200, 500)) {
    let tooClose = false
    for (const p of pool) {
      const dot = Math.abs(
        c.unitVec.x * p.unitVec.x + c.unitVec.y * p.unitVec.y + c.unitVec.z * p.unitVec.z,
      )
      if (dot >= 0.866) { tooClose = true; break } // cos(30°) ≈ 0.866
    }
    if (!tooClose) pool.push(c)
  }

  // Step 3: Greedy PDOP-optimized selection
  // At each step, pick the candidate that minimizes PDOP of the growing set
  // while also considering individual quality and period uniqueness
  const selected: RelativePulsar[] = []
  const selectedUnitVecs: Array<{ x: number; y: number; z: number }> = []
  const selectedPeriods: number[] = []
  const n = Math.min(count, pool.length)

  for (let i = 0; i < n; i++) {
    let bestIdx = -1
    let bestScore = -Infinity

    for (let j = 0; j < pool.length; j++) {
      const c = pool[j]!

      // Compute what PDOP would be if we added this candidate
      let pdopFactor: number
      if (selectedUnitVecs.length < 2) {
        // Not enough for PDOP yet — use angular separation heuristic
        pdopFactor = 1.0
        if (selectedUnitVecs.length === 1) {
          const dot =
            c.unitVec.x * selectedUnitVecs[0]!.x +
            c.unitVec.y * selectedUnitVecs[0]!.y +
            c.unitVec.z * selectedUnitVecs[0]!.z
          pdopFactor = 1 - Math.abs(dot) // prefer perpendicular to first pick
        }
      } else {
        const testVecs = [...selectedUnitVecs, c.unitVec]
        const pdop = computePDOP(testVecs)
        // Lower PDOP is better → invert and normalize
        // Good PDOP: 1-3. Bad: >10. Map to 0-1 score.
        pdopFactor = pdop < 100 ? 1 / (1 + pdop * 0.3) : 0
      }

      const uniqueness = periodUniqueness(c.pulsar.p0, selectedPeriods)

      // Combined score: quality (50%) + geometry via PDOP (35%) + period uniqueness (15%)
      const score = 0.50 * c.quality + 0.35 * pdopFactor + 0.15 * uniqueness

      if (score > bestScore) {
        bestScore = score
        bestIdx = j
      }
    }

    if (bestIdx === -1) break
    const chosen = pool.splice(bestIdx, 1)[0]!

    const angle = Math.atan2(
      Math.sin(chosen.rel.gl * DEG) * Math.cos(chosen.rel.gb * DEG),
      Math.cos(chosen.rel.gl * DEG) * Math.cos(chosen.rel.gb * DEG),
    )

    selected.push({
      pulsar: chosen.pulsar,
      gl: chosen.rel.gl,
      gb: chosen.rel.gb,
      dist: chosen.rel.dist,
      angle,
      score: bestScore,
    })
    selectedUnitVecs.push(chosen.unitVec)
    selectedPeriods.push(chosen.pulsar.p0)
  }

  return selected
}
