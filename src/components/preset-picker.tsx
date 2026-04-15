import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { PRESETS, type PresetDef } from "@/lib/presets"

interface PresetPickerProps {
  onApply: (preset: PresetDef) => void
}

export function PresetPicker({ onApply }: PresetPickerProps) {
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
        title="preset views"
        aria-label="preset views"
        aria-expanded={open}
      >
        <span>presets</span>
        <ChevronDown size={9} className="opacity-60" aria-hidden />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-background border border-foreground/15 min-w-[260px]"
          onClick={(e) => e.stopPropagation()}
        >
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-2 py-1.5 hover:bg-foreground/5 cursor-pointer text-foreground/85 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
              onClick={() => {
                onApply(p)
                setOpen(false)
              }}
            >
              <div className="text-[10px] leading-none">{p.label}</div>
              <div className="text-[8px] text-foreground/40 mt-0.5 leading-tight">
                {p.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
