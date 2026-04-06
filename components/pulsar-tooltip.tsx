import type { RelativePulsar } from "@/lib/types"

interface PulsarTooltipProps {
  pulsar: RelativePulsar | null
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

export function PulsarTooltip({ pulsar }: PulsarTooltipProps) {
  if (!pulsar) {
    return <div className="h-[60px]" />
  }

  const { pulsar: p, dist } = pulsar
  const dot = <span className="text-foreground/20"> · </span>

  return (
    <div className="h-[60px] flex flex-col justify-center gap-1">
      <p
        className="text-[13px] leading-none"
        style={{ fontFamily: "var(--font-display)" }}
      >
        PSR {p.name}
      </p>
      <p className="text-[10px] text-muted leading-none">
        {formatPeriod(p.p0)}
        {dot}
        {dist.toFixed(2)} kpc
        {dot}
        {stabilityLabel(p.p1)}
      </p>
    </div>
  )
}
