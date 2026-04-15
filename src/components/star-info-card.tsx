import { useEffect, useRef, useState } from "react"

export interface StarInfo {
  name: string
  spType: string | null
  otype: string | null
  vmag: number | null
  pmra: number | null
  pmdec: number | null
  radvel: number | null
  nbref: number | null
  dist: number
  gl: number
  gb: number
}

interface StarInfoCardProps {
  open: boolean
  anchor: { top: number; left: number } | null
  info: StarInfo | null
  loading: boolean
  onClose: () => void
}

function formatDist(kpc: number): string {
  if (kpc <= 0) return "at Sol"
  if (kpc < 1) return `${(kpc * 1000).toFixed(2)} pc`
  if (kpc < 10) return `${kpc.toFixed(3)} kpc`
  return `${kpc.toFixed(2)} kpc`
}

function formatPm(pmra: number | null, pmdec: number | null): string | null {
  if (pmra === null && pmdec === null) return null
  const total =
    pmra !== null && pmdec !== null ? Math.hypot(pmra, pmdec) : null
  if (total !== null) return `${total.toFixed(1)} mas/yr`
  return `${pmra?.toFixed(1) ?? "?"} / ${pmdec?.toFixed(1) ?? "?"} mas/yr`
}

function formatRadvel(v: number | null): string | null {
  if (v === null) return null
  const dir = v < 0 ? "toward us" : v > 0 ? "away" : "at rest"
  return `${Math.abs(v).toFixed(1)} km/s ${dir}`
}

function formatAbsoluteMag(v: number | null, distKpc: number): string | null {
  if (v === null || distKpc <= 0) return null
  // M = m - 5 * (log10(d / 10 pc)); distKpc * 1000 = pc; divide by 10 pc
  const M = v - 5 * Math.log10((distKpc * 1000) / 10)
  return M.toFixed(2)
}

const GLOSSARY: Array<[string, string]> = [
  ["dist", "distance from Sol. parsec = ~3.26 light years; kpc = 1000 pc."],
  [
    "coords",
    "galactic longitude l (° around the plane, 0 = toward galactic centre) and latitude b (° above / below it).",
  ],
  [
    "V mag",
    "apparent brightness in Johnson V band as seen from Earth (lower = brighter; sun ≈ −27). abs = absolute magnitude, the apparent V if the star were at exactly 10 parsecs.",
  ],
  [
    "proper motion",
    "the star's apparent yearly drift on the sky in milliarcseconds per year, combining motion in both sky directions.",
  ],
  [
    "radial vel",
    "line-of-sight velocity from Doppler shift. negative = moving toward us, positive = moving away.",
  ],
  [
    "references",
    "number of SIMBAD bibliographic references — a rough 'how studied is this star' indicator.",
  ],
  [
    "sp_type",
    "Morgan–Keenan spectral classification. letter = temperature (O B A F G K M, hot → cool), number = subdivision, roman numeral = luminosity class (I super-giant … V main-sequence dwarf).",
  ],
]

