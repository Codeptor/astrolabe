import { ImageResponse } from "next/og"

export const alt = "Astrolabe — interactive Pioneer plaque pulsar map"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// 14 Pioneer plaque pulsars — the canonical 1972 Drake/Sagan/Salzman engraving.
// Geometry mirrors lib/pioneer-original.ts (which takes its values from
// 7yl4r/pulsarMap) so the OG image matches the app's "1972 mode" exactly.
const PIONEER_PULSARS: Array<{ dist: number; angle: number }> = [
  { dist: 0.27, angle: 17 },
  { dist: 0.02, angle: -49 },
  { dist: 0.56, angle: 58 },
  { dist: 0.15, angle: 95 },
  { dist: 0.01, angle: 129 },
  { dist: 0.02, angle: 162 },
  { dist: 0.18, angle: 174 },
  { dist: 0.11, angle: 177 },
  { dist: 0.07, angle: -145 },
  { dist: 0.1, angle: -97 },
  { dist: 0.03, angle: -68 },
  { dist: 0.4, angle: -52 },
  { dist: 0.01, angle: 45 },
  { dist: 0.04, angle: -16 },
]

// Plaque viewBox math — same constants as components/plaque.tsx so the
// rendered OG image is pixel-faithful to the live renderer (minus the
// binary tick text, which is illegible at OG scale).
const DEG = Math.PI / 180
const VB_W = 1700
const VB_H = 700
const PAD = 15
const GC_X = VB_W - PAD
const GC_DIST_PX = Math.round((GC_X * 2) / 3)
const EARTH_X = GC_X - GC_DIST_PX
const EARTH_Y = VB_H / 2

function maxRadialLen(angleRad: number): number {
  const cx = Math.cos(angleRad)
  const cy = -Math.sin(angleRad) // SVG y-down
  let len = Infinity
  if (cx > 1e-6) len = Math.min(len, (VB_W - PAD - EARTH_X) / cx)
  if (cx < -1e-6) len = Math.min(len, (EARTH_X - PAD) / -cx)
  if (cy > 1e-6) len = Math.min(len, (VB_H - PAD - EARTH_Y) / cy)
  if (cy < -1e-6) len = Math.min(len, (EARTH_Y - PAD) / -cy)
  return len
}

function computeEndpoint(dist: number, angleDeg: number) {
  const angleRad = -angleDeg * DEG
  const distPx = Math.min(dist * GC_DIST_PX, maxRadialLen(angleRad))
  return {
    x2: EARTH_X + Math.cos(angleRad) * distPx,
    y2: EARTH_Y - Math.sin(angleRad) * distPx,
  }
}

const FG = "#e0e0e0"
const BG = "#0a0a10"
const MUTED = "rgba(224,224,224,0.55)"
const FAINT = "rgba(224,224,224,0.22)"

