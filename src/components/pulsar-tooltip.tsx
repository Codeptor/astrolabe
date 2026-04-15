import { useState } from "react"
import type { RelativePulsar } from "@/lib/types"

interface PulsarTooltipProps {
  pulsar: RelativePulsar | null
  locked: boolean
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

// Classify pulsar type from period and period derivative
function pulsarType(p0: number, p1: number | null): string {
  if (p0 < 0.03) return "millisecond pulsar"
  if (p1 !== null && Math.abs(p1) > 1e-12) return "young pulsar"
  if (p0 > 5) return "slow pulsar"
  return "normal pulsar"
}

// Characteristic age in years (τ = P / (2 * |P-dot|))
function characteristicAgeYears(p0: number, p1: number | null): number | null {
  if (p1 === null || p1 === 0) return null
  const ageSeconds = p0 / (2 * Math.abs(p1))
  return ageSeconds / (60 * 60 * 24 * 365.25)
}

function formatAge(years: number): string {
  if (years > 1e9) return `${(years / 1e9).toFixed(1)} Gyr`
  if (years > 1e6) return `${(years / 1e6).toFixed(1)} Myr`
  if (years > 1e3) return `${(years / 1e3).toFixed(1)} kyr`
  return `${years.toFixed(0)} yr`
}

function atnfUrl(name: string): string {
  // ATNF catalogue search URL for a single pulsar by JName
  return `https://www.atnf.csiro.au/research/pulsar/psrcat/proc_form.php?version=1.71&JName=JName&P0=P0&P1=P1&Dist=Dist&Gl=Gl&Gb=Gb&Type=Type&startUserDefined=true&pulsar_names=${encodeURIComponent(name)}&ephemeris=long&submit_ephemeris=Get+Ephemeris&coords_unit=raj%2Fdecj`
}

export function PulsarTooltip({ pulsar, locked }: PulsarTooltipProps) {
  const [expanded, setExpanded] = useState(false)

  if (!pulsar) {
    return <div className="h-[40px]" />
  }

  const { pulsar: p, dist, gl, gb } = pulsar
  const dot = <span className="text-foreground/40"> · </span>
  const ageYr = characteristicAgeYears(p.p0, p.p1)
  const type = pulsarType(p.p0, p.p1)

  return (
    <div className="flex flex-col justify-center gap-1 min-h-[40px]">
      <p
        className="text-[13px] leading-none flex items-center gap-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span>PSR {p.name}</span>
        <span className="text-foreground/30 text-[9px]">click to copy</span>
        {locked && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            className="text-foreground/40 hover:text-foreground text-[9px] cursor-pointer"
            title={expanded ? "less info" : "more info"}
          >
            {expanded ? "− less" : "+ more"}
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
      {expanded && locked && (
        <div className="mt-1 text-[9px] text-foreground/60 leading-relaxed flex items-center gap-2 flex-wrap">
          <span>{type}</span>
          {ageYr !== null && (
            <>
              {dot}
              <span>τ ≈ {formatAge(ageYr)}</span>
            </>
          )}
          {p.p1 !== null && (
            <>
              {dot}
              <span>Ṗ {p.p1.toExponential(2)}</span>
            </>
          )}
          {dot}
          <a
            href={atnfUrl(p.name)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline hover:text-foreground transition"
          >
            ATNF →
          </a>
        </div>
      )}
    </div>
  )
}
