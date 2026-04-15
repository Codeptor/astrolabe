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

  return (
    <main className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-center gap-3 px-4 py-2 border-b border-foreground/10 text-[10px] text-foreground/70">
        <label className="flex items-center gap-1.5">
          <span className="text-foreground/50">mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "1972" | "custom")}
            className="bg-transparent border-b border-foreground/30 px-1 py-0.5 outline-none focus:border-foreground cursor-pointer"
          >
            <option value="1972" className="bg-background">1972 fixed</option>
            <option value="custom" className="bg-background">custom (ATNF GDOP)</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-foreground/50">observer</span>
          <select
            value={observer}
            onChange={(e) => setObserver(e.target.value)}
            className="bg-transparent border-b border-foreground/30 px-1 py-0.5 outline-none focus:border-foreground cursor-pointer max-w-[160px]"
          >
            {[SOL, ...stars].map((s) => (
              <option key={s.name} value={s.name} className="bg-background">
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-foreground/50">n</span>
          <input
            type="number"
            min={5}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(5, Math.min(50, Number.parseInt(e.target.value, 10) || 14)))}
            className="w-12 bg-transparent border-b border-foreground/30 px-1 py-0.5 outline-none focus:border-foreground tabular-nums"
          />
        </label>
        {active && (
          <span className="text-foreground/60">
            hover · PSR {active.pulsar.name} · {(active.pulsar.p0 * 1000).toFixed(2)}ms · {active.dist.toFixed(2)} kpc
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        {data ? (
          <Plaque1972Faithful
            data={data}
            activePulsar={active}
            onHover={setActive}
          />
        ) : (
          <p className="text-[11px] text-foreground/40">loading catalogue…</p>
        )}
      </div>
    </main>
  )
}
