"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Algorithm } from "@/lib/state"
import { ALL_ALGORITHMS } from "@/lib/state"

interface AlgorithmPickerProps {
  value: Algorithm
  onChange: (a: Algorithm) => void
}

const LABELS: Record<Algorithm, string> = {
  gdop: "gdop",
  fastest: "fastest",
  closest: "closest",
  longest: "longest",
  stable: "stable",
  random: "random",
}

const DESCRIPTIONS: Record<Algorithm, string> = {
  gdop: "geometric dilution of precision (default)",
  fastest: "shortest period (millisecond pulsars)",
  closest: "smallest distance to observer",
  longest: "longest period (slow pulsars)",
  stable: "smallest |P-dot| (most stable rotation)",
  random: "uniform random sample",
}

export function AlgorithmPicker({ value, onChange }: AlgorithmPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex items-center gap-0.5 text-[10px] text-foreground/70 hover:text-foreground transition-colors cursor-pointer leading-none"
        title={`selection algorithm: ${LABELS[value]}`}
      >
        <span>{LABELS[value]}</span>
        <ChevronDown size={9} className="opacity-60" aria-hidden />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-background border border-foreground/15 min-w-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          {ALL_ALGORITHMS.map((a) => (
            <button
              key={a}
              type="button"
              className={`w-full text-left px-2 py-1.5 hover:bg-foreground/5 cursor-pointer ${
                a === value ? "text-foreground bg-foreground/[0.03]" : "text-foreground/70"
              }`}
              onClick={() => {
                onChange(a)
                setOpen(false)
              }}
            >
              <div className="text-[10px] leading-none">{LABELS[a]}</div>
              <div className="text-[8px] text-foreground/40 mt-0.5 leading-tight">
                {DESCRIPTIONS[a]}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
