import type { Pulsar, PlaqueData } from "@/lib/types"
import { selectPulsars, type SelectionAlgorithm } from "@/lib/pulsar-selection"
import { computePioneerPlaque } from "@/lib/pioneer-original"
import { relativePosition, galacticCenterAngle, galacticCenterDistance } from "@/lib/coordinates"
import { applyProperMotion, evolvePeriod } from "@/lib/proper-motion"

const DEG = Math.PI / 180
const SOL = { name: "Sol", gl: 0, gb: 0, dist: 0 }

export type Origin = { name: string; gl: number; gb: number; dist: number }

export function computePlaqueData(
  pulsars: Pulsar[],
  origin: Origin,
  count: number,
  algorithm: SelectionAlgorithm,
  mode: "1972" | "custom",
  epoch: number,
): PlaqueData | null {
  if (pulsars.length === 0) return null
  const useOrigin = mode === "1972" ? SOL : origin
  const selected =
    mode === "1972"
      ? computePioneerPlaque(pulsars)
      : selectPulsars(pulsars, useOrigin, count, algorithm)

  const drifted =
    epoch === 0
      ? selected
      : selected.map((rp) => {
          const d = applyProperMotion(rp.pulsar, epoch)
          const p0 = evolvePeriod(rp.pulsar.p0, rp.pulsar.p1, epoch)
          const driftedPulsar = { ...rp.pulsar, gl: d.gl, gb: d.gb, p0 }
          const rel = relativePosition(useOrigin, {
            gl: driftedPulsar.gl,
            gb: driftedPulsar.gb,
            dist: driftedPulsar.dist,
          })
          if (rel.dist < 1e-6) return rp
          const angle = Math.atan2(
            Math.sin(rel.gl * DEG) * Math.cos(rel.gb * DEG),
            Math.cos(rel.gl * DEG) * Math.cos(rel.gb * DEG),
          )
          return {
            ...rp,
            pulsar: driftedPulsar,
            gl: rel.gl,
            gb: rel.gb,
            dist: rel.dist,
            angle,
          }
        })

  return {
    origin: useOrigin,
    pulsars: drifted,
    gcAngle: galacticCenterAngle(useOrigin),
    gcDist: galacticCenterDistance(useOrigin),
  }
}
