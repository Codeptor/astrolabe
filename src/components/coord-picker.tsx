import { useEffect, useState } from "react"
import { raDecToGalactic } from "@/lib/coordinates"
import type { CustomObserver } from "@/lib/state"

interface CoordPickerProps {
  open: boolean
  onClose: () => void
  onSubmit: (obs: CustomObserver) => void
}

type CoordSystem = "galactic" | "equatorial"

export function CoordPicker({ open, onClose, onSubmit }: CoordPickerProps) {
  const [system, setSystem] = useState<CoordSystem>("galactic")
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const [d, setD] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
    }
  }, [open])

  if (!open) return null

  const aLabel = system === "galactic" ? "l (deg)" : "ra (deg)"
  const bLabel = system === "galactic" ? "b (deg)" : "dec (deg)"
  const aPlaceholder = system === "galactic" ? "e.g. 120" : "e.g. 83.633"
  const bPlaceholder = system === "galactic" ? "e.g. -15" : "e.g. 22.014"

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const av = parseFloat(a)
    const bv = parseFloat(b)
    const dv = parseFloat(d)
    if (Number.isNaN(av) || Number.isNaN(bv) || Number.isNaN(dv)) {
      setError("all three fields must be numbers")
      return
    }
    if (dv <= 0) {
      setError("distance must be > 0 kpc")
      return
    }
    let gl: number, gb: number
    if (system === "galactic") {
      if (av < 0 || av >= 360) {
        setError("l must be in [0, 360)")
        return
      }
      if (bv < -90 || bv > 90) {
        setError("b must be in [-90, 90]")
        return
      }
      gl = av
      gb = bv
    } else {
      if (av < 0 || av >= 360) {
        setError("ra must be in [0, 360)")
        return
      }
      if (bv < -90 || bv > 90) {
        setError("dec must be in [-90, 90]")
        return
      }
      const out = raDecToGalactic(av, bv)
      gl = out.gl
      gb = out.gb
    }
    const name =
      system === "galactic"
        ? `l=${av} b=${bv} d=${dv}kpc`
        : `RA=${av} Dec=${bv} d=${dv}kpc`
    onSubmit({ name, gl, gb, dist: dv })
    setA("")
    setB("")
    setD("")
    setError(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[110] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-foreground/20 max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2
            className="text-[15px] text-foreground leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            custom observer
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-foreground/50 hover:text-foreground text-[14px] cursor-pointer leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-3 text-[10px]">
          <button
            type="button"
            onClick={() => setSystem("galactic")}
            className={`px-2 py-1 border cursor-pointer transition ${
              system === "galactic"
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/20 text-foreground/70 hover:border-foreground/50"
            }`}
          >
            galactic
          </button>
          <button
            type="button"
            onClick={() => setSystem("equatorial")}
            className={`px-2 py-1 border cursor-pointer transition ${
              system === "equatorial"
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/20 text-foreground/70 hover:border-foreground/50"
            }`}
          >
            equatorial (ra/dec)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="text-[9px] text-foreground/60 block mb-0.5">
              {aLabel}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={a}
              onChange={(e) => setA(e.target.value)}
              placeholder={aPlaceholder}
              className="w-full bg-transparent border border-foreground/20 px-2 py-1.5 text-[11px] outline-none focus:border-accent placeholder:text-foreground/30"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[9px] text-foreground/60 block mb-0.5">
              {bLabel}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder={bPlaceholder}
              className="w-full bg-transparent border border-foreground/20 px-2 py-1.5 text-[11px] outline-none focus:border-accent placeholder:text-foreground/30"
            />
          </div>
          <div>
            <label className="text-[9px] text-foreground/60 block mb-0.5">
              distance (kpc)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={d}
              onChange={(e) => setD(e.target.value)}
              placeholder="e.g. 2.5"
              className="w-full bg-transparent border border-foreground/20 px-2 py-1.5 text-[11px] outline-none focus:border-accent placeholder:text-foreground/30"
            />
          </div>

          {error && (
            <p className="text-[10px] text-red-400">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-foreground text-background text-[11px] py-2 mt-2 cursor-pointer hover:bg-foreground/90 transition"
          >
            place observer
          </button>
        </form>
      </div>
    </div>
  )
}
