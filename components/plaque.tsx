import React, { forwardRef, useMemo } from "react"
import type { PlaqueData, RelativePulsar } from "@/lib/types"
import { periodToTicks } from "@/lib/binary-encoding"

// Layout: matches reference repo proportions (1200x800 → 900x560)
const VB_W = 1000
const VB_H = 700
const PAD = 50
const EARTH_X = Math.round(VB_W * 0.35) // origin ~1/3 from left
const EARTH_Y = VB_H / 2
const GC_X = VB_W - PAD // galactic center marker at right edge
const GC_DIST_PX = GC_X - EARTH_X // pixel length = scale reference
const GC_DIST_KPC = 8.178

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

// Convert pulsar distance to pixel length — sqrt scaling for visual spread
// Capped so lines + binary text stay within viewBox
const MAX_LINE = Math.min(EARTH_Y - PAD, EARTH_X - PAD) * 0.85 // max reach in any direction

function distToPixels(distKpc: number): number {
  const ratio = distKpc / GC_DIST_KPC
  return Math.min(Math.max(Math.sqrt(ratio) * GC_DIST_PX, 10), MAX_LINE)
}

// Convert period to binary string with | and -
function periodToBinaryString(p0: number): string {
  const ticks = periodToTicks(p0)
  // Show up to 20 most significant bits
  const display = ticks.slice(0, 20)
  return display.map((b) => (b === 1 ? "|" : "-")).join("")
}

// Polar to cartesian (angle in radians, SVG y-down)
function endpoint(angle: number, len: number): { x: number; y: number } {
  return {
    x: EARTH_X + Math.cos(angle) * len,
    y: EARTH_Y - Math.sin(angle) * len,
  }
}

const Plaque = forwardRef<SVGSVGElement, PlaqueProps>(function Plaque(
  { data, activePulsar, onHover, onClick },
  ref,
) {
  const { pulsars, gcAngle } = data

  // GC line endpoint
  const gc = endpoint(gcAngle, GC_DIST_PX)

  // Rotation angle for SVG (degrees, clockwise from horizontal right)
  // SVG rotate is clockwise, our angles are CCW from right
  const gcRotDeg = (-gcAngle * 180) / Math.PI

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
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
        const len = distToPixels(rp.dist)
        const end = endpoint(rp.angle, len)
        const isActive = activePulsar?.pulsar.name === rp.pulsar.name
        const binaryStr = periodToBinaryString(rp.pulsar.p0)
        const strokeClass = isActive ? "stroke-accent" : "stroke-line"
        const fillClass = isActive ? "fill-accent" : "fill-line"
        const w = isActive ? LINE_W_ACTIVE : LINE_W

        // SVG rotation: convert math angle to SVG degrees (clockwise)
        const rotDeg = (-rp.angle * 180) / Math.PI

        // Binary text position: at the endpoint, extending outward along the line
        const textEnd = endpoint(rp.angle, len + BINARY_OFFSET)

        return (
          <g key={rp.pulsar.name} style={{ transition: TRANSITION }}>
            {/* Invisible hit area */}
            <line
              x1={EARTH_X}
              y1={EARTH_Y}
              x2={end.x}
              y2={end.y}
              stroke="transparent"
              strokeWidth={16}
              className="cursor-pointer"
              onMouseEnter={() => onHover(rp)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClick(isActive ? null : rp)}
            />
            {/* Visible line */}
            <line
              x1={EARTH_X}
              y1={EARTH_Y}
              x2={end.x}
              y2={end.y}
              strokeWidth={w}
              className={strokeClass}
              style={{ pointerEvents: "none" }}
            />
            {/* Binary period text — rotated to align with line, placed at endpoint */}
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
    </svg>
  )
})

export default Plaque
