import { raDecToGalactic } from "./coordinates"

// CDS Sesame name resolver — handles case-insensitive identifier lookup
// across SIMBAD with built-in name normalization.
const SESAME_URL = "https://cds.unistra.fr/cgi-bin/nph-sesame/-oI/S"

export interface ResolvedStar {
  name: string
  gl: number
  gb: number
  dist: number // kpc
  source: "simbad"
}

/**
 * Resolve a star name via the CDS Sesame service (SIMBAD only).
 * Returns null if not found, or if parallax is missing/unreliable.
 */
export async function resolveStar(name: string): Promise<ResolvedStar | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  let response: Response
  try {
    response = await fetch(`${SESAME_URL}?${encodeURIComponent(trimmed)}`, {
      headers: { Accept: "text/plain" },
      next: { revalidate: 86400 },
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const text = await response.text()

  // Sesame uses #=Sc=Simbad to indicate a successful SIMBAD resolution,
  // and #!Sc= to indicate failure. Bail on anything else.
  if (!text.includes("#=Sc=Simbad")) return null

  // %J <ra> <dec> = ...   — J2000 coordinates in degrees
  const jMatch = text.match(/^%J\s+([-\d.]+)\s+([+-]?[\d.]+)/m)
  if (!jMatch) return null
  const ra = parseFloat(jMatch[1]!)
  const dec = parseFloat(jMatch[2]!)
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return null

  // %X <plx> [<err>]  — parallax in mas
  const xMatch = text.match(/^%X\s+([-\d.]+)(?:\s+\[([-\d.]+)\])?/m)
  if (!xMatch) return null
  const plx = parseFloat(xMatch[1]!)
  const plxErr = xMatch[2] ? parseFloat(xMatch[2]) : 0
  if (!Number.isFinite(plx) || plx <= 0) return null
  // Reject parallax with poor signal-to-noise (<3σ) — distance would be unreliable
  if (Number.isFinite(plxErr) && plxErr > 0 && plx / plxErr < 3) return null

  // %I.0 <main_id>  — canonical SIMBAD name
  const iMatch = text.match(/^%I\.0\s+(.+?)\s*$/m)
  const mainId = iMatch ? iMatch[1]!.trim() : trimmed

  const dist = 1 / plx // mas → kpc
  const { gl, gb } = raDecToGalactic(ra, dec)

  return {
    name: mainId,
    gl: Math.round(gl * 1000) / 1000,
    gb: Math.round(gb * 1000) / 1000,
    dist: Math.round(dist * 100000) / 100000,
    source: "simbad",
  }
}
