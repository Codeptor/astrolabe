import React, { forwardRef, memo, useState, useCallback, useMemo, useEffect } from "react"
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

// Cached binary encoding — the set of distinct p0 values across the catalogue
// is small and a pulsar's string doesn't change between renders, so caching
// per-p0 avoids repeating the BigInt conversion on every hover/zoom/pan.
const binaryStringCache = new Map<number, string>()

function periodToBinaryString(p0: number): string {
  const hit = binaryStringCache.get(p0)
  if (hit !== undefined) return hit
  const ticks = periodToTicks(p0)
  let out = ""
  for (let i = 0; i < ticks.length; i++) out += ticks[i] === 1 ? "|" : "-"
  if (binaryStringCache.size > 8192) binaryStringCache.clear()
  binaryStringCache.set(p0, out)
  return out
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
  const innerPad = PAD + FONT_SIZE
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

export interface CursorReadout {
  angleDeg: number
  distKpc: number
}

interface PlaqueProps {
  data: PlaqueData
  activePulsar: RelativePulsar | null
  lockedPulsar: RelativePulsar | null
  showRings: boolean
  onHover: (pulsar: RelativePulsar | null) => void
  onClick: (pulsar: RelativePulsar | null) => void
  onCursor?: (cursor: CursorReadout | null) => void
}

function buildAriaSummary(data: PlaqueData): string {
  const { pulsars, origin, gcDist } = data
  let minD = Infinity
  let maxD = -Infinity
  let minP = Infinity
  let maxP = -Infinity
  for (const rp of pulsars) {
    if (rp.dist < minD) minD = rp.dist
    if (rp.dist > maxD) maxD = rp.dist
    const p = rp.pulsar.p0
    if (p < minP) minP = p
    if (p > maxP) maxP = p
  }
  return [
    `Pulsar map showing ${pulsars.length} pulsars from observer ${origin.name}.`,
    `Distance to galactic centre: ${gcDist.toFixed(1)} kiloparsecs.`,
    `Pulsar distances range from ${minD.toFixed(2)} to ${maxD.toFixed(2)} kiloparsecs.`,
    `Pulsar periods range from ${(minP * 1000).toFixed(1)} milliseconds to ${(maxP * 1000).toFixed(0)} milliseconds.`,
  ].join(" ")
}

// One pulsar line + text + hit-rect. Memoized so hover on a neighbour doesn't
// re-render every line — only the one whose `isActive` actually flips.
interface PulsarLineProps {
  rp: RelativePulsar
  isActive: boolean
  renderAngle: number
  onHover: (pulsar: RelativePulsar | null) => void
  onClick: (pulsar: RelativePulsar) => void
  revealed: boolean
}

const PulsarLine = memo(function PulsarLine({
  rp,
  isActive,
  renderAngle,
  onHover,
  onClick,
  revealed,
}: PulsarLineProps) {
  const binaryStr = periodToBinaryString(rp.pulsar.p0)
  const textLen = binaryTextLen(binaryStr.length)
  const directionalMax = maxRadialLen(renderAngle)
  const maxLineLen = Math.max(directionalMax - textLen, 0)

  const projDistKpc = rp.dist * Math.cos(rp.gb * DEG)
  const zKpc = Math.abs(rp.dist * Math.sin(rp.gb * DEG))
  const distPx = distToPixels(projDistKpc)
  const zPx = zKpc * PX_PER_KPC
  const totalLen = Math.min(distPx + zPx, maxLineLen)

  const strokeClass = isActive ? "stroke-accent" : "stroke-line"
  const fillClass = isActive ? "fill-accent" : "fill-line"
  const w = isActive ? LINE_W_ACTIVE : LINE_W

  // SVG rotate is CW, our angles are CCW math → negate
  const rotDeg = (-renderAngle * 180) / Math.PI
  const hitLen = totalLen + binaryStr.length * CHAR_WIDTH

  return (
    <g
      style={{
        transform: `translate(${EARTH_X}px, ${EARTH_Y}px) rotate(${rotDeg}deg)`,
        transformOrigin: "0 0",
        transformBox: "view-box",
        transition: `transform ${TRANSITION}, opacity 240ms ease-out`,
        opacity: revealed ? 1 : 0,
      }}
      role="button"
      aria-label={`PSR ${rp.pulsar.name}, period ${(rp.pulsar.p0 * 1000).toFixed(2)} milliseconds, distance ${rp.dist.toFixed(2)} kiloparsecs`}
    >
      {/* Invisible hit area — covers smooth line + binary text width */}
      <line
        x1={0}
        y1={0}
        x2={hitLen}
        y2={0}
        stroke="transparent"
        strokeWidth={16}
        className="cursor-pointer"
        style={{ transition: `x2 ${TRANSITION}` }}
        onMouseEnter={() => onHover(rp)}
        onMouseLeave={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          onClick(rp)
        }}
      />
      {/* Smooth line: distance + Z-offset */}
      <line
        x1={0}
        y1={0}
        x2={totalLen}
        y2={0}
        strokeWidth={w}
        className={strokeClass}
        style={{
          pointerEvents: "none",
          transition: `x2 ${TRANSITION}, stroke-width 200ms ease-out`,
        }}
      />
      {/* Binary period text — sits at (totalLen + X_SHIFT, 0) in the
          rotated frame so it rides the line endpoint as it moves. */}
      <text
        x={totalLen + X_SHIFT}
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
})

const Plaque = forwardRef<SVGSVGElement, PlaqueProps>(function Plaque(
  {
    data,
    activePulsar,
    lockedPulsar: _lockedPulsar,
    showRings,
    onHover,
    onClick,
    onCursor,
  },
  ref,
) {
  const { pulsars, gcAngle, gcDist } = data

  // When the observer is at the galactic center, the GC reference line
  // becomes meaningless (you're at the point you'd be pointing to).
  const isAtGC = gcDist < GC_HIDE_THRESHOLD

  const ariaLabel = useMemo(() => buildAriaSummary(data), [data])

  // Pulsar discovery animation: when the pulsar list changes (new observer,
  // mode, or count), the lines fade in one at a time in selection order.
  // Reveal count is tracked with a ref so the timer doesn't race with render.
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

  // Stable click handler so PulsarLine memo doesn't break on every render.
  const onLineClick = useCallback(
    (rp: RelativePulsar) => {
      const isLocked = _lockedPulsar?.pulsar.name === rp.pulsar.name
      onClick(isLocked ? null : rp)
    },
    [onClick, _lockedPulsar],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onCursor) return
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
        onCursor(null)
        return
      }
      const angleRad = Math.atan2(dy, dx)
      let angleDeg = (angleRad * 180) / Math.PI
      if (angleDeg < 0) angleDeg += 360
      onCursor({ angleDeg, distKpc: pixelsToKpc(distPx) })
    },
    [onCursor],
  )

  const handleMouseLeave = useCallback(() => {
    onCursor?.(null)
  }, [onCursor])

  // GC reference line endpoint — always at angle 0 (right) in plot frame.
  // Pulsar angles are rotated by -gcAngle below so the GC stays the fixed anchor.
  const gc = endpoint(0, GC_DIST_PX)

  // Clear the active pulsar and hover when clicking empty SVG space.
  const onSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement | SVGRectElement>) => {
      if (e.target === e.currentTarget) {
        e.stopPropagation()
        onClick(null)
      }
    },
    [onClick],
  )

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
      onClick={onSvgClick}
    >
      <title>Astrolabe pulsar map from {data.origin.name}</title>
      <desc>{ariaLabel}</desc>

      {/* Background hit-rect so clicks anywhere off a pulsar still unlock.
          Uses the same handler as the bare-SVG click so there's no duplicate
          pathway — hitting the rect unlocks, hitting a pulsar's hit-line
          stops propagation and selects. */}
      <rect
        x={0}
        y={0}
        width={VB_W}
        height={VB_H}
        fill="transparent"
        onClick={onSvgClick}
      />

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

      {/* Pulsar lines — each is a memoized <PulsarLine>, so hovering one line
          doesn't re-render the rest. */}
      {pulsars.map((rp, idx) => {
        // GC stays fixed at angle 0 — rotate pulsars by -gcAngle around the observer
        const renderAngle = isAtGC ? rp.angle : rp.angle - gcAngle
        const isActive = activePulsar?.pulsar.name === rp.pulsar.name
        return (
          <PulsarLine
            key={rp.pulsar.name}
            rp={rp}
            isActive={isActive}
            renderAngle={renderAngle}
            onHover={onHover}
            onClick={onLineClick}
            revealed={idx < reveal}
          />
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

// Default export is memoized so identical data/activePulsar/etc refs skip the render.
export default memo(Plaque)
