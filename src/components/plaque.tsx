import React, { forwardRef, useState, useCallback, useMemo, useEffect } from "react"
import type { PlaqueData, RelativePulsar } from "@/lib/types"
import { periodToTicks } from "@/lib/binary-encoding"
import { GC_DIST_KPC } from "@/lib/constants"

// Layout — 7yl4r/pulsarMap proportions:
//   GC at canvas.width - PAD, GC line length = 2/3 of canvas width
//   Earth at GC_X - GC_DIST_PX
const VB_W = 1700
const VB_H = 700
const PAD = 15
const GC_X = VB_W - PAD
const GC_Y = VB_H / 2
const GC_DIST_PX = Math.round(GC_X * 2 / 3)
const EARTH_X = GC_X - GC_DIST_PX
const EARTH_Y = GC_Y
const DEG = Math.PI / 180

// Visual params (scaled from 7yl4r values for 1200px canvas → our 1000px viewBox)
const LINE_W = 0.2 * VB_W / 1200       // 7yl4r: 0.2 for 1200px
const LINE_W_ACTIVE = LINE_W * 3
const EARTH_R = 2
const FONT_SIZE = Math.round(VB_W / 120) // 7yl4r: ~10px for 1200px
const LINE_HEIGHT = FONT_SIZE
const Y_SHIFT = -Math.round(VB_W / 600)  // 7yl4r: -2 for 1200px
const X_SHIFT = Math.round(VB_W / 240)   // 7yl4r: 5 for 1200px
const TRANSITION = "600ms cubic-bezier(0.16, 1, 0.3, 1)"
const GC_HIDE_THRESHOLD = 0.05

// Distance rings: kpc values to draw (capped at 4 kpc from observer)
const RING_DISTANCES_KPC = [1, 2, 3, 4]

// 7yl4r scaling: linear, dist as ratio of GC distance, then * GC_DIST_PX
const PX_PER_KPC = GC_DIST_PX / GC_DIST_KPC

function distToPixels(distKpc: number): number {
  return Math.max(distKpc * PX_PER_KPC, 4)
}

function pixelsToKpc(px: number): number {
  return px / PX_PER_KPC
}

// 7yl4r convention: period.toString(2).replace(/0/g, '-').replace(/1/g, '|')
// MSB first, drawn from line endpoint outward along the line direction.
function periodToBinaryString(p0: number): string {
  const ticks = periodToTicks(p0)
  return ticks.map((b) => (b === 1 ? "|" : "-")).join("")
}

// Polar to cartesian (angle in radians, SVG y-down)
function endpoint(angle: number, len: number): { x: number; y: number } {
  return {
    x: EARTH_X + Math.cos(angle) * len,
    y: EARTH_Y - Math.sin(angle) * len,
  }
}

// Max radial distance from EARTH to the padded viewBox edge in a given direction.
// Used to clamp the full line + binary text so nothing escapes the viewBox.
// Adds FONT_SIZE of inner padding to account for glyph ascenders/descenders
// extending perpendicular to the line direction — otherwise text at diagonal
// angles can pop above/below the viewBox edge even though the baseline is safe.
function maxRadialLen(angle: number): number {
  const cx = Math.cos(angle)
  const cy = -Math.sin(angle) // SVG y-down
  // Line-only clamp: only PAD of breathing room is needed now that the
  // binary text uses its own inward-flip rule; the old FONT_SIZE buffer
  // was reserving space the text no longer demands past the endpoint.
  const innerPad = PAD
  let len = Infinity
  if (cx > 1e-6) len = Math.min(len, (VB_W - innerPad - EARTH_X) / cx)
  if (cx < -1e-6) len = Math.min(len, (EARTH_X - innerPad) / -cx)
  if (cy > 1e-6) len = Math.min(len, (VB_H - innerPad - EARTH_Y) / cy)
  if (cy < -1e-6) len = Math.min(len, (EARTH_Y - innerPad) / -cy)
  return len
}

// Approximate width of a single binary character. Over-estimated on purpose:
// a bit too tight and long-period pulsars (~35 bit binary) pointed at narrow
// viewBox directions overflow the edge and get clipped in exports.
const CHAR_WIDTH = FONT_SIZE * 0.7

function binaryTextLen(bits: number): number {
  return X_SHIFT + bits * CHAR_WIDTH
}

interface PlaqueProps {
  data: PlaqueData
  activePulsar: RelativePulsar | null
  showRings: boolean
  onHover: (pulsar: RelativePulsar | null) => void
  onClick: (pulsar: RelativePulsar | null) => void
}

interface CursorReadout {
  angleDeg: number
  distKpc: number
}

