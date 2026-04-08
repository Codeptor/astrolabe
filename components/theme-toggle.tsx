"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Theme } from "@/lib/state"
import { THEMES } from "@/lib/presets"

interface ThemeToggleProps {
  value: Theme
  onChange: (t: Theme) => void
}

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = THEMES.find((t) => t.id === value) ?? THEMES[0]!

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
        title={`theme: ${current.label}`}
      >
        <span>{current.label}</span>
        <ChevronDown size={9} className="opacity-60" aria-hidden />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-background border border-foreground/15 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`w-full text-left px-2 py-1 text-[10px] hover:bg-foreground/5 cursor-pointer flex items-center justify-between gap-2 ${
                t.id === value ? "text-foreground" : "text-foreground/60"
              }`}
              onClick={() => {
                onChange(t.id)
                setOpen(false)
              }}
            >
              <span>{t.label}</span>
              <span
                className="w-3 h-3 border border-foreground/30"
                style={{ background: t.swatch }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
