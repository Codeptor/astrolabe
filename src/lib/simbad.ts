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
  spType: string | null
  otype: string | null
  vmag: number | null
  pmra: number | null // mas/yr
  pmdec: number | null // mas/yr
  radvel: number | null // km/s
  nbref: number | null
}

interface ParsedSimbad {
  name: string
  ra: number
  dec: number
  plx: number | null
  plxErr: number | null
  spType: string | null
  otype: string | null
  vmag: number | null
  pmra: number | null
  pmdec: number | null
  radvel: number | null
  nbref: number | null
}

function sanitizeTapInput(name: string): string {
  return name
    .replace(/[^A-Za-z0-9+.\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildTapLikeQuery(name: string): string {
  const cleaned = sanitizeTapInput(name)
  const tokens = cleaned.split(/[\s\-_]+/).filter((t) => t.length > 0)
  if (tokens.length === 0 || !cleaned) return ""

  const pattern = tokens.join("%")
  return `SELECT TOP 1
  b.main_id, b.ra, b.dec, b.plx_value, b.plx_err, b.sp_type, b.otype_txt,
  b.pmra, b.pmdec, b.rvz_radvel, b.nbref,
  (SELECT TOP 1 f.flux FROM flux AS f WHERE f.oidref = b.oid AND f.filter = 'V') AS vmag
FROM basic AS b
JOIN ident AS i ON b.oid = i.oidref
WHERE LOWER(i.id) LIKE LOWER('%${pattern}%')
ORDER BY
  CASE
    WHEN LOWER(i.id) = LOWER('${cleaned}') THEN 0
    WHEN LOWER(i.id) LIKE LOWER('${cleaned}%') THEN 1
    ELSE 2
  END,
  LOWER(i.id),
  LOWER(b.main_id)`
}

async function resolveSesame(name: string): Promise<ParsedSimbad | null> {
  let response: Response
  try {
    response = await fetch(`${SESAME_URL}?${encodeURIComponent(name)}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(6000),
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

  // Sesame %S line has format: <sp_type> [confidence-flag] [reference]
  // e.g. "A0mA1Va C 2003AJ....126.2048G" — strip the confidence + citation
  // so we ship a clean "A0mA1Va" through the UI.
  const sMatch = text.match(/^%S\s+(\S+)/m)
  const spType = sMatch?.[1] ? sMatch[1].trim() : null

  const oMatch = text.match(/^%O\s+(.+?)\s*$/m)
  const otype = oMatch?.[1] ? oMatch[1].trim() : null

  // Sesame %M lines carry magnitudes: "%M.V <value> ..." — we only want V.
  const vMatch = text.match(/^%M\.V\s+([-\d.]+)/m)
  const vmagRaw = vMatch ? parseFloat(vMatch[1]!) : NaN
  const vmag = Number.isFinite(vmagRaw) ? vmagRaw : null

  // Sesame proper motion: "%P <pmra> <pmdec> [err_maj err_min pa]"
  const pmMatch = text.match(/^%P\s+([-\d.]+)\s+([-\d.]+)/m)
  const pmraRaw = pmMatch ? parseFloat(pmMatch[1]!) : NaN
  const pmdecRaw = pmMatch ? parseFloat(pmMatch[2]!) : NaN
  const pmra = Number.isFinite(pmraRaw) ? pmraRaw : null
  const pmdec = Number.isFinite(pmdecRaw) ? pmdecRaw : null

  // Sesame radial velocity: "%V v <value>" or "%V z <value>"
  const rvMatch = text.match(/^%V\s+v\s+([-\d.]+)/m)
  const radvelRaw = rvMatch ? parseFloat(rvMatch[1]!) : NaN
  const radvel = Number.isFinite(radvelRaw) ? radvelRaw : null

  return {
    name: mainId,
    ra,
    dec,
    plx: Number.isFinite(plx) && plx > 0 ? plx : null,
    plxErr: plxErr !== null && Number.isFinite(plxErr) ? plxErr : null,
    spType,
    otype,
    vmag,
    pmra,
    pmdec,
    radvel,
    nbref: null,
  }
}

async function resolveTapLike(name: string): Promise<ParsedSimbad | null> {
  const query = buildTapLikeQuery(name)
  if (!query) return null

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
      signal: AbortSignal.timeout(6000),
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
  const spTypeRaw = row[5]
  const otypeRaw = row[6]
  const pmraRaw = row[7]
  const pmdecRaw = row[8]
  const radvelRaw = row[9]
  const nbrefRaw = row[10]
  const vmagRaw = row[11]

  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return null

  const coerceNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  return {
    name: mainId,
    ra,
    dec,
    plx: plx !== null && Number.isFinite(plx) && plx > 0 ? plx : null,
    plxErr: plxErr !== null && Number.isFinite(plxErr) ? plxErr : null,
    spType: spTypeRaw === null || spTypeRaw === undefined ? null : String(spTypeRaw).trim() || null,
    otype: otypeRaw === null || otypeRaw === undefined ? null : String(otypeRaw).trim() || null,
    vmag: coerceNum(vmagRaw),
    pmra: coerceNum(pmraRaw),
    pmdec: coerceNum(pmdecRaw),
    radvel: coerceNum(radvelRaw),
    nbref: coerceNum(nbrefRaw),
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

  const r2 = (n: number | null, scale = 100) =>
    n === null ? null : Math.round(n * scale) / scale

  return {
    name: parsed.name,
    gl: Math.round(gl * 1000) / 1000,
    gb: Math.round(gb * 1000) / 1000,
    dist: Math.round(dist * 100000) / 100000,
    source: "simbad",
    spType: parsed.spType,
    otype: parsed.otype,
    vmag: r2(parsed.vmag),
    pmra: r2(parsed.pmra, 100),
    pmdec: r2(parsed.pmdec, 100),
    radvel: r2(parsed.radvel, 100),
    nbref: parsed.nbref,
  }
}
