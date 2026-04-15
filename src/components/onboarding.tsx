import { useEffect, useState } from "react"

const KEY = "astrolabe.onboarded"

interface Step {
  title: string
  body: string
  position: "center" | "top-left" | "top-right" | "bottom-left"
}

const STEPS: Step[] = [
  {
    title: "welcome to astrolabe",
    body: "this is a Pioneer/Voyager-style pulsar map generator. each line you see represents one of 14 pulsars selected to triangulate your position in the galaxy.",
    position: "center",
  },
  {
    title: "the observer",
    body: "the dot at the center is the observer — by default, our Sun. pick any star in the search box (top-left) and the map recomputes the best 14 pulsars from there.",
    position: "top-left",
  },
  {
    title: "reading a pulsar line",
    body: "line length = distance to the pulsar (linear, kpc). the binary ticks at the end encode the pulsar's spin period in hydrogen 21cm units. the long horizontal line points to the galactic center.",
    position: "center",
  },
  {
    title: "interaction",
    body: "hover any line to see the pulsar's info in the bottom-left. click to lock the selection. press ? for help, / to search, R for a random star, Esc to reset.",
    position: "bottom-left",
  },
]

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      if (localStorage.getItem(KEY) !== "1") {
        // Small delay so the page renders first
        setTimeout(() => setVisible(true), 600)
      }
    } catch {}
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(KEY, "1")
    } catch {}
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else dismiss()
  }

  if (!visible) return null

  const s = STEPS[step]!

  const positionClasses: Record<Step["position"], string> = {
    center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
    "top-left": "left-6 top-24",
    "top-right": "right-6 top-24",
    "bottom-left": "left-6 bottom-20",
  }

  return (
    <div
      className="fixed inset-0 z-[120] bg-background/40 backdrop-blur-[2px]"
      onClick={dismiss}
    >
      <div
        className={`absolute ${positionClasses[s.position]} max-w-sm bg-background border border-foreground/25 p-5 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-[14px] text-foreground mb-2 leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {s.title}
        </h3>
        <p className="text-[11px] text-foreground/70 leading-relaxed mb-4">
          {s.body}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`block w-1.5 h-1.5 rounded-full ${
                  i === step ? "bg-foreground" : "bg-foreground/20"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="text-[10px] text-foreground/50 hover:text-foreground transition cursor-pointer"
            >
              skip
            </button>
            <button
              type="button"
              onClick={next}
              className="text-[10px] bg-foreground text-background px-3 py-1 cursor-pointer hover:bg-foreground/90 transition"
            >
              {step < STEPS.length - 1 ? "next" : "got it"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
