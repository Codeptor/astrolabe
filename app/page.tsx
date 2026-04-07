"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import type { Pulsar, Star, RelativePulsar, PlaqueData } from "@/lib/types"
import { selectPulsars } from "@/lib/pulsar-selection"
import { galacticCenterAngle } from "@/lib/coordinates"
import Plaque from "@/components/plaque"
import { StarSearch } from "@/components/star-search"
import { PulsarTooltip } from "@/components/pulsar-tooltip"
import { ExportButton } from "@/components/export-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { GC_DIST_KPC } from "@/lib/constants"

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
    return { origin, pulsars: selected, gcAngle }
  }, [pulsars, origin])

  const activePulsar = lockedPulsar ?? hoveredPulsar

  const distToGC = useMemo(() => {
    const o = origin
    const lRad = o.gl * (Math.PI / 180)
    const bRad = o.gb * (Math.PI / 180)
    const ox = o.dist * Math.cos(bRad) * Math.cos(lRad)
    const oy = o.dist * Math.cos(bRad) * Math.sin(lRad)
    const oz = o.dist * Math.sin(bRad)
    const dx = GC_DIST_KPC - ox
    const dy = 0 - oy
    const dz = 0 - oz
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }, [origin])

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
        setLockedPulsar(null)
        setOrigin(SOL)
      } else if (e.key === "r" || e.key === "R") {
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
  }, [stars, origin.name, handleOriginChange, showToast])

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
        <div className="flex items-center gap-3 pt-0.5">
          <ThemeToggle />
          <ExportButton svgRef={svgRef} starName={origin.name} />
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
