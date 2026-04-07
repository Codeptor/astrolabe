import { raDecToGalactic } from "./coordinates"

// CDS Sesame name resolver — handles case-insensitive identifier lookup
// for canonical SIMBAD names (Vega, alpha Lyrae, HIP 91262, etc.)
const SESAME_URL = "https://cds.unistra.fr/cgi-bin/nph-sesame/-oI/S"

// SIMBAD TAP — used as fallback for non-canonical identifiers like
// "Stephenson 2-18" where the canonical SIMBAD ID has unusual spacing
const SIMBAD_TAP = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"

export interface ResolvedStar {
  name: string
  gl: number
  gb: number
  dist: number // kpc
  source: "simbad"
}

interface ParsedSimbad {
  name: string
  ra: number
  dec: number
  plx: number | null
  plxErr: number | null
}

async function resolveSesame(name: string): Promise<ParsedSimbad | null> {
  let response: Response
  try {
    response = await fetch(`${SESAME_URL}?${encodeURIComponent(name)}`, {
      headers: { Accept: "text/plain" },
      next: { revalidate: 86400 },
    })
  } catch {
    return null
  }
  if (!response.ok) return null
  const text = await response.text()
  if (!text.includes("#=Sc=Simbad")) return null

  const jMatch = text.match(/^%J\s+([-\d.]+)\s+([+-]?[\d.]+)/m)
  if (!jMatch) return null
  const ra = parseFloat(jMatch[1]!)
  const dec = parseFloat(jMatch[2]!)
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return null

  const xMatch = text.match(/^%X\s+([-\d.]+)(?:\s+\[([-\d.]+)\])?/m)
  const plx = xMatch ? parseFloat(xMatch[1]!) : NaN
  const plxErr = xMatch?.[2] ? parseFloat(xMatch[2]) : null

  const iMatch = text.match(/^%I\.0\s+(.+?)\s*$/m)
  const mainId = iMatch ? iMatch[1]!.trim() : name

  return {
    name: mainId,
    ra,
    dec,
    plx: Number.isFinite(plx) && plx > 0 ? plx : null,
    plxErr: plxErr !== null && Number.isFinite(plxErr) ? plxErr : null,
  }
}

async function resolveTapLike(name: string): Promise<ParsedSimbad | null> {
  // Tokenize, drop SQL wildcards/quotes, build a %a%b%c% pattern
  const cleaned = name.replace(/[%_']/g, "").trim()
  const tokens = cleaned.split(/[\s\-_]+/).filter((t) => t.length > 0)
  if (tokens.length === 0) return null
  const pattern = tokens.join("%")

  const query = `SELECT TOP 1 b.main_id, b.ra, b.dec, b.plx_value, b.plx_err
FROM basic AS b
JOIN ident AS i ON b.oid = i.oidref
WHERE i.id LIKE '%${pattern}%'`

  const params = new URLSearchParams({
    request: "doQuery",
    lang: "ADQL",
    format: "json",
    query,
  })

  let response: Response
  try {
    response = await fetch(`${SIMBAD_TAP}?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const json = (await response.json()) as { data?: (string | number | null)[][] }
  const row = json.data?.[0]
  if (!row || row.length < 5) return null

  const mainId = String(row[0] ?? name).trim()
  const ra = Number(row[1])
  const dec = Number(row[2])
  const plxRaw = row[3]
  const plxErrRaw = row[4]
  const plx = plxRaw === null ? null : Number(plxRaw)
  const plxErr = plxErrRaw === null ? null : Number(plxErrRaw)

  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return null

  return {
    name: mainId,
    ra,
    dec,
    plx: plx !== null && Number.isFinite(plx) && plx > 0 ? plx : null,
    plxErr: plxErr !== null && Number.isFinite(plxErr) ? plxErr : null,
  }
}

/**
 * Resolve a star name via Sesame (canonical IDs) with TAP LIKE fallback
 * for non-canonical identifiers. Rejects results without reliable parallax
 * because distance from <3σ parallax is essentially noise.
 */
export async function resolveStar(name: string): Promise<ResolvedStar | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  let parsed = await resolveSesame(trimmed)
  if (!parsed) parsed = await resolveTapLike(trimmed)
  if (!parsed) return null

  // Distance only from reliable parallax. SIMBAD has no spectroscopic
  // distance for most distant objects, so we cannot recover them here.
  if (parsed.plx === null) return null
  if (parsed.plxErr !== null && parsed.plxErr > 0 && parsed.plx / parsed.plxErr < 3) return null

  const dist = 1 / parsed.plx
  const { gl, gb } = raDecToGalactic(parsed.ra, parsed.dec)

  return {
    name: parsed.name,
    gl: Math.round(gl * 1000) / 1000,
    gb: Math.round(gb * 1000) / 1000,
    dist: Math.round(dist * 100000) / 100000,
    source: "simbad",
  }
}