export function StarInfoCard({ open, anchor, info, loading, onClose }: StarInfoCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [glossaryOpen, setGlossaryOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onClick)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onClick)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) setGlossaryOpen(false)
  }, [open])

  if (!open || !anchor) return null

  const position = {
    top: Math.max(8, anchor.top),
    left: Math.min(
      typeof window !== "undefined" ? window.innerWidth - 320 : 320,
      anchor.left,
    ),
  }

  const absV = info ? formatAbsoluteMag(info.vmag, info.dist) : null
  const pm = info ? formatPm(info.pmra, info.pmdec) : null
  const rv = info ? formatRadvel(info.radvel) : null

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={info ? `star info for ${info.name}` : "star info"}
      style={{ top: position.top, left: position.left }}
      className="fixed z-[100] w-[300px] bg-background/95 backdrop-blur border border-foreground/20 text-[10px] text-foreground/80"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between px-3 py-2 border-b border-foreground/10 gap-3">
        <div className="min-w-0">
          <div
            className="text-[13px] text-foreground leading-tight truncate"
            style={{ fontFamily: "var(--font-display)" }}
            title={info?.name}
          >
            {info?.name ?? "…"}
          </div>
          <div
            className="text-[9px] text-foreground/45 uppercase tracking-[0.12em] mt-0.5"
            title={info?.spType ? `spectral type ${info.spType}` : undefined}
          >
            {loading
              ? "loading…"
              : [info?.spType, info?.otype].filter(Boolean).join(" · ") || "no classification"}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setGlossaryOpen((v) => !v)}
            aria-label={glossaryOpen ? "hide legend" : "show legend"}
            aria-expanded={glossaryOpen}
            title={glossaryOpen ? "hide legend" : "what do these fields mean?"}
            className="text-foreground/50 hover:text-foreground text-[11px] cursor-pointer leading-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
          >
            ?
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-foreground/50 hover:text-foreground text-[12px] cursor-pointer leading-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
          >
            ✕
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-3">
        <dt
          className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
          title="distance from Sol (parsec under 1 kpc, otherwise kpc)"
        >
          dist
        </dt>
        <dd className="tabular-nums">{info ? formatDist(info.dist) : "—"}</dd>

        <dt
          className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
          title="galactic longitude l + latitude b (° from galactic centre / plane)"
        >
          coords
        </dt>
        <dd className="tabular-nums">
          {info ? `l ${info.gl.toFixed(2)}° b ${info.gb.toFixed(2)}°` : "—"}
        </dd>

        <dt
          className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
          title="apparent Johnson V magnitude (lower = brighter). abs = absolute V at 10 parsecs."
        >
          V mag
        </dt>
        <dd className="tabular-nums">
          {info?.vmag !== null && info?.vmag !== undefined ? (
            <>
              {info.vmag.toFixed(2)}
              {absV && (
                <span className="text-foreground/40">
                  {" · abs "} {absV}
                </span>
              )}
            </>
          ) : (
            <span className="text-foreground/40">—</span>
          )}
        </dd>

        <dt
          className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
          title="yearly drift across the sky (milliarcseconds per year)"
        >
          proper motion
        </dt>
        <dd className="tabular-nums">
          {pm ?? <span className="text-foreground/40">—</span>}
        </dd>

        <dt
          className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
          title="line-of-sight velocity (negative = toward us, positive = away)"
        >
          radial vel
        </dt>
        <dd className="tabular-nums">
          {rv ?? <span className="text-foreground/40">—</span>}
        </dd>

        {info?.nbref !== null && info?.nbref !== undefined && (
          <>
            <dt
              className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
              title="count of SIMBAD bibliographic references"
            >
              references
            </dt>
            <dd className="tabular-nums">{info.nbref}</dd>
          </>
        )}
      </dl>

      {glossaryOpen && (
        <div className="border-t border-foreground/10 px-3 py-3 bg-foreground/[0.02] text-[10px] leading-relaxed">
          <p className="text-[9px] uppercase tracking-widest text-foreground/50 mb-2">
            legend
          </p>
          <dl className="flex flex-col gap-1.5">
            {GLOSSARY.map(([term, def]) => (
              <div key={term}>
                <dt className="inline text-foreground">{term}</dt>
                <dd className="inline text-foreground/60">
                  <span className="text-foreground/30"> — </span>
                  {def}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="px-3 pb-2 pt-1 border-t border-foreground/10 flex gap-3 text-[9px] text-foreground/60">
        {info && (
          <a
            href={`https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(info.name)}`}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-foreground/25 hover:decoration-foreground hover:text-foreground transition"
          >
            simbad ↗
          </a>
        )}
        {info && (
          <a
            href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(info.name)}`}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-foreground/25 hover:decoration-foreground hover:text-foreground transition"
          >
            wikipedia ↗
          </a>
        )}
        <span className="ml-auto text-foreground/35">esc to close</span>
      </div>
    </div>
  )
}
