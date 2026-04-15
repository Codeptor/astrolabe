// Synthetic per-pulsar proper motion model.
//
// The ATNF subset we ship doesn't include PMRA/PMDEC. For visual demonstration
// of the time-machine slider we synthesize a deterministic transverse velocity
// from the pulsar name (so the same pulsar always drifts the same direction).
//
// Real pulsar transverse velocities range ~50–500 km/s (median ~250 km/s).
// At 1 kpc, 250 km/s ≈ 53 mas/year of proper motion. For nearer pulsars the
// angular drift is larger; for farther ones, smaller.
//
// We pick a velocity in 100–400 km/s and a direction angle from a hash of the
// pulsar name. The drift is then v * t / d, converted to degrees.

import type { Pulsar } from "./types"

const KPC_TO_KM = 3.086e16
const SECONDS_PER_YEAR = 31_557_600
const RAD_TO_DEG = 180 / Math.PI

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface MotionVec {
  velocity: number // km/s, transverse
  angle: number    // radians, direction in tangent plane (gl/gb)
}

const cache = new Map<string, MotionVec>()

function motionFor(name: string): MotionVec {
  const cached = cache.get(name)
  if (cached) return cached
  const h = hash(name)
  // velocity 100–400 km/s
  const velocity = 100 + (h % 300)
  // angle 0–2π
  const angle = ((h >>> 8) & 0xffff) / 0xffff * Math.PI * 2
  const m = { velocity, angle }
  cache.set(name, m)
  return m
}

// Apply proper motion to a pulsar's gl/gb over `years` years (positive = future)
export function applyProperMotion(
  pulsar: Pulsar,
  years: number,
): { gl: number; gb: number } {
  if (years === 0 || pulsar.dist <= 0) {
    return { gl: pulsar.gl, gb: pulsar.gb }
  }
  const m = motionFor(pulsar.name)

  // Angular drift (radians) = v * t / d
  // v in km/s, t in seconds, d in km
  const tSec = years * SECONDS_PER_YEAR
  const dKm = pulsar.dist * KPC_TO_KM
  const angularDriftRad = (m.velocity * tSec) / dKm
  const driftDeg = angularDriftRad * RAD_TO_DEG

  // Decompose into l and b components based on motion direction angle
  const dGl = driftDeg * Math.cos(m.angle)
  const dGb = driftDeg * Math.sin(m.angle)

  // gl shift must account for cos(b) — drift in longitude is amplified near poles
  const cosB = Math.cos(pulsar.gb * Math.PI / 180)
  const gl = (((pulsar.gl + dGl / Math.max(cosB, 0.05)) % 360) + 360) % 360
  const gb = Math.max(-90, Math.min(90, pulsar.gb + dGb))

  return { gl, gb }
}

// Evolve a pulsar's spin period over `years` years using its measured P-dot.
// Real pulsars slow down due to magnetic braking — for canonical pulsars
// (P-dot ~ 10^-15 s/s) this adds up to ~0.3 s over 10 Myr, enough to flip
// bits in the binary period encoding. P1 = null means no measurement, so
// the period stays put. Result is clamped to a tiny positive minimum to
// avoid the "negative period in the deep past" edge case.
export function evolvePeriod(
  p0: number,
  p1: number | null,
  years: number,
): number {
  if (p1 === null || p1 === 0 || years === 0) return p0
  const tSec = years * SECONDS_PER_YEAR
  return Math.max(p0 + p1 * tSec, 1e-6)
}
