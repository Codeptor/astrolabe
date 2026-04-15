import { useEffect, useRef } from "react"

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

export function StarInfoCard({ open, anchor, info, loading, onClose }: StarInfoCardProps) {
  const ref = useRef<HTMLDivElement>(null)

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
          <div className="text-[9px] text-foreground/45 uppercase tracking-[0.12em] mt-0.5">
            {loading
              ? "loading…"
              : [info?.spType, info?.otype].filter(Boolean).join(" · ") || "no classification"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="text-foreground/50 hover:text-foreground text-[12px] cursor-pointer leading-none shrink-0"
        >
          ✕
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-3">
        <dt className="text-foreground/45 uppercase tracking-wider text-[9px]">dist</dt>
        <dd className="tabular-nums">{info ? formatDist(info.dist) : "—"}</dd>

        <dt className="text-foreground/45 uppercase tracking-wider text-[9px]">coords</dt>
        <dd className="tabular-nums">
          {info ? `l ${info.gl.toFixed(2)}° b ${info.gb.toFixed(2)}°` : "—"}
        </dd>

        <dt className="text-foreground/45 uppercase tracking-wider text-[9px]">V mag</dt>
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

        <dt className="text-foreground/45 uppercase tracking-wider text-[9px]">proper motion</dt>
        <dd className="tabular-nums">
          {pm ?? <span className="text-foreground/40">—</span>}
        </dd>

        <dt className="text-foreground/45 uppercase tracking-wider text-[9px]">radial vel</dt>
        <dd className="tabular-nums">
          {rv ?? <span className="text-foreground/40">—</span>}
        </dd>

        {info?.nbref !== null && info?.nbref !== undefined && (
          <>
            <dt className="text-foreground/45 uppercase tracking-wider text-[9px]">references</dt>
            <dd className="tabular-nums">{info.nbref}</dd>
          </>
        )}
      </dl>

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