export default async function OpengraphImage() {
  const lines = PIONEER_PULSARS.map((p) => computeEndpoint(p.dist, p.angle))

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          color: FG,
          display: "flex",
          flexDirection: "column",
          padding: "32px 60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* ══ top row: hydrogen · title · human figures ══ */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            height: "96px",
          }}
        >
          {/* Hydrogen hyperfine transition — top-left of original plaque */}
          <svg width="96" height="82" viewBox="0 0 96 82">
            <g stroke={FG} strokeWidth="1.5" fill="none" strokeLinecap="round">
              <circle cx="22" cy="22" r="12" />
              <circle cx="72" cy="22" r="12" />
              {/* spin arrow up (left atom) */}
              <line x1="22" y1="10" x2="22" y2="34" />
              <line x1="17" y1="15" x2="22" y2="10" />
              <line x1="27" y1="15" x2="22" y2="10" />
              {/* spin arrow down (right atom) */}
              <line x1="72" y1="34" x2="72" y2="10" />
              <line x1="67" y1="29" x2="72" y2="34" />
              <line x1="77" y1="29" x2="72" y2="34" />
              {/* 21 cm transition photon */}
              <line
                x1="34"
                y1="50"
                x2="60"
                y2="50"
                strokeDasharray="2 3"
                strokeWidth="1"
              />
              {/* binary "1" unit tick */}
              <line x1="47" y1="62" x2="47" y2="78" strokeWidth="2.5" />
            </g>
          </svg>

          {/* Title */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "56px",
                letterSpacing: "0.16em",
                color: FG,
                lineHeight: 1,
              }}
            >
              ASTROLABE
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "14px",
                color: MUTED,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              interactive pioneer plaque pulsar map
            </div>
          </div>

          {/* Human figures — top-right of original plaque */}
          <svg width="108" height="92" viewBox="0 0 108 92">
            <g stroke={FG} strokeWidth="1.5" fill="none" strokeLinecap="round">
              {/* height bar */}
              <line x1="4" y1="10" x2="4" y2="86" />
              <line x1="1" y1="10" x2="7" y2="10" />
              <line x1="1" y1="86" x2="7" y2="86" />

              {/* figure 1 — greeting hand raised */}
              <circle cx="38" cy="16" r="8" />
              <line x1="38" y1="24" x2="38" y2="60" />
              <line x1="38" y1="32" x2="24" y2="20" />
              <line x1="38" y1="34" x2="52" y2="44" />
              <line x1="38" y1="60" x2="30" y2="84" />
              <line x1="38" y1="60" x2="44" y2="84" />

              {/* figure 2 */}
              <circle cx="78" cy="20" r="7" />
              <line x1="78" y1="27" x2="78" y2="58" />
              <line x1="78" y1="34" x2="66" y2="44" />
              <line x1="78" y1="34" x2="90" y2="44" />
              <line x1="78" y1="58" x2="72" y2="82" />
              <line x1="78" y1="58" x2="82" y2="82" />
            </g>
          </svg>
        </div>

        {/* ══ pulsar radial map (hero) ══ */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "14px",
            marginBottom: "14px",
          }}
        >
          <svg width="922" height="380" viewBox={`0 0 ${VB_W} ${VB_H}`}>
            {/* GC reference line */}
            <line
              x1={EARTH_X}
              y1={EARTH_Y}
              x2={GC_X}
              y2={EARTH_Y}
              stroke={FG}
              strokeWidth="2"
            />
            {/* GC perpendicular cap */}
            <line
              x1={GC_X}
              y1={EARTH_Y - 16}
              x2={GC_X}
              y2={EARTH_Y + 16}
              stroke={FG}
              strokeWidth="6"
            />
            {/* 14 pulsar radial lines */}
            {lines.map((p, i) => (
              <line
                key={i}
                x1={EARTH_X}
                y1={EARTH_Y}
                x2={p.x2}
                y2={p.y2}
                stroke={FG}
                strokeWidth="2"
              />
            ))}
            {/* observer dot */}
            <circle cx={EARTH_X} cy={EARTH_Y} r="6" fill={FG} />
          </svg>
        </div>

        {/* ══ bottom: solar system + meta ══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Solar system — Sun + 9 planets + Pioneer trajectory */}
          <svg width="1080" height="26" viewBox="0 0 1080 26">
            <line
              x1="30"
              y1="13"
              x2="1050"
              y2="13"
              stroke={FAINT}
              strokeWidth="1"
            />
            <circle cx="55" cy="13" r="9" fill={FG} />
            <circle cx="105" cy="13" r="2.2" fill={FG} />
            <circle cx="145" cy="13" r="3" fill={FG} />
            <circle cx="190" cy="13" r="3.4" fill={FG} />
            <circle cx="235" cy="13" r="2.8" fill={FG} />
            <circle cx="345" cy="13" r="7" fill={FG} />
            <circle cx="490" cy="13" r="6" fill={FG} />
            <circle cx="635" cy="13" r="5" fill={FG} />
            <circle cx="790" cy="13" r="5" fill={FG} />
            <circle cx="910" cy="13" r="2" fill={FG} />
            {/* Pioneer trajectory — dashed line from Earth outward */}
            <line
              x1="190"
              y1="13"
              x2="1022"
              y2="13"
              stroke={MUTED}
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <line
              x1="1010"
              y1="7"
              x2="1022"
              y2="13"
              stroke={FG}
              strokeWidth="1.5"
            />
            <line
              x1="1010"
              y1="19"
              x2="1022"
              y2="13"
              stroke={FG}
              strokeWidth="1.5"
            />
          </svg>

          {/* meta row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
              color: MUTED,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            <div style={{ display: "flex" }}>
              14 pulsars · pioneer 1972 reference
            </div>
            <div style={{ display: "flex" }}>astrolabe.bhanueso.dev</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