function buildAriaSummary(data: PlaqueData): string {
  const { pulsars, origin, gcDist } = data
  const dists = pulsars.map((p) => p.dist)
  const minD = Math.min(...dists)
  const maxD = Math.max(...dists)
  const periods = pulsars.map((p) => p.pulsar.p0)
  const fastest = Math.min(...periods) * 1000
  const slowest = Math.max(...periods) * 1000
  return [
    `Pulsar map showing ${pulsars.length} pulsars from observer ${origin.name}.`,
    `Distance to galactic centre: ${gcDist.toFixed(1)} kiloparsecs.`,
    `Pulsar distances range from ${minD.toFixed(2)} to ${maxD.toFixed(2)} kiloparsecs.`,
    `Pulsar periods range from ${fastest.toFixed(1)} milliseconds to ${slowest.toFixed(0)} milliseconds.`,
  ].join(" ")
}

const Plaque = forwardRef<SVGSVGElement, PlaqueProps>(function Plaque(
  {
    data,
    activePulsar,
    showRings,
    onHover,
    onClick,
  },
  ref,
) {
  const { pulsars, gcAngle, gcDist } = data
  const [cursor, setCursor] = useState<CursorReadout | null>(null)

  // When the observer is at the galactic center, the GC reference line
  // becomes meaningless (you're at the point you'd be pointing to).
  const isAtGC = gcDist < GC_HIDE_THRESHOLD

  const ariaLabel = useMemo(() => buildAriaSummary(data), [data])

  // Pulsar discovery animation: when the pulsar list changes (new observer,
  // mode, or count), the lines fade in one at a time in selection order.
  // We track the count of "revealed" pulsars and increment it on a timer.
  const [reveal, setReveal] = useState(pulsars.length)
  const pulsarKey = useMemo(
    () => pulsars.map((p) => p.pulsar.name).join(","),
    [pulsars],
  )
  useEffect(() => {
    setReveal(0)
    const total = pulsars.length
    if (total === 0) return
    let i = 0
    const id = window.setInterval(() => {
      i++
      setReveal(i)
      if (i >= total) window.clearInterval(id)
    }, 80)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulsarKey])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const local = pt.matrixTransform(ctm.inverse())
    const dx = local.x - EARTH_X
    const dy = EARTH_Y - local.y
    const distPx = Math.sqrt(dx * dx + dy * dy)
    if (distPx < EARTH_R * 2) {
      setCursor(null)
      return
    }
    const angleRad = Math.atan2(dy, dx)
    let angleDeg = (angleRad * 180) / Math.PI
    if (angleDeg < 0) angleDeg += 360
    setCursor({ angleDeg, distKpc: pixelsToKpc(distPx) })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setCursor(null)
  }, [])

  // GC reference line endpoint — always at angle 0 (right) in plot frame.
  // Pulsar angles are rotated by -gcAngle below so the GC stays the fixed anchor.
  const gc = endpoint(0, GC_DIST_PX)

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <title>Astrolabe pulsar map from {data.origin.name}</title>
      <desc>{ariaLabel}</desc>

      {/* Distance scale rings (toggleable) */}
      {showRings && (
        <g style={{ pointerEvents: "none" }}>
          {RING_DISTANCES_KPC.map((kpc) => {
            const r = kpc * PX_PER_KPC
            if (r > GC_DIST_PX * 1.1) return null
            return (
              <g key={kpc}>
                <circle
                  cx={EARTH_X}
                  cy={EARTH_Y}
                  r={r}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth={1}
                  strokeDasharray="4 5"
                  opacity={0.35}
                />
                <text
                  x={EARTH_X}
                  y={EARTH_Y - r - 4}
                  textAnchor="middle"
                  fill="var(--foreground)"
                  opacity={0.6}
                  style={{
                    fontSize: "9px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {kpc} kpc
                </text>
              </g>
            )
          })}
        </g>
      )}

      {/* Galactic center reference line — hidden when observer is at GC */}
      {!isAtGC && (
        <g className="stroke-line" strokeWidth={LINE_W}>
          <line x1={EARTH_X} y1={EARTH_Y} x2={gc.x} y2={gc.y} />
          {/* GC marker — perpendicular cap tick centered on line endpoint */}
          <line
            x1={gc.x}
            y1={gc.y - FONT_SIZE * 0.6}
            x2={gc.x}
            y2={gc.y + FONT_SIZE * 0.6}
            className="stroke-line"
            strokeWidth={LINE_W * 3}
          />
        </g>
      )}

      {/* Pulsar lines.
          Each pulsar is a horizontal line in a rotated coordinate frame:
          a single <g> applies a CSS `translate(EARTH) rotate(rotDeg)` so
          (0, 0) sits at Earth and the local x-axis points along the line.
          The line is drawn from x=0 to x=totalLen and the binary period
          text sits at x=totalLen+X_SHIFT. CSS transitions the group's
          transform (rotation) plus the SVG `x2` / `x` geometry attributes,
          so when the time-machine slider drifts a pulsar the rotation,
          length, and binary code all animate together in one motion. */}
      {pulsars.map((rp, idx) => {
        const projDistKpc = rp.dist * Math.cos(rp.gb * DEG)
        const zKpc = Math.abs(rp.dist * Math.sin(rp.gb * DEG))

        const distPx = distToPixels(projDistKpc)
        const zPx = zKpc * PX_PER_KPC

        // GC stays fixed at angle 0 — rotate pulsars by -gcAngle around the observer
        const renderAngle = isAtGC ? rp.angle : rp.angle - gcAngle

        // 7yl4r approach: clamp only the LINE to the viewBox, then tweak the
        // binary text inward when the endpoint is near a viewBox edge. Keeps
        // the line's true length whenever geometrically possible, and only
        // shortens the digit tail to fit — which looks more faithful to the
        // original Pioneer plaque aesthetic than shrinking the whole line.
        const binaryStr = periodToBinaryString(rp.pulsar.p0)
        const textLen = binaryTextLen(binaryStr.length)
        const directionalMax = maxRadialLen(renderAngle)
        const lineLen = Math.min(distPx + zPx, directionalMax)

        // Endpoint in viewBox coordinates (SVG y is down — hence -sin).
        const endX = EARTH_X + Math.cos(renderAngle) * lineLen
        const endY = EARTH_Y - Math.sin(renderAngle) * lineLen

        // tweakBinaryPosition: flip the binary inward when the endpoint
        // doesn't have room for the digits past it. Threshold is the
        // actual digit width plus X_SHIFT, per-pulsar — so short codes
        // keep their outward placement longer than long codes.
        const edgeSlack = textLen + X_SHIFT
        const nearEdge =
          endY + edgeSlack > VB_H ||
          endY - edgeSlack < 0 ||
          endX - edgeSlack < 0 ||
          endX + edgeSlack > VB_W
        // In the rotated local frame the text is normally at `lineLen + X_SHIFT`
        // (after the endpoint). When the endpoint is near an edge we anchor
        // the text just BEFORE the endpoint so its right side lands on it.
        const textX = nearEdge ? lineLen - X_SHIFT - textLen : lineLen + X_SHIFT
        const hitStart = nearEdge ? textX : 0
        const hitEnd = nearEdge ? lineLen : textX + textLen

        const isActive = activePulsar?.pulsar.name === rp.pulsar.name
        const strokeClass = isActive ? "stroke-accent" : "stroke-line"
        const fillClass = isActive ? "fill-accent" : "fill-line"
        const w = isActive ? LINE_W_ACTIVE : LINE_W
        const isRevealed = idx < reveal

        // SVG rotate is CW, our angles are CCW math → negate
        const rotDeg = (-renderAngle * 180) / Math.PI

        return (
          <g
            key={rp.pulsar.name}
            style={{
              transform: `translate(${EARTH_X}px, ${EARTH_Y}px) rotate(${rotDeg}deg)`,
              transformOrigin: "0 0",
              transformBox: "view-box",
              transition: `transform ${TRANSITION}, opacity 240ms ease-out`,
              opacity: isRevealed ? 1 : 0,
            }}
            role="button"
            aria-label={`PSR ${rp.pulsar.name}, period ${(rp.pulsar.p0 * 1000).toFixed(2)} milliseconds, distance ${rp.dist.toFixed(2)} kiloparsecs`}
          >
            {/* Invisible hit area — spans line + binary text in local frame */}
            <line
              x1={hitStart}
              y1={0}
              x2={hitEnd}
              y2={0}
              stroke="transparent"
              strokeWidth={16}
              className="cursor-pointer"
              style={{ transition: `x1 ${TRANSITION}, x2 ${TRANSITION}` }}
              onMouseEnter={() => onHover(rp)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => {
                e.stopPropagation()
                onClick(isActive ? null : rp)
              }}
            />
            {/* Smooth line: distance + Z-offset, true length */}
            <line
              x1={0}
              y1={0}
              x2={lineLen}
              y2={0}
              strokeWidth={w}
              className={strokeClass}
              style={{
                pointerEvents: "none",
                transition: `x2 ${TRANSITION}, stroke-width 200ms ease-out`,
              }}
            />
            {/* Binary period text — at (textX, 0) in the rotated frame;
                lands after the endpoint normally, flipped inward when
                the endpoint is near a viewBox edge. textLength +
                lengthAdjust forces rendered width to match binaryTextLen(). */}
            <text
              x={textX}
              y={LINE_HEIGHT / 2 + Y_SHIFT}
              textLength={binaryStr.length * CHAR_WIDTH}
              lengthAdjust="spacingAndGlyphs"
              className={fillClass}
              style={{
                fontSize: `${FONT_SIZE}px`,
                fontFamily: "Asset, monospace",
                pointerEvents: "none",
                transition: `x ${TRANSITION}`,
              }}
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
