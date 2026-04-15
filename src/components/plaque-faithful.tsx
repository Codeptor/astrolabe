import { forwardRef, useMemo } from "react"
import type { PlaqueData, RelativePulsar } from "@/lib/types"
import { periodToTicks } from "@/lib/binary-encoding"
import { GC_DIST_KPC } from "@/lib/constants"

// ============================================================================
// Rendering logic ported from the Wikimedia Commons
// Voyager_Golden_Record_Cover_Explanation.svg (public domain; NASA original
// traced by BrianKrent in Inkscape, 2010 / 2015).
//
// The original trace contains 444 hand-placed <path> segments.  Reverse-
// engineered into these drawing rules so we can regenerate the map from any
// RelativePulsar[] data while keeping the exact visual style of the plaque.
//
// Primitives matched from the trace:
//   • all strokes are fill="none" stroke="#000000" stroke-width="0.8"
//     stroke-linecap="round"
//   • observer at origin (small filled dot, negligible radius)
//   • GC reference: long straight line from observer to GC direction,
//     terminated with a short perpendicular "cap" tick
//   • pulsar line: straight line from observer to endpoint =
//       (projectedDist × GC_DIST_PX_ON_PLATE) along galactic longitude
//   • binary period ticks: small perpendicular strokes starting just past
//     the endpoint, stepping OUTWARD along the line, one per bit, MSB first
//       - '1' bit = long tick  (~3 units)
//       - '0' bit = short tick (~0.8 units)
//       - ticks sit on the +perpendicular side of the line (Drake's
//         convention; in the rotated local frame that's +y in SVG's
//         y-down coord system)
//   • z-axis tick: short perpendicular at the endpoint itself, length
//     proportional to |z| as ratio of GC distance, sign sets which side
//
// Coordinates below are in plate units — the viewBox mirrors the Wikimedia
// subregion of interest (x ∈ [-50, 260], y ∈ [-110, 110]) with observer at
// the origin, so Tailwind/CSS currentColor tints the lines via the active
// theme.
// ============================================================================

const DEG = Math.PI / 180

// Plate-unit scale factors, sampled from the Wikimedia trace:
// In the source SVG, observer = (262.231, 434.684), GC endpoint =
// (472.121, 434.684) → GC line length = 209.89 plate units.  We keep
// that 1:1 so our binary/z tick sizes stay comparable to the engraving.
const GC_DIST_UNITS = 209.89

const STROKE_WIDTH = 0.8

// Bit-tick geometry (measured from the Wikimedia paths)
const BIT_LONG = 3.0   // "1" bit — height of the perpendicular stroke
const BIT_SHORT = 0.8  // "0" bit — shorter stroke
const BIT_STEP = 1.6   // horizontal (along-line) spacing between bits
const BIT_START_GAP = 1.2 // gap between line endpoint and first bit

const GC_CAP_LEN = 2.0 // vertical cap tick at the GC end
const OBSERVER_R = 1.3 // filled dot radius at observer

// Z-tick geometry — perpendicular to the line at the endpoint, length
// scales with |z| as a fraction of GC distance (same unit system as
// the main line lengths).  Capped so very out-of-plane pulsars don't
// produce gigantic ticks.
const Z_TICK_MAX = 24 // units
const Z_TICK_SCALE = GC_DIST_UNITS // same scale as line lengths

interface PlaqueFaithfulProps {
  data: PlaqueData
  activePulsar?: RelativePulsar | null
  lockedPulsar?: RelativePulsar | null
  onHover?: (rp: RelativePulsar | null) => void
  onClick?: (rp: RelativePulsar | null) => void
  /** When true, draw z-axis tick at each endpoint (default true) */
  showZTicks?: boolean
  /** When true, draw binary period ticks (default true) */
  showBinary?: boolean
}

interface LineGeom {
  rp: RelativePulsar
  /** Angle in radians — galactic longitude relative to GC (for display) */
  angle: number
  /** Line length in plate units */
  lineLen: number
  /** Z-projection tick length in plate units, signed by sin(gb) */
  zTick: number
  /** Bits of the period, MSB first */
  bits: number[]
}

