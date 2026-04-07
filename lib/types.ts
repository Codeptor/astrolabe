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
  gcDist: number  // distance to galactic center from observer (kpc)
}
