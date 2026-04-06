import React, { forwardRef } from "react"
import type { PlaqueData, RelativePulsar } from "@/lib/types"
import { periodToTicks } from "@/lib/binary-encoding"

const CENTER = 300
const LINE_START_OFFSET = 12
const MAX_RADIUS = 600 * 0.42
const GC_LINE_RADIUS = 600 * 0.48
const TRANSITION = "600ms cubic-bezier(0.16, 1, 0.3, 1)"

interface PlaqueProps {
  data: PlaqueData
  activePulsar: RelativePulsar | null
  onHover: (pulsar: RelativePulsar | null) => void
  onClick: (pulsar: RelativePulsar | null) => void
}

function lineLength(dist: number, maxDist: number): number {
  return LINE_START_OFFSET + (Math.log1p(dist) / Math.log1p(maxDist)) * (MAX_RADIUS - LINE_START_OFFSET)
}

function buildTickMarks(
  angle: number,
  length: number,
  ticks: (0 | 1)[],
): React.ReactNode[] {
  const n = ticks.length
  if (n === 0) return []

  const dx = Math.cos(angle)
  const dy = -Math.sin(angle)
  // perpendicular direction
  const px = Math.sin(angle)
  const py = Math.cos(angle)

  const spacing = (length - LINE_START_OFFSET) / (n + 1)
  const marks: React.ReactNode[] = []

  for (let i = 0; i < n; i++) {
    const t = LINE_START_OFFSET + spacing * (i + 1)
    const cx = CENTER + dx * t
    const cy = CENTER + dy * t
    const halfLen = ticks[i] === 1 ? 3 : 1.5
    marks.push(
      <line
        key={i}
        x1={cx - px * halfLen}
        y1={cy - py * halfLen}
        x2={cx + px * halfLen}
        y2={cy + py * halfLen}
        style={{ transition: TRANSITION }}
      />
    )
  }
  return marks
}

const Plaque = forwardRef<SVGSVGElement, PlaqueProps>(function Plaque(
  { data, activePulsar, onHover, onClick },
  ref
) {
  const { pulsars, gcAngle } = data

  const maxDist = pulsars.reduce((m, rp) => Math.max(m, rp.dist), 0) || 1

  const gcDx = Math.cos(gcAngle)
  const gcDy = -Math.sin(gcAngle)
  const gcX = CENTER + gcDx * GC_LINE_RADIUS
  const gcY = CENTER + gcDy * GC_LINE_RADIUS

  return (
    <svg
      ref={ref}
      viewBox="0 0 600 600"
      className="w-full max-w-[600px] aspect-square"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Galactic center reference line */}
      <line
        x1={CENTER}
        y1={CENTER}
        x2={gcX}
        y2={gcY}
        className="stroke-line"
        strokeWidth={0.75}
        strokeDasharray="4 4"
        style={{ transition: TRANSITION }}
      />

      {/* Pulsar lines */}
      {pulsars.map((rp) => {
        const len = lineLength(rp.dist, maxDist)
        const dx = Math.cos(rp.angle)
        const dy = -Math.sin(rp.angle)
        const x2 = CENTER + dx * len
        const y2 = CENTER + dy * len
        const isActive = activePulsar?.pulsar.name === rp.pulsar.name
        const ticks = periodToTicks(rp.pulsar.p0)

        return (
          <g key={rp.pulsar.name}>
            {/* Invisible hit area */}
            <line
              x1={CENTER + dx * LINE_START_OFFSET}
              y1={CENTER + dy * LINE_START_OFFSET}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={12}
              className="cursor-pointer"
              onMouseEnter={() => onHover(rp)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClick(isActive ? null : rp)}
            />
            {/* Visible line */}
            <line
              x1={CENTER + dx * LINE_START_OFFSET}
              y1={CENTER + dy * LINE_START_OFFSET}
              x2={x2}
              y2={y2}
              strokeWidth={isActive ? 1.5 : 1}
              className={isActive ? "stroke-accent" : "stroke-line"}
              style={{ transition: TRANSITION, pointerEvents: "none" }}
            />
            {/* Binary tick marks */}
            <g
              className={isActive ? "stroke-accent" : "stroke-line"}
              strokeWidth={0.8}
              style={{ transition: TRANSITION, pointerEvents: "none" }}
            >
              {buildTickMarks(rp.angle, len, ticks)}
            </g>
          </g>
        )
      })}

      {/* Center dot */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={3}
        className="fill-line stroke-none"
        style={{ transition: TRANSITION }}
      />
    </svg>
  )
})

export default Plaque