const Plaque1972Faithful = forwardRef<SVGSVGElement, PlaqueFaithfulProps>(
  function Plaque1972Faithful(
    { data, activePulsar, lockedPulsar, onHover, onClick, showZTicks = true, showBinary = true },
    ref,
  ) {
    const { pulsars, gcAngle } = data

    const geoms = useMemo<LineGeom[]>(() => {
      return pulsars.map((rp) => {
        const gbRad = rp.gb * DEG
        const projDist = rp.dist * Math.cos(gbRad) // kpc
        const zKpc = rp.dist * Math.sin(gbRad)
        // Scale to plate units: treat kpc exactly as "ratio-of-GC" × GC_DIST_UNITS
        const projRatio = projDist / GC_DIST_KPC
        const lineLen = projRatio * GC_DIST_UNITS
        const zRaw = (zKpc / GC_DIST_KPC) * Z_TICK_SCALE
        const zTick = Math.max(-Z_TICK_MAX, Math.min(Z_TICK_MAX, zRaw))
        const angle = rp.angle - gcAngle // make GC direction = 0 like the plaque
        const bits = periodToTicks(rp.pulsar.p0)
        return { rp, angle, lineLen, zTick, bits }
      })
    }, [pulsars, gcAngle])

    // viewBox chosen to contain: GC line out to ~GC_DIST_UNITS on +x, and
    // pulsars spreading roughly GC_DIST_UNITS in all other directions, plus
    // room for binary ticks past each endpoint.
    const PAD = 60
    const VB = {
      x: -GC_DIST_UNITS - PAD,
      y: -GC_DIST_UNITS / 2 - PAD,
      w: 2 * GC_DIST_UNITS + 2 * PAD,
      h: GC_DIST_UNITS + 2 * PAD,
    }

    return (
      <svg
        ref={ref}
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`Pioneer-style pulsar map rendered faithfully from ${data.origin.name}`}
      >
        <title>Pioneer-faithful plaque from {data.origin.name}</title>

        {/* Observer dot */}
        <circle cx={0} cy={0} r={OBSERVER_R} fill="currentColor" />

        {/* Galactic-centre reference line (always at angle 0, the x-axis) */}
        <g
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          fill="none"
        >
          <line x1={0} y1={0} x2={GC_DIST_UNITS} y2={0} />
          <line
            x1={GC_DIST_UNITS}
            y1={-GC_CAP_LEN}
            x2={GC_DIST_UNITS}
            y2={GC_CAP_LEN}
          />
        </g>

        {/* Pulsar radial lines + ticks */}
        {geoms.map((g) => {
          const isActive = activePulsar?.pulsar.name === g.rp.pulsar.name
          const isLocked = lockedPulsar?.pulsar.name === g.rp.pulsar.name
          // Each pulsar lives in its own rotated frame: local +x points
          // along the line from observer to endpoint.  That makes every
          // tick computation a simple (x, ±y) — no trig per bit.
          const rotDeg = (-g.angle * 180) / Math.PI // SVG rotate is CW, our angles CCW → negate
          return (
            <g
              key={g.rp.pulsar.name}
              transform={`rotate(${rotDeg})`}
              role={onClick ? "button" : undefined}
              aria-label={`PSR ${g.rp.pulsar.name}`}
              style={isActive ? { color: "var(--color-accent, currentColor)" } : undefined}
            >
              {/* Invisible fat hit-line for hover/click (skipped if no handlers) */}
              {(onHover || onClick) && (
                <line
                  x1={0}
                  y1={0}
                  x2={g.lineLen + g.bits.length * BIT_STEP + BIT_START_GAP + 2}
                  y2={0}
                  stroke="transparent"
                  strokeWidth={Math.max(8, BIT_LONG * 2)}
                  style={{ cursor: onClick ? "pointer" : undefined }}
                  onMouseEnter={() => onHover?.(g.rp)}
                  onMouseLeave={() => onHover?.(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!onClick) return
                    onClick(isLocked ? null : g.rp)
                  }}
                />
              )}

              {/* Visible radial line */}
              <line
                x1={0}
                y1={0}
                x2={g.lineLen}
                y2={0}
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                fill="none"
              />

              {/* z-axis tick at endpoint — perpendicular, signed by z */}
              {showZTicks && g.zTick !== 0 && (
                <line
                  x1={g.lineLen}
                  y1={0}
                  x2={g.lineLen}
                  y2={-g.zTick}
                  stroke="currentColor"
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  fill="none"
                />
              )}

              {/* Binary period ticks — MSB nearest endpoint, LSB outward */}
              {showBinary &&
                g.bits.map((bit, i) => {
                  const x = g.lineLen + BIT_START_GAP + i * BIT_STEP
                  const h = bit === 1 ? BIT_LONG : BIT_SHORT
                  return (
                    <line
                      key={i}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={h}
                      stroke="currentColor"
                      strokeWidth={STROKE_WIDTH}
                      strokeLinecap="round"
                      fill="none"
                    />
                  )
                })}
            </g>
          )
        })}
      </svg>
    )
  },
)

export default Plaque1972Faithful
