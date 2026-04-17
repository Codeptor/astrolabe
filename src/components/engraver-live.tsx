import { useEffect, useMemo, useState } from "react"
import Plaque1972Faithful from "@/components/plaque-faithful"
import { computePlaqueData } from "@/lib/compute-plaque"
import type { Pulsar, Star, RelativePulsar } from "@/lib/types"

const SOL = { name: "Sol", gl: 0, gb: 0, dist: 0 } as const

export default function LiveFaithful() {
  const [pulsars, setPulsars] = useState<Pulsar[]>([])
  const [stars, setStars] = useState<Star[]>([])
  const [observer, setObserver] = useState("Sol")
  const [count, setCount] = useState(14)
  const [mode, setMode] = useState<"1972" | "custom">("1972")
  const [active, setActive] = useState<RelativePulsar | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/data/pulsars.json").then((r) => r.json()),
      fetch("/data/stars.json").then((r) => r.json()),
    ])
      .then(([p, s]) => {
        setPulsars(p)
        setStars(s)
      })
      .catch(() => {})
  }, [])

  const origin = useMemo(() => {
    if (observer === "Sol") return SOL
    const s = stars.find((x) => x.name === observer || x.aliases?.includes(observer))
    return s ? { name: s.name, gl: s.gl, gb: s.gb, dist: s.dist } : SOL
  }, [observer, stars])

  const data = useMemo(
    () => computePlaqueData(pulsars, origin, count, "gdop", mode, 0),
    [pulsars, origin, count, mode],
  )

  // De-dupe SOL so the curated stars.json (which already contains Sol) doesn't
  // seed a duplicate <option key="Sol"> and trigger a React warning.
  const options = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ name: string }> = []
    for (const s of [SOL, ...stars]) {
      if (seen.has(s.name)) continue
      seen.add(s.name)
      out.push(s)
    }
    return out
  }, [stars])

  return (
    <main className="flex-1 min-h-0 flex flex-col">
      {/* Compact, centred control row */}
      <div className="flex items-center justify-center gap-5 px-4 py-2.5 border-b border-foreground/10 text-[10px] text-foreground/70">
        <label className="flex items-center gap-1.5">
          <span className="text-foreground/45 uppercase tracking-wider text-[9px]">mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "1972" | "custom")}
            className="bg-transparent border-b border-foreground/30 px-1 py-0.5 outline-none focus:border-foreground cursor-pointer"
          >
            <option value="1972" className="bg-background">1972 fixed</option>
            <option value="custom" className="bg-background">custom · GDOP</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-foreground/45 uppercase tracking-wider text-[9px]">observer</span>
          <select
            value={observer}
            onChange={(e) => setObserver(e.target.value)}
            className="bg-transparent border-b border-foreground/30 px-1 py-0.5 outline-none focus:border-foreground cursor-pointer max-w-[180px]"
          >
            {options.map((s) => (
              <option key={s.name} value={s.name} className="bg-background">
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-foreground/45 uppercase tracking-wider text-[9px]">n</span>
          <input
            type="number"
            min={5}
            max={50}
            value={count}
            onChange={(e) =>
              setCount(
                Math.max(
                  5,
                  Math.min(50, Number.parseInt(e.target.value, 10) || 14),
                ),
              )
            }
            className="w-12 bg-transparent border-b border-foreground/30 px-1 py-0.5 outline-none focus:border-foreground tabular-nums"
          />
        </label>
      </div>

      {/* Plaque canvas — centred */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-8 sm:p-12">
        {data ? (
          <div className="w-full max-w-[min(1400px,100%)] max-h-[75vh] aspect-[2/1] flex items-center justify-center">
            <Plaque1972Faithful
              data={data}
              activePulsar={active}
              onHover={setActive}
            />
          </div>
        ) : (
          <p className="text-[11px] text-foreground/40 animate-pulse">
            loading catalogue…
          </p>
        )}
      </div>

      {/* Hover readout — stays put so layout doesn't jump when a pulsar is highlighted */}
      <div className="shrink-0 px-6 py-3 border-t border-foreground/10 text-[10px] text-foreground/55 text-center min-h-[34px] tabular-nums">
        {active ? (
          <>
            <span className="text-foreground/85">PSR {active.pulsar.name}</span>
            <span className="mx-2 text-foreground/30">·</span>
            {(active.pulsar.p0 * 1000).toFixed(2)} ms
            <span className="mx-2 text-foreground/30">·</span>
            {active.dist.toFixed(2)} kpc
            <span className="mx-2 text-foreground/30">·</span>
            l {active.gl.toFixed(1)}° b {active.gb.toFixed(1)}°
          </>
        ) : (
          <span className="text-foreground/35">hover a pulsar line to inspect</span>
        )}
      </div>
    </main>
  )
}
