const DEG = Math.PI / 180
const RAD = 180 / Math.PI

// IAU J2000 galactic coordinate constants
const RA_NGP = 192.85948 * DEG
const DEC_NGP = 27.12825 * DEG
const L_NCP = 122.93192 * DEG
const SIN_DEC_NGP = Math.sin(DEC_NGP)
const COS_DEC_NGP = Math.cos(DEC_NGP)

import type { Vec3 } from "./types"
import { GC_DIST_KPC } from "./constants"

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
  // Fold near-360 values to prevent discontinuity at the 0°/360° boundary.
  // Values in [359.5, 360) are astronomically equivalent to (-0.5, 0].
  // 359.5 chosen because no catalogued source sits in this sliver,
  // and the galactic center (l≈0°) must not alias to l≈360°.
  if (gl >= 359.5) gl -= 360

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

export function galacticCenterAngle(observer: { gl: number; gb: number; dist: number }): number {
  const gc = relativePosition(observer, { gl: 0, gb: 0, dist: GC_DIST_KPC })
  return Math.atan2(
    Math.sin(gc.gl * DEG) * Math.cos(gc.gb * DEG),
    Math.cos(gc.gl * DEG) * Math.cos(gc.gb * DEG),
  )
}
