import { useEffect, useRef, useState } from "react"
import type { RelativePulsar } from "@/lib/types"

interface PulsarInfoCardProps {
  open: boolean
  anchor: { top: number; left: number } | null
  pulsar: RelativePulsar | null
  onClose: () => void
}

const GLOSSARY: Array<[string, string]> = [
  [
    "type",
    "millisecond pulsar (P < 30ms), young pulsar (Ṗ > 1e-12), slow (P > 5s) or normal. tells you roughly how old and how bright.",
  ],
  [
    "period",
    "rotation period — how long one beam sweep takes. millisecond pulsars are the stablest clocks in the universe.",
  ],
  [
    "Ṗ",
    "period derivative — the spindown rate, s/s. positive means the pulsar is slowing down (magnetic braking).",
  ],
  [
    "τ",
    "characteristic age = P / (2 · |Ṗ|). upper bound on how long the pulsar has been spinning.",
  ],
  [
    "dist",
    "distance from the current observer in kiloparsecs, computed from the pulsar's sky position and our triangulation frame.",
  ],
  [
    "l, b",
    "galactic longitude / latitude — direction from the observer in the IAU J2000 galactic frame.",
  ],
]

function formatPeriod(p0: number): string {
  if (p0 < 0.001) return `${(p0 * 1e6).toFixed(2)} µs`
  if (p0 < 1) return `${(p0 * 1e3).toFixed(3)} ms`
  return `${p0.toFixed(4)} s`
}

function formatAge(years: number): string {
  if (years > 1e9) return `${(years / 1e9).toFixed(2)} Gyr`
  if (years > 1e6) return `${(years / 1e6).toFixed(2)} Myr`
  if (years > 1e3) return `${(years / 1e3).toFixed(1)} kyr`
  return `${years.toFixed(0)} yr`
}

function characteristicAgeYears(p0: number, p1: number | null): number | null {
  if (p1 === null || p1 === 0) return null
  const ageSeconds = p0 / (2 * Math.abs(p1))
  return ageSeconds / (60 * 60 * 24 * 365.25)
}

function stabilityLabel(p1: number | null): string {
  if (p1 === null) return "moderate"
  const abs = Math.abs(p1)
  if (abs < 1e-20) return "exceptional"
  if (abs < 1e-18) return "high"
  if (abs < 1e-16) return "moderate"
  return "low"
}

function pulsarType(p0: number, p1: number | null): string {
  if (p0 < 0.03) return "millisecond pulsar"
  if (p1 !== null && Math.abs(p1) > 1e-12) return "young pulsar"
  if (p0 > 5) return "slow pulsar"
  return "normal pulsar"
}

function atnfUrl(name: string): string {
  return `https://www.atnf.csiro.au/research/pulsar/psrcat/proc_form.php?version=1.71&JName=JName&P0=P0&P1=P1&Dist=Dist&Gl=Gl&Gb=Gb&Type=Type&startUserDefined=true&pulsar_names=${encodeURIComponent(name)}&ephemeris=long&submit_ephemeris=Get+Ephemeris&coords_unit=raj%2Fdecj`
}

export function PulsarInfoCard({ open, anchor, pulsar, onClose }: PulsarInfoCardProps) {
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

  if (!open || !anchor || !pulsar) return null

  const p = pulsar.pulsar
  const type = pulsarType(p.p0, p.p1)
  const ageYr = characteristicAgeYears(p.p0, p.p1)

  const position = {
    top: Math.max(8, anchor.top),
    left: Math.min(
      typeof window !== "undefined" ? window.innerWidth - 320 : 320,
      Math.max(8, anchor.left),
    ),
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={`pulsar info for ${p.name}`}
      style={{ bottom: typeof window !== "undefined" ? window.innerHeight - position.top : undefined, left: position.left }}
      className="fixed z-[100] w-[320px] bg-background/95 backdrop-blur border border-foreground/20 text-[10px] text-foreground/80"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between px-3 py-2 border-b border-foreground/10 gap-3">
        <div className="min-w-0">
          <div
            className="text-[13px] text-foreground leading-tight truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            PSR {p.name}
          </div>
          <div className="text-[9px] text-foreground/45 uppercase tracking-[0.12em] mt-0.5">
            {type} · {stabilityLabel(p.p1)} stability
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
          title="rotation period"
        >
          period
        </dt>
        <dd className="tabular-nums">{formatPeriod(p.p0)}</dd>

        <dt
          className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
          title="period derivative in s/s"
        >
          Ṗ
        </dt>
        <dd className="tabular-nums">
          {p.p1 === null ? <span className="text-foreground/40">—</span> : p.p1.toExponential(2)}
        </dd>

        <dt
          className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
          title="characteristic age P / (2|Ṗ|)"
        >
          τ
        </dt>
        <dd className="tabular-nums">
          {ageYr === null ? <span className="text-foreground/40">—</span> : formatAge(ageYr)}
        </dd>

        <dt
          className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
          title="distance from the observer (kpc)"
        >
          dist
        </dt>
        <dd className="tabular-nums">{pulsar.dist.toFixed(3)} kpc</dd>

        <dt
          className="text-foreground/45 uppercase tracking-wider text-[9px] cursor-help"
          title="galactic longitude l + latitude b, ° from observer"
        >
          l, b
        </dt>
        <dd className="tabular-nums">
          l {pulsar.gl.toFixed(2)}° · b {pulsar.gb.toFixed(2)}°
        </dd>
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

      <div className="px-3 pb-2 pt-1 border-t border-foreground/10 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-foreground/60">
        <a
          href={atnfUrl(p.name)}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-foreground/25 hover:decoration-foreground hover:text-foreground transition"
        >
          ATNF ↗
        </a>
        <a
          href={`https://heasarc.gsfc.nasa.gov/cgi-bin/W3Browse/w3query.pl?tablehead=name%3Dpulsar&Name=${encodeURIComponent(p.name)}`}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-foreground/25 hover:decoration-foreground hover:text-foreground transition"
        >
          HEASARC ↗
        </a>
        <a
          href={`https://simbad.cds.unistra.fr/simbad/sim-id?Ident=PSR+${encodeURIComponent(p.name)}`}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-foreground/25 hover:decoration-foreground hover:text-foreground transition"
        >
          SIMBAD ↗
        </a>
        <a
          href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(`PSR ${p.name}`)}`}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-foreground/25 hover:decoration-foreground hover:text-foreground transition"
        >
          wikipedia ↗
        </a>
        <span className="ml-auto text-foreground/35">esc to close</span>
      </div>
    </div>
  )
}
