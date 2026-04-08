import { ImageResponse } from "next/og"

export const alt = "Astrolabe — interactive Pioneer plaque pulsar map"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a10",
          color: "#e0e0e0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              letterSpacing: "0.3em",
              color: "#e0e0e0aa",
              textTransform: "uppercase",
            }}
          >
            Astrolabe
          </div>
          <div
            style={{
              fontSize: "72px",
              lineHeight: 1.05,
              color: "#e0e0e0",
              maxWidth: "900px",
              display: "flex",
            }}
          >
            interactive Pioneer plaque pulsar map
          </div>
        </div>

        <svg
          width="1080"
          height="260"
          viewBox="0 0 1700 400"
          style={{ alignSelf: "center" }}
        >
          <g
            stroke="#e0e0e0"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          >
            <line x1="850" y1="200" x2="1380" y2="140" />
            <line x1="850" y1="200" x2="1420" y2="240" />
            <line x1="850" y1="200" x2="1280" y2="60" />
            <line x1="850" y1="200" x2="1320" y2="340" />
            <line x1="850" y1="200" x2="320" y2="120" />
            <line x1="850" y1="200" x2="280" y2="260" />
            <line x1="850" y1="200" x2="420" y2="60" />
            <line x1="850" y1="200" x2="460" y2="340" />
            <line x1="850" y1="200" x2="850" y2="40" />
            <line x1="850" y1="200" x2="850" y2="360" />
          </g>
          <circle cx="850" cy="200" r="6" fill="#e0e0e0" />
        </svg>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: "18px",
            color: "#e0e0e099",
          }}
        >
          <div style={{ display: "flex" }}>
            pick any star · 14 pulsars · binary periods
          </div>
          <div style={{ display: "flex" }}>astrolabe.bhanueso.dev</div>
        </div>
      </div>
    ),
    { ...size }
  )
}
