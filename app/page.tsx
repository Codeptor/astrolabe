"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import type { Pulsar, Star, RelativePulsar, PlaqueData } from "@/lib/types"
import { selectPulsars } from "@/lib/pulsar-selection"
import { galacticCenterAngle, galacticCenterDistance } from "@/lib/coordinates"
import Plaque from "@/components/plaque"
import { StarSearch } from "@/components/star-search"
import { PulsarTooltip } from "@/components/pulsar-tooltip"
import { ExportButton } from "@/components/export-button"
import { ThemeToggle } from "@/components/theme-toggle"

const SOL: Star = { name: "Sol", gl: 0, gb: 0, dist: 0, aliases: ["Sun", "Earth"] }

function formatPulsarForCopy(rp: RelativePulsar): string {
  const p = rp.pulsar
  const period =
    p.p0 < 0.001
      ? `${(p.p0 * 1e6).toFixed(2)}µs`
      : p.p0 < 1
        ? `${(p.p0 * 1e3).toFixed(3)}ms`
        : `${p.p0.toFixed(5)}s`
  return `PSR ${p.name} | P=${period} | d=${rp.dist.toFixed(3)}kpc | l=${rp.gl.toFixed(2)}° b=${rp.gb.toFixed(2)}°`
}

export default function Page() {
  const [pulsars, setPulsars] = useState<Pulsar[]>([])
  const [stars, setStars] = useState<Star[]>([])
  const [origin, setOrigin] = useState<Star | { name: string; gl: number; gb: number; dist: number; aliases?: string[] }>(SOL)
  const [hoveredPulsar, setHoveredPulsar] = useState<RelativePulsar | null>(null)
  const [lockedPulsar, setLockedPulsar] = useState<RelativePulsar | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    Promise.all([
      fetch("/data/pulsars.json").then((r) => r.json()),
      fetch("/data/stars.json").then((r) => r.json()),
    ]).then(([p, s]: [Pulsar[], Star[]]) => {
      setPulsars(p)
      setStars(s)
    })
  }, [])

  const plaqueData = useMemo<PlaqueData | null>(() => {
    if (pulsars.length === 0) return null
    const selected = selectPulsars(pulsars, origin)
    const gcAngle = galacticCenterAngle(origin)
    const gcDist = galacticCenterDistance(origin)
    return { origin, pulsars: selected, gcAngle, gcDist }
  }, [pulsars, origin])

  const activePulsar = lockedPulsar ?? hoveredPulsar

  const distToGC = plaqueData?.gcDist ?? 0

  const handleOriginChange = useCallback(
    (star: Star | { name: string; gl: number; gb: number; dist: number; aliases?: string[] }) => {
      setOrigin(star)
      setLockedPulsar(null)
      setHoveredPulsar(null)
    },
    [],
  )

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    const id = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(id)
  }, [])

  const handlePulsarSelect = useCallback((rp: RelativePulsar | null) => {
    setLockedPulsar(rp)
  }, [])

  const handlePulsarCopy = useCallback(
    (rp: RelativePulsar) => {
      const text = formatPulsarForCopy(rp)
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(
          () => showToast("copied"),
          () => showToast("copy failed"),
        )
      }
    },
    [showToast],
  )

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return
      if (e.key === "Escape") {
        if (infoOpen) {
          setInfoOpen(false)
          return
        }
        setLockedPulsar(null)
        setOrigin(SOL)
      } else if (e.key === "?") {
        setInfoOpen((v) => !v)
      } else if (e.key === "r" || e.key === "R") {
        if (infoOpen) return
        if (stars.length === 0) return
        const pool = stars.filter((s) => s.name !== "Sol" && s.name !== origin.name)
        if (pool.length === 0) return
        const pick = pool[Math.floor(Math.random() * pool.length)]!
        handleOriginChange(pick)
        showToast(`→ ${pick.name}`)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [stars, origin.name, handleOriginChange, showToast, infoOpen])

  if (pulsars.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted text-[10px] animate-pulse">loading catalogue...</p>
      </div>
    )
  }

  const dot = <span className="text-foreground/40">·</span>

  return (
    <div
      className="flex h-svh flex-col overflow-hidden"
      onClick={() => {
        setLockedPulsar(null)
        setHoveredPulsar(null)
      }}
    >
      {/* Header */}
      <header className="shrink-0 px-4 pt-3 sm:px-6 sm:pt-4 flex items-start justify-between z-50">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-foreground">astrolabe</span>
          <div className="w-[240px]">
            <StarSearch stars={stars} selected={origin} onSelect={handleOriginChange} />
          </div>
        </div>
        {plaqueData && (
          <div className="flex gap-3 text-[10px] text-foreground/70 pt-0.5">
            <span>{plaqueData.pulsars.length} pulsars</span>
            {dot}
            <span>from {origin.name}</span>
            {dot}
            <span>{distToGC.toFixed(1)} kpc</span>
          </div>
        )}
        <div className="flex flex-col items-end gap-2 pt-0.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="text-[10px] text-foreground/70 hover:text-foreground transition cursor-pointer"
              title="about (?)"
            >
              about
            </button>
            <ThemeToggle />
            <ExportButton svgRef={svgRef} starName={origin.name} />
          </div>
          <div className="text-[9px] text-foreground/55 text-right leading-relaxed max-w-[230px] hidden sm:block">
            <div>
              <span className="text-foreground/80">●</span> observer · 14 selected pulsars
            </div>
            <div>line length = distance (kpc, linear)</div>
            <div>
              <span className="font-mono text-foreground/80">| −</span> period bits in hydrogen units
            </div>
            <div>
              <span className="text-foreground/80">→</span> fixed line = direction to GC
            </div>
            <div className="text-foreground/40 pt-1">
              hover · click to lock · click tooltip to copy
            </div>
            <div className="text-foreground/40">/ search · R random · ? about · Esc reset</div>
          </div>
        </div>
      </header>

      {/* Plaque */}
      <main className="flex-1 min-h-0 flex items-center justify-center px-4 relative" onClick={(e) => e.stopPropagation()}>
        {plaqueData && (
          <Plaque
            ref={svgRef}
            data={plaqueData}
            activePulsar={activePulsar}
            onHover={setHoveredPulsar}
            onClick={handlePulsarSelect}
          />
        )}
        {toast && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-foreground/10 backdrop-blur px-3 py-1 text-[10px] text-foreground border border-foreground/20 pointer-events-none">
            {toast}
          </div>
        )}
      </main>

      {infoOpen && (
        <div
          className="fixed inset-0 z-[100] bg-background/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 sm:p-8 overflow-y-auto"
          onClick={() => setInfoOpen(false)}
        >
          <div
            className="bg-background border border-foreground/20 max-w-2xl w-full p-6 sm:p-8 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <h2
                className="text-[20px] text-foreground leading-none"
                style={{ fontFamily: "var(--font-display)" }}
              >
                about astrolabe
              </h2>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="text-foreground/50 hover:text-foreground text-[14px] cursor-pointer leading-none"
                aria-label="close"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-foreground/70 leading-relaxed space-y-4">
              <p>
                A Pioneer/Voyager-style pulsar map generator. Pick any star in the
                galaxy and Astrolabe computes the 14 best pulsars for triangulating
                that position, rendered in the same line-art style Frank Drake and
                Carl Sagan used to encode humanity's address on the Pioneer plaques
                in 1972.
              </p>

              <div>
                <h3
                  className="text-foreground text-[12px] mb-1.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  what you're seeing
                </h3>
                <p>
                  The center dot is the observer — whichever star you've selected.
                  Each line radiating outward points to one of the 14 pulsars chosen
                  for that vantage point. Three pieces of information are encoded
                  in every line:
                </p>
                <ul className="list-none mt-2 space-y-1.5 pl-3">
                  <li>
                    <span className="text-foreground/90">direction</span> — the
                    pulsar's bearing in galactic coordinates, measured relative to
                    the long horizontal line on the right
                  </li>
                  <li>
                    <span className="text-foreground/90">length</span> — distance
                    from the observer to the pulsar, on a linear scale (kpc)
                  </li>
                  <li>
                    <span className="text-foreground/90">binary tick marks</span>{" "}
                    at the tip — the pulsar's spin period, written in binary using
                    the hydrogen 21-cm spin-flip transition (~0.7040 ns) as the
                    base unit. LSB nearest the observer, MSB at the tip
                    (Pioneer convention).
                  </li>
                </ul>
                <p className="mt-2">
                  The long horizontal line points to the galactic center (Sgr A*)
                  and stays fixed regardless of the observer. It's the universal
                  angular reference — any alien receiver can identify the GC by
                  its bright radio emission, so all pulsar angles on the map are
                  measured relative to it.
                </p>
              </div>

              <div>
                <h3
                  className="text-foreground text-[12px] mb-1.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  how the 14 pulsars are chosen
                </h3>
                <p>
                  Pulsars are picked using Geometric Dilution of Precision
                  (GDOP) — a metric borrowed from GPS theory that measures how
                  well a set of beacons can localize a position. The greedy
                  selector picks one pulsar at a time, balancing three objectives:
                </p>
                <ul className="list-none mt-2 space-y-1.5 pl-3">
                  <li>
                    <span className="text-foreground/90">quality (50%)</span> —
                    characteristic age (long-lived pulsars are more stable),
                    distance diversity, and spin-down stability
                  </li>
                  <li>
                    <span className="text-foreground/90">geometry (35%)</span> —
                    pulsars must span all directions to minimize positional
                    ambiguity (PDOP)
                  </li>
                  <li>
                    <span className="text-foreground/90">uniqueness (15%)</span>{" "}
                    — periods should be distinct enough that decoding isn't
                    ambiguous
                  </li>
                </ul>
              </div>

              <div>
                <h3
                  className="text-foreground text-[12px] mb-1.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  why pulsars
                </h3>
                <p>
                  Pulsars are nature's most precise clocks — their rotation
                  periods are stable to one part in 10<sup>15</sup> for the best
                  millisecond pulsars. A binary-encoded period uniquely
                  fingerprints a pulsar with no ambiguity, which makes them the
                  ideal cosmic landmarks. The original Pioneer plaque used 14
                  pulsars visible from Sol; Astrolabe extends the same idea to
                  any vantage point in the galaxy.
                </p>
              </div>

              <div>
                <h3
                  className="text-foreground text-[12px] mb-1.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  controls
                </h3>
                <ul className="list-none space-y-1 pl-3">
                  <li>
                    <span className="font-mono text-foreground/90">/</span> focus
                    search ·{" "}
                    <span className="font-mono text-foreground/90">R</span> random
                    star ·{" "}
                    <span className="font-mono text-foreground/90">?</span> this
                    panel ·{" "}
                    <span className="font-mono text-foreground/90">Esc</span>{" "}
                    close / reset
                  </li>
                  <li>
                    hover a pulsar line to see its info in the bottom-left corner
                  </li>
                  <li>
                    click a pulsar line to lock the selection — the info stays
                    even after the mouse moves away
                  </li>
                  <li>
                    click the bottom-left tooltip to copy the pulsar info
                    (PSR name, period, distance, l/b) to your clipboard
                  </li>
                  <li>
                    enter coordinates directly in the search box:{" "}
                    <span className="font-mono text-foreground/90">
                      l=120 b=-15 d=2.5
                    </span>{" "}
                    or{" "}
                    <span className="font-mono text-foreground/90">
                      ra=83.633 dec=22.014 d=2.0
                    </span>
                  </li>
                  <li>
                    use the export button to download the current map as PNG or
                    SVG
                  </li>
                </ul>
              </div>

              <div>
                <h3
                  className="text-foreground text-[12px] mb-1.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  data
                </h3>
                <p>
                  Pulsar positions, periods, and distances come from the{" "}
                  <a
                    href="https://www.atnf.csiro.au/research/pulsar/psrcat/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    ATNF Pulsar Catalogue
                  </a>{" "}
                  v2.7.0 (3,924 pulsars). Star positions for the local catalogue
                  (95 curated stars) and the SIMBAD fallback for any other
                  catalogued star are resolved via the CDS Sesame service. All
                  coordinates use the IAU J2000 galactic system.
                </p>
              </div>

              <div className="pt-2 text-[10px] text-foreground/50">
                made by{" "}
                <a
                  href="https://github.com/codeptor"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground transition"
                >
                  bhanu
                </a>
                {" · "}
                <a
                  href="https://github.com/codeptor/astrolabe"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground transition"
                >
                  source on github
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="shrink-0 px-4 pb-2 sm:pb-3 flex items-center justify-between">
        <div
          className={`h-[40px] flex-1 ${activePulsar ? "cursor-pointer" : ""}`}
          onClick={(e) => {
            e.stopPropagation()
            if (activePulsar) handlePulsarCopy(activePulsar)
          }}
        >
          <PulsarTooltip pulsar={activePulsar} />
        </div>
        <p className="text-[9px] text-foreground/50 shrink-0">
          ATNF v2.7.0 · {pulsars.length} pulsars
        </p>
      </footer>
    </div>
  )
}
