import type { RelativePulsar } from "@/lib/types"

interface PulsarTooltipProps {
  pulsar: RelativePulsar | null
  locked: boolean
  onInfo?: (anchor: { top: number; left: number }) => void
}

function formatPeriod(p0: number): string {
  if (p0 < 0.001) return `${(p0 * 1e6).toFixed(2)} µs`
  if (p0 < 1) return `${(p0 * 1e3).toFixed(2)} ms`
  return `${p0.toFixed(4)} s`
}

function stabilityLabel(p1: number | null): string {
  if (p1 === null) return "moderate"
  const abs = Math.abs(p1)
  if (abs < 1e-20) return "exceptional"
  if (abs < 1e-18) return "high"
  if (abs < 1e-16) return "moderate"
  return "low"
}

export function PulsarTooltip({ pulsar, locked, onInfo }: PulsarTooltipProps) {
  if (!pulsar) {
    return <div className="h-[40px]" />
  }

  const { pulsar: p, dist, gl, gb } = pulsar
  const dot = <span className="text-foreground/40"> · </span>

  return (
    <div className="flex flex-col justify-center gap-1 min-h-[40px]">
      <p
        className="text-[13px] leading-none flex items-center gap-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span>PSR {p.name}</span>
        <span className="text-foreground/30 text-[9px]">click to copy</span>
        {locked && onInfo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              onInfo({ top: rect.top, left: rect.right + 8 })
            }}
            aria-label={`more info on PSR ${p.name}`}
            title="more info"
            className="text-foreground/40 hover:text-foreground text-[11px] leading-none cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
          >
            ⓘ
          </button>
        )}
      </p>
      <p className="text-[10px] text-foreground/70 leading-none">
        {formatPeriod(p.p0)}
        {dot}
        {dist.toFixed(2)} kpc
        {dot}
        l {gl.toFixed(1)}° b {gb.toFixed(1)}°
        {dot}
        {stabilityLabel(p.p1)}
      </p>
    </div>
  )
}
