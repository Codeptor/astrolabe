import { useEffect, useMemo, useState } from "react"
import type { Pulsar, Star, RelativePulsar } from "@/lib/types"
import { computePlaqueData, type Origin } from "@/lib/compute-plaque"
import { useTheme } from "@/lib/theme"
import Plaque from "@/components/plaque"
import { ALL_ALGORITHMS, type Algorithm } from "@/lib/state"

const SOL: Star = { name: "Sol", gl: 0, gb: 0, dist: 0, aliases: ["Sun", "Earth"] }

function resolveObserver(name: string, stars: Star[]): Origin {
  if (!name || name === "Sol") return SOL
  const match = stars.find(
    (s) => s.name === name || s.aliases.includes(name),
  )
  return match ?? SOL
}

function readParam(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  return new URLSearchParams(window.location.search).get(key) ?? fallback
}

function PlaqueSide({
  label,
  observerName,
  onChange,
  stars,
  pulsars,
  count,
  algorithm,
  epoch,
}: {
  label: string
  observerName: string
  onChange: (name: string) => void
  stars: Star[]
  pulsars: Pulsar[]
  count: number
  algorithm: Algorithm
  epoch: number
}) {
  const origin = useMemo(() => resolveObserver(observerName, stars), [observerName, stars])
  const data = useMemo(
    () => computePlaqueData(pulsars, origin, count, algorithm, "custom", epoch),
    [pulsars, origin, count, algorithm, epoch],
  )
  const [active, setActive] = useState<RelativePulsar | null>(null)

  const options = useMemo(() => {
    const seen = new Set<string>()
    const list: Star[] = []
    for (const s of [SOL, ...stars]) {
      if (seen.has(s.name)) continue
      seen.add(s.name)
      list.push(s)
    }
    return list
  }, [stars])

  return (
    <div className="flex-1 min-w-0 flex flex-col border-foreground/10 relative">
      <div className="flex items-center justify-between px-3 py-2 border-b border-foreground/10 bg-background/40 gap-2">
        <span className="text-[9px] uppercase tracking-widest text-foreground/40 shrink-0">
          {label}
        </span>
        <select
          value={observerName}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} observer`}
          className="flex-1 min-w-0 text-[11px] bg-transparent text-foreground border-b border-foreground/30 px-1 py-0.5 outline-none focus:border-foreground cursor-pointer"
        >
          {options.map((s) => (
            <option key={s.name} value={s.name} className="bg-background text-foreground">
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-h-0 relative">
        {data ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 py-6 pointer-events-none">
            <div className="w-full h-full pointer-events-auto">
              <Plaque
                data={data}
                activePulsar={active}
                showRings={false}
                onHover={setActive}
                onClick={(rp) => setActive(rp)}
              />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-foreground/40">
            loading…
          </div>
        )}
      </div>
    </div>
  )
}

export function ComparePage() {
  useTheme()
  const [pulsars, setPulsars] = useState<Pulsar[]>([])
  const [stars, setStars] = useState<Star[]>([])
  const [observerA, setObserverA] = useState(() => readParam("a", "Sol"))
  const [observerB, setObserverB] = useState(() => readParam("b", "Sirius"))
  const [count, setCount] = useState(() => {
    const raw = Number.parseInt(readParam("n", "14"), 10)
    return Number.isFinite(raw) && raw >= 5 && raw <= 50 ? raw : 14
  })
  const [algorithm, setAlgorithm] = useState<Algorithm>(() => {
    const raw = readParam("algo", "gdop")
    return (ALL_ALGORITHMS as string[]).includes(raw) ? (raw as Algorithm) : "gdop"
  })

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/data/pulsars.json").then((r) => r.json()),
      fetch("/data/stars.json").then((r) => r.json()),
    ])
      .then(([p, s]) => {
        if (cancelled) return
        setPulsars(p)
        setStars(s)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams()
    if (observerA !== "Sol") params.set("a", observerA)
    if (observerB !== "Sirius") params.set("b", observerB)
    if (count !== 14) params.set("n", String(count))
    if (algorithm !== "gdop") params.set("algo", algorithm)
    const search = params.toString()
    const next = `${window.location.pathname}${search ? `?${search}` : ""}`
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next)
    }
  }, [observerA, observerB, count, algorithm])

  function swap() {
    setObserverA(observerB)
    setObserverB(observerA)
  }

  return (
    <div className="flex flex-col h-svh bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-foreground/10 shrink-0">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-[11px] text-foreground hover:text-foreground/70 transition"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ASTROLABE
          </a>
          <span className="text-[9px] uppercase tracking-widest text-foreground/40">
            compare
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-foreground/70">
          <label className="flex items-center gap-1.5">
            <span className="text-foreground/50">algo</span>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
              className="bg-transparent border-b border-foreground/30 px-1 py-0.5 outline-none focus:border-foreground cursor-pointer text-[10px]"
            >
              {ALL_ALGORITHMS.map((a) => (
                <option key={a} value={a} className="bg-background text-foreground">
                  {a}
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
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10)
                if (!Number.isFinite(v)) return
                setCount(Math.min(50, Math.max(5, v)))
              }}
              className="w-12 bg-transparent border-b border-foreground/30 px-1 py-0.5 outline-none focus:border-foreground text-[10px] tabular-nums"
              aria-label="pulsar count"
            />
          </label>
          <button
            type="button"
            onClick={swap}
            className="text-[10px] text-foreground/70 hover:text-foreground border border-foreground/20 hover:border-foreground/50 px-2 py-0.5 cursor-pointer transition"
            title="swap sides"
          >
            ⇄ swap
          </button>
          <a
            href={`/?from=${encodeURIComponent(observerA)}`}
            className="text-[10px] text-foreground/50 hover:text-foreground transition"
            title="exit compare mode to the standard view"
          >
            ← back
          </a>
        </div>
      </header>
      <div className="flex flex-1 min-h-0 divide-x divide-foreground/10">
        <PlaqueSide
          label="A"
          observerName={observerA}
          onChange={setObserverA}
          stars={stars}
          pulsars={pulsars}
          count={count}
          algorithm={algorithm}
          epoch={0}
        />
        <PlaqueSide
          label="B"
          observerName={observerB}
          onChange={setObserverB}
          stars={stars}
          pulsars={pulsars}
          count={count}
          algorithm={algorithm}
          epoch={0}
        />
      </div>
    </div>
  )
}
