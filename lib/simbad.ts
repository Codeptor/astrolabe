import { raDecToGalactic } from "./coordinates"

const SIMBAD_TAP = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"

export interface ResolvedStar {
  name: string
  gl: number
  gb: number
  dist: number // kpc
  source: "simbad"
}

interface TapResponse {
  metadata?: { name: string }[]
  data?: (string | number | null)[][]
}

/**
 * Resolve a star name via SIMBAD TAP service.
 * Returns null if not found or if no parallax is available.
 */
export async function resolveStar(name: string): Promise<ResolvedStar | null> {
  // Escape single quotes for ADQL string literal
  const safe = name.replace(/'/g, "''").trim()
  if (!safe) return null

  const query = `SELECT TOP 1 b.main_id, b.ra, b.dec, b.plx_value
FROM basic AS b
JOIN ident AS i ON b.oid = i.oidref
WHERE UPPER(i.id) = UPPER('${safe}')`

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
      // Cache successful resolutions on the edge for 24h
      next: { revalidate: 86400 },
    })
  } catch {
    return null
  }

  if (!response.ok) return null

  let json: TapResponse
  try {
    json = await response.json()
  } catch {
    return null
  }

  const row = json.data?.[0]
  if (!row || row.length < 4) return null

  const mainId = String(row[0] ?? name).trim()
  const ra = typeof row[1] === "number" ? row[1] : parseFloat(String(row[1]))
  const dec = typeof row[2] === "number" ? row[2] : parseFloat(String(row[2]))
  const plxMas =
    row[3] === null ? null : typeof row[3] === "number" ? row[3] : parseFloat(String(row[3]))

  if (isNaN(ra) || isNaN(dec)) return null
  if (plxMas === null || isNaN(plxMas) || plxMas <= 0) return null

  const { gl, gb } = raDecToGalactic(ra, dec)
  const dist = 1 / plxMas // mas → kpc

  return {
    name: mainId,
    gl: Math.round(gl * 1000) / 1000,
    gb: Math.round(gb * 1000) / 1000,
    dist: Math.round(dist * 100000) / 100000,
    source: "simbad",
  }
}
