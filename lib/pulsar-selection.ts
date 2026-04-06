import type { Pulsar, RelativePulsar } from "./types"
import { relativePosition, angularSeparation } from "./coordinates"

const DEG = Math.PI / 180

function stabilityScore(p1: number | null): number {
  if (p1 === null) return 0.5
  const absP1 = Math.abs(p1)
  if (absP1 < 1e-20) return 1.0
  if (absP1 < 1e-18) return 0.9
  if (absP1 < 1e-16) return 0.6
  if (absP1 < 1e-14) return 0.3
  return 0.1
}

function distanceScore(distKpc: number): number {
  return 1 / (1 + Math.log1p(distKpc))
}

export function selectPulsars(
  pulsars: Pulsar[],
  origin: { gl: number; gb: number; dist: number },
  count = 14,
): RelativePulsar[] {
  const candidates: Array<{
    pulsar: Pulsar
    rel: { gl: number; gb: number; dist: number }
    baseScore: number
  }> = []

  for (const p of pulsars) {
    const rel = relativePosition(origin, { gl: p.gl, gb: p.gb, dist: p.dist })
    if (rel.dist < 1e-6) continue

    const stability = stabilityScore(p.p1)
    const distance = distanceScore(rel.dist)
    const baseScore = 0.6 * stability + 0.4 * distance

    candidates.push({ pulsar: p, rel, baseScore })
  }

  candidates.sort((a, b) => b.baseScore - a.baseScore)

  const selected: RelativePulsar[] = []
  const n = Math.min(count, candidates.length)

  for (let i = 0; i < n; i++) {
    let bestIdx = -1
    let bestScore = -1

    for (let j = 0; j < candidates.length; j++) {
      const c = candidates[j]!
      let angularFactor = 1

      if (selected.length > 0) {
        let minSep = Infinity
        for (const s of selected) {
          const sep = angularSeparation(c.rel.gl, c.rel.gb, s.gl, s.gb)
          minSep = Math.min(minSep, sep)
        }
        angularFactor = Math.min(minSep / 30, 1)
      }

      const finalScore = c.baseScore * (0.7 + 0.3 * angularFactor)
      if (finalScore > bestScore) {
        bestScore = finalScore
        bestIdx = j
      }
    }

    if (bestIdx === -1) break
    const chosen = candidates.splice(bestIdx, 1)[0]!
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
  }

  return selected
}
