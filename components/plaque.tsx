import React, { forwardRef, useState, useCallback } from "react"
import type { PlaqueData, RelativePulsar } from "@/lib/types"
import { periodToTicks } from "@/lib/binary-encoding"
import { GC_DIST_KPC } from "@/lib/constants"

// Layout: matches reference repo proportions
const VB_W = 1000
const VB_H = 700
const PAD = 50
const EARTH_X = Math.round(VB_W * 0.35) // origin ~1/3 from left
const EARTH_Y = VB_H / 2
const GC_X = VB_W - PAD // galactic center marker at right edge
const GC_DIST_PX = GC_X - EARTH_X // pixel length = scale reference
const DEG = Math.PI / 180

// Visual params
const LINE_W = 0.3
const LINE_W_ACTIVE = 0.5
const EARTH_R = 2.5
const TRANSITION = "600ms cubic-bezier(0.16, 1, 0.3, 1)"
const FONT_SIZE = 7 // for binary text
const BINARY_OFFSET = 4 // gap between line end and binary text start

interface PlaqueProps {
  data: PlaqueData
  activePulsar: RelativePulsar | null
  onHover: (pulsar: RelativePulsar | null) => void
  onClick: (pulsar: RelativePulsar | null) => void
}

// Linear scaling: pixels per kpc, same scale as GC reference line
const PX_PER_KPC = GC_DIST_PX / GC_DIST_KPC
const MAX_LINE = Math.min(EARTH_Y - PAD, EARTH_X - PAD) * 0.85

function distToPixels(distKpc: number): number {
  return Math.min(Math.max(distKpc * PX_PER_KPC, 10), MAX_LINE)
}

function periodToBinaryString(p0: number): string {
  const ticks = periodToTicks(p0)
  // Pioneer convention: LSB nearest to origin, MSB at tip
  return [...ticks].reverse().map((b) => (b === 1 ? "|" : "-")).join("")
}

// Polar to cartesian (angle in radians, SVG y-down)
function endpoint(angle: number, len: number): { x: number; y: number } {
  return {
    x: EARTH_X + Math.cos(angle) * len,
    y: EARTH_Y - Math.sin(angle) * len,
  }
}

interface CursorReadout {
  angleDeg: number // 0..360
  distKpc: number
}

const Plaque = forwardRef<SVGSVGElement, PlaqueProps>(function Plaque(
  { data, activePulsar, onHover, onClick },
  ref,
) {
  const { pulsars, gcAngle } = data
  const [cursor, setCursor] = useState<CursorReadout | null>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const local = pt.matrixTransform(ctm.inverse())
    const dx = local.x - EARTH_X
    const dy = EARTH_Y - local.y // SVG y-down → math y-up
    const distPx = Math.sqrt(dx * dx + dy * dy)
    if (distPx < EARTH_R * 2) {
      setCursor(null)
      return
    }
    const angleRad = Math.atan2(dy, dx)
    let angleDeg = (angleRad * 180) / Math.PI
    if (angleDeg < 0) angleDeg += 360
    setCursor({ angleDeg, distKpc: distPx / PX_PER_KPC })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setCursor(null)
    onHover(null)
  }, [onHover])

  // GC line endpoint
  const gc = endpoint(gcAngle, GC_DIST_PX)

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Galactic center reference line — longest, no binary */}
      <g className="stroke-line" strokeWidth={LINE_W}>
        <line x1={EARTH_X} y1={EARTH_Y} x2={gc.x} y2={gc.y} />
        {/* GC tick mark at tip — confirms z=0 */}
        <line
          x1={gc.x}
          y1={gc.y - 4}
          x2={gc.x}
          y2={gc.y + 4}
          style={{ transition: TRANSITION }}
        />
      </g>

      {/* Pulsar lines */}
      {pulsars.map((rp) => {
        // Three-part line structure (Pioneer convention, reading outward):
        //   1. Smooth line: projected distance in galactic plane
        //   2. Smooth segment: Z-offset (height above/below plane)
        //   3. Binary text: period encoding (| and -)
        const projDistKpc = rp.dist * Math.cos(rp.gb * DEG)
        const zKpc = Math.abs(rp.dist * Math.sin(rp.gb * DEG))

        const distPx = distToPixels(projDistKpc)
        const zPx = Math.min(zKpc * PX_PER_KPC, MAX_LINE * 0.3)
        const totalLen = Math.min(distPx + zPx, MAX_LINE)

        const end = endpoint(rp.angle, totalLen)
        const isActive = activePulsar?.pulsar.name === rp.pulsar.name
        const binaryStr = periodToBinaryString(rp.pulsar.p0)
        const strokeClass = isActive ? "stroke-accent" : "stroke-line"
        const fillClass = isActive ? "fill-accent" : "fill-line"
        const w = isActive ? LINE_W_ACTIVE : LINE_W

        // SVG rotation: convert math angle to SVG degrees (clockwise)
        const rotDeg = (-rp.angle * 180) / Math.PI

        // Binary text starts after the full smooth line (distance + Z)
        const textEnd = endpoint(rp.angle, totalLen + BINARY_OFFSET)

        return (
          <g key={rp.pulsar.name} style={{ transition: TRANSITION }}>
            {/* Invisible hit area — hover persists until SVG mouse leave */}
            <line
              x1={EARTH_X}
              y1={EARTH_Y}
              x2={end.x}
              y2={end.y}
              stroke="transparent"
              strokeWidth={16}
              className="cursor-pointer"
              onMouseEnter={() => onHover(rp)}
              onClick={(e) => {
                e.stopPropagation()
                onClick(isActive ? null : rp)
              }}
            />
            {/* Visible line: distance + Z-offset as one smooth segment */}
            <line
              x1={EARTH_X}
              y1={EARTH_Y}
              x2={end.x}
              y2={end.y}
              strokeWidth={w}
              className={strokeClass}
              style={{ pointerEvents: "none" }}
            />
            {/* Binary period text — rotated to align with line */}
            <text
              x={textEnd.x}
              y={textEnd.y}
              transform={`rotate(${rotDeg}, ${textEnd.x}, ${textEnd.y})`}
              className={fillClass}
              style={{
                fontSize: `${FONT_SIZE}px`,
                fontFamily: "var(--font-mono)",
                letterSpacing: "-0.5px",
                pointerEvents: "none",
              }}
              textAnchor="start"
              dominantBaseline="central"
            >
              {binaryStr}
            </text>
          </g>
        )
      })}

      {/* Earth dot */}
      <circle
        cx={EARTH_X}
        cy={EARTH_Y}
        r={EARTH_R}
        className="fill-line stroke-none"
      />

      {/* Cursor coordinate readout (bottom-right) */}
      {cursor && (
        <g style={{ pointerEvents: "none" }}>
          <text
            x={VB_W - PAD}
            y={VB_H - PAD * 0.5}
            className="fill-foreground"
            style={{
              fontSize: "9px",
              fontFamily: "var(--font-mono)",
              opacity: 0.7,
            }}
            textAnchor="end"
            dominantBaseline="auto"
          >
            θ {cursor.angleDeg.toFixed(0)}° · d {cursor.distKpc.toFixed(2)} kpc
          </text>
        </g>
      )}
    </svg>
  )
})

export default Plaque
