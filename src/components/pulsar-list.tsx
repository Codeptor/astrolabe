import { useEffect, useRef } from "react"
import type { RelativePulsar } from "@/lib/types"

interface PulsarListProps {
  pulsars: RelativePulsar[]
  activePulsar: RelativePulsar | null
  open: boolean
  onClose: () => void
  onHover: (rp: RelativePulsar | null) => void
  onSelect: (rp: RelativePulsar | null) => void
}

function formatPeriod(p0: number): string {
  if (p0 < 0.001) return `${(p0 * 1e6).toFixed(1)}µs`
  if (p0 < 1) return `${(p0 * 1e3).toFixed(1)}ms`
  return `${p0.toFixed(2)}s`
}

const PANEL_WIDTH = 300

export function PulsarList({
  pulsars,
  activePulsar,
  open,
  onClose,
  onHover,
  onSelect,
}: PulsarListProps) {
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Auto-scroll to the active pulsar when it changes
  useEffect(() => {
    if (!activePulsar || !open) return
    const el = itemRefs.current.get(activePulsar.pulsar.name)
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activePulsar, open])

  // Sort by angle (CCW from East) for consistent order around the map
  const sorted = [...pulsars].sort((a, b) => a.angle - b.angle)

  return (
    <aside
      className="fixed left-3 top-[72px] bottom-3 z-[60] bg-background/95 backdrop-blur-sm border border-foreground/15 flex flex-col shadow-2xl"
      style={{
        width: `${PANEL_WIDTH}px`,
        transform: open
          ? "translateX(0)"
          : `translateX(-${PANEL_WIDTH + 24}px)`,
        transition: "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        visibility: open ? "visible" : "hidden",
        transitionProperty: "transform, visibility",
        transitionDelay: open ? "0ms, 0ms" : "0ms, 320ms",
      }}
      onClick={(e) => e.stopPropagation()}
      aria-hidden={!open}
      aria-label="pulsar list"
    >
      <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between border-b border-foreground/10">
        <div>
          <h2
            className="text-[13px] text-foreground leading-none mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            pulsars
          </h2>
          <p className="text-[9px] text-foreground/50 leading-none">
            {pulsars.length} selected · sorted by angle
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="close pulsar list"
          className="text-foreground/50 hover:text-foreground text-[14px] cursor-pointer leading-none px-1"
          title="close (L)"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto themed-scroll">
        {sorted.map((rp, idx) => {
          const isActive = activePulsar?.pulsar.name === rp.pulsar.name
          return (
            <button
              key={rp.pulsar.name}
              ref={(el) => {
                if (el) itemRefs.current.set(rp.pulsar.name, el)
                else itemRefs.current.delete(rp.pulsar.name)
              }}
              type="button"
              onMouseEnter={() => onHover(rp)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(isActive ? null : rp)
              }}
              className={`w-full text-left px-4 py-2 cursor-pointer transition-colors border-l-2 ${
                isActive
                  ? "bg-foreground/5 border-accent text-foreground"
                  : "border-transparent text-foreground/75 hover:bg-foreground/[0.03] hover:text-foreground"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] tabular-nums">
                  <span className="text-foreground/40 mr-1.5">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  PSR {rp.pulsar.name}
                </span>
                <span className="text-[9px] text-foreground/50 tabular-nums shrink-0">
                  {formatPeriod(rp.pulsar.p0)}
                </span>
              </div>
              <div className="text-[9px] text-foreground/45 tabular-nums mt-0.5 ml-[28px]">
                d {rp.dist.toFixed(2)} kpc · l {rp.gl.toFixed(0)}° b {rp.gb.toFixed(0)}°
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
