import { raDecToGalactic } from "./coordinates"

export interface CustomObserverCoords {
  name: string
  gl: number
  gb: number
  dist: number
}

const GAL_RE = /^l\s*=\s*([-\d.]+)\s+b\s*=\s*([-\d.]+)\s+d\s*=\s*([-\d.]+)$/i
const RADEC_SEX_RE =
  /^(\d{1,2})[h:](\d{1,2})[m:]([\d.]+)s?\s+([+-]?\d{1,2})[d°:](\d{1,2})[m':]([\d.]+)["s]?\s+d\s*=\s*([-\d.]+)$/i
const RADEC_DEC_RE =
  /^ra\s*=\s*([-\d.]+)\s+dec\s*=\s*([-\d.]+)\s+d\s*=\s*([-\d.]+)$/i

export function looksLikeObserverInput(query: string): boolean {
  const q = query.trim().toLowerCase()
  return (
    q.startsWith("l=") ||
    q.startsWith("ra=") ||
    /^\d{1,2}[h:]\d{1,2}/.test(q)
  )
}

export function isValidGalacticObserver(gl: number, gb: number, dist: number): boolean {
  return (
    Number.isFinite(gl) &&
    Number.isFinite(gb) &&
    Number.isFinite(dist) &&
    gl >= 0 &&
    gl < 360 &&
    gb >= -90 &&
    gb <= 90 &&
    dist > 0
  )
}

export function isValidEquatorialObserver(ra: number, dec: number, dist: number): boolean {
  return (
    Number.isFinite(ra) &&
    Number.isFinite(dec) &&
    Number.isFinite(dist) &&
    ra >= 0 &&
    ra < 360 &&
    dec >= -90 &&
    dec <= 90 &&
    dist > 0
  )
}

function buildName(prefix: string, a: number, b: number, dist: number): string {
  return `${prefix}${a} b=${b} d=${dist}kpc`
}

export function parseObserverInput(query: string): CustomObserverCoords | null {
  const q = query.trim()

  const gal = q.match(GAL_RE)
  if (gal) {
    const gl = parseFloat(gal[1]!)
    const gb = parseFloat(gal[2]!)
    const dist = parseFloat(gal[3]!)
    if (isValidGalacticObserver(gl, gb, dist)) {
      return { name: buildName("l=", gl, gb, dist), gl, gb, dist }
    }
    return null
  }

  const radecDec = q.match(RADEC_DEC_RE)
  if (radecDec) {
    const ra = parseFloat(radecDec[1]!)
    const dec = parseFloat(radecDec[2]!)
    const dist = parseFloat(radecDec[3]!)
    if (isValidEquatorialObserver(ra, dec, dist)) {
      const { gl, gb } = raDecToGalactic(ra, dec)
      return { name: `RA=${ra} Dec=${dec} d=${dist}kpc`, gl, gb, dist }
    }
    return null
  }

  const radecSex = q.match(RADEC_SEX_RE)
  if (radecSex) {
    const rh = parseFloat(radecSex[1]!)
    const rm = parseFloat(radecSex[2]!)
    const rs = parseFloat(radecSex[3]!)
    const dSign = radecSex[4]!.startsWith("-") ? -1 : 1
    const dd = Math.abs(parseFloat(radecSex[4]!))
    const dm = parseFloat(radecSex[5]!)
    const ds = parseFloat(radecSex[6]!)
    const dist = parseFloat(radecSex[7]!)
    const ra = (rh + rm / 60 + rs / 3600) * 15
    const dec = dSign * (dd + dm / 60 + ds / 3600)
    if (isValidEquatorialObserver(ra, dec, dist)) {
      const { gl, gb } = raDecToGalactic(ra, dec)
      return { name: q, gl, gb, dist }
    }
  }

  return null
}

export function parseCoordObserverString(value: string): CustomObserverCoords | null {
  if (!value.startsWith("coord:")) return null
  const body = value.slice(6)
  const match = body.match(/^l=(-?[\d.]+),b=(-?[\d.]+),d=(-?[\d.]+)$/)
  if (!match) return null

  const gl = parseFloat(match[1]!)
  const gb = parseFloat(match[2]!)
  const dist = parseFloat(match[3]!)
  if (!isValidGalacticObserver(gl, gb, dist)) return null

  return {
    name: buildName("l=", gl, gb, dist),
    gl,
    gb,
    dist,
  }
}
