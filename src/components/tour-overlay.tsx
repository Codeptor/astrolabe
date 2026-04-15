import { useEffect } from "react"
import { TOUR } from "@/lib/tour"

interface TourOverlayProps {
  index: number | null
  onPrev: () => void
  onNext: () => void
  onExit: () => void
}

export function TourOverlay({ index, onPrev, onNext, onExit }: TourOverlayProps) {
  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onExit()
        return
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        onNext()
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        onPrev()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, onNext, onPrev, onExit])

  if (index === null) return null
  const stop = TOUR[index]
  if (!stop) return null

  const atStart = index === 0
  const atEnd = index === TOUR.length - 1

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="guided tour"
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[110] w-[min(480px,calc(100vw-2rem))] bg-background/95 backdrop-blur border border-foreground/20"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-foreground/10">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-[0.15em] text-foreground/45">
            tour · stop {index + 1} / {TOUR.length}
          </div>
          <div
            className="text-[14px] text-foreground leading-tight mt-0.5 truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {stop.headline}
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          aria-label="exit tour"
          title="exit (esc)"
          className="shrink-0 text-foreground/50 hover:text-foreground text-[12px] leading-none cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
        >
          ✕
        </button>
      </div>

      <p className="px-4 py-3 text-[11px] text-foreground/75 leading-relaxed">
        {stop.body}
      </p>

      <div className="flex items-center gap-2 px-4 pb-3 text-[10px]">
        <button
          type="button"
          onClick={onPrev}
          disabled={atStart}
          aria-label="previous stop"
          className="text-foreground/70 enabled:hover:text-foreground disabled:text-foreground/20 disabled:cursor-not-allowed cursor-pointer transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
        >
          ← prev
        </button>
        <div className="flex-1 flex items-center justify-center gap-1" aria-hidden="true">
          {TOUR.map((_, i) => (
            <span
              key={i}
              className={`block w-1.5 h-1.5 rounded-full transition ${
                i === index ? "bg-foreground" : "bg-foreground/20"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label={atEnd ? "finish tour" : "next stop"}
          className="bg-foreground text-background px-3 py-1 hover:bg-foreground/90 transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {atEnd ? "finish" : "next →"}
        </button>
      </div>
    </div>
  )
}
