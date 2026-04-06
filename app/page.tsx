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

const SOL: Star = { name: "Sol", gl: 0, gb: 0, dist: 0, aliases: ["Sun", "Earth"] }
const GC_DIST = 8.178

export default function Page() {
  const [pulsars, setPulsars] = useState<Pulsar[]>([])
  const [stars, setStars] = useState<Star[]>([])
  const [origin, setOrigin] = useState<Star | { name: string; gl: number; gb: number; dist: number; aliases?: string[] }>(SOL)
  const [hoveredPulsar, setHoveredPulsar] = useState<RelativePulsar | null>(null)
  const [lockedPulsar, setLockedPulsar] = useState<RelativePulsar | null>(null)
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
    const dx = GC_DIST - ox
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

  if (pulsars.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted text-[10px] animate-pulse">loading catalogue...</p>
      </div>
    )
  }

  const dot = <span className="text-foreground/20">·</span>

  return (
    <div
      className="flex min-h-svh flex-col"
      onClick={() => setLockedPulsar(null)}
    >
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-6 flex items-center justify-between">
        <span className="text-[11px] text-muted">astrolabe</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <ExportButton svgRef={svgRef} starName={origin.name} />
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pt-16 pb-12">
        <div className="w-full max-w-[260px] mb-4">
          <StarSearch stars={stars} selected={origin} onSelect={handleOriginChange} />
        </div>

        {plaqueData && (
          <>
            <div className="mb-6 flex gap-3 text-[10px] text-muted">
              <span>{plaqueData.pulsars.length} pulsars</span>
              {dot}
              <span>from {origin.name}</span>
              {dot}
              <span>{distToGC.toFixed(1)} kpc</span>
            </div>

            <div className="w-full max-w-[600px]" onClick={(e) => e.stopPropagation()}>
              <Plaque
                ref={svgRef}
                data={plaqueData}
                activePulsar={activePulsar}
                onHover={setHoveredPulsar}
                onClick={setLockedPulsar}
              />
            </div>

            <div className="mt-6 h-[60px] text-center">
              <PulsarTooltip pulsar={activePulsar} />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed inset-x-0 bottom-0 px-4 pb-4 sm:pb-6">
        <p className="text-center text-[9px] text-muted/60">
          data: ATNF Pulsar Catalogue v2.7.0 · {pulsars.length} pulsars
        </p>
      </footer>
    </div>
  )
}
