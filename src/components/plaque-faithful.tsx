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
// Engraved encoding: 1-bit = short perpendicular tick ("|"), 0-bit = short
// inline dash along the line's outward continuation ("-").  Both occupy
// the same along-line slot so the binary reads like a row of characters.
const BIT_LONG = 1.8        // "1" perpendicular tick — full height
const BIT_INLINE_LEN = 0.9  // "0" inline dash — length along line
const BIT_STEP = 1.1        // along-line spacing between bit centres
const BIT_START_GAP = 0.8   // gap between line endpoint and first bit centre

const GC_CAP_LEN = 2.0 // vertical cap tick at the GC end
const OBSERVER_R = 1.3 // filled dot radius at observer


interface PlaqueFaithfulProps {
  data: PlaqueData
  activePulsar?: RelativePulsar | null
  lockedPulsar?: RelativePulsar | null
  onHover?: (rp: RelativePulsar | null) => void
  onClick?: (rp: RelativePulsar | null) => void
  /** When true, draw binary period ticks (default true) */
  showBinary?: boolean
}

interface LineGeom {
  rp: RelativePulsar
  /** Angle in radians — galactic longitude relative to GC (for display) */
  angle: number
  /** Line length in plate units */
  lineLen: number
  /** Bits of the period, MSB first */
  bits: number[]
}

const Plaque1972Faithful = forwardRef<SVGSVGElement, PlaqueFaithfulProps>(
  function Plaque1972Faithful(
    { data, activePulsar, lockedPulsar, onHover, onClick, showBinary = true },
    ref,
  ) {
    const { pulsars, gcAngle } = data

    const geoms = useMemo<LineGeom[]>(() => {
      return pulsars.map((rp) => {
        // Drake used projected (galactic-plane) distance for line length;
        // the out-of-plane z-component is simply discarded — the engraving
        // has no marker for it.  Pulsars were picked close-to-plane in 1972
        // so the loss was tolerable.
        const projDist = rp.dist * Math.cos(rp.gb * DEG) // kpc
        const projRatio = projDist / GC_DIST_KPC
        const lineLen = projRatio * GC_DIST_UNITS
        const angle = rp.angle - gcAngle // make GC direction = 0 like the plaque
        const bits = periodToTicks(rp.pulsar.p0)
        return { rp, angle, lineLen, bits }
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

              {/* Binary period ticks — MSB nearest endpoint, LSB outward.
                  1-bit ("|"): short perpendicular tick centred on line.
                  0-bit ("-"): short inline dash along the line direction.
                  Both occupy one BIT_STEP slot so the binary reads like
                  engraved characters. */}
              {showBinary &&
                g.bits.map((bit, i) => {
                  const x = g.lineLen + BIT_START_GAP + i * BIT_STEP
                  if (bit === 1) {
                    return (
                      <line
                        key={i}
                        x1={x}
                        y1={-BIT_LONG / 2}
                        x2={x}
                        y2={BIT_LONG / 2}
                        stroke="currentColor"
                        strokeWidth={STROKE_WIDTH}
                        strokeLinecap="round"
                        fill="none"
                      />
                    )
                  }
                  return (
                    <line
                      key={i}
                      x1={x - BIT_INLINE_LEN / 2}
                      y1={0}
                      x2={x + BIT_INLINE_LEN / 2}
                      y2={0}
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
