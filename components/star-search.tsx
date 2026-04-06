"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { Star } from "@/lib/types"

type CustomStar = { name: string; gl: number; gb: number; dist: number; aliases?: string[] }

interface StarSearchProps {
  stars: Star[]
  selected: Star | { name: string; gl: number; gb: number; dist: number }
  onSelect: (star: Star | CustomStar) => void
}

const COORD_RE = /l\s*=\s*([-\d.]+)\s+b\s*=\s*([-\d.]+)\s+d\s*=\s*([\d.]+)/i

function parseCoords(query: string): CustomStar | null {
  const m = query.match(COORD_RE)
  if (!m) return null
  const gl = parseFloat(m[1]!)
  const gb = parseFloat(m[2]!)
  const dist = parseFloat(m[3]!)
  if (isNaN(gl) || isNaN(gb) || isNaN(dist)) return null
  return { name: `l=${gl} b=${gb} d=${dist}kpc`, gl, gb, dist }
}

function filterStars(stars: Star[], query: string): Star[] {
  const q = query.toLowerCase()
  return stars
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.aliases.some((a) => a.toLowerCase().includes(q))
    )
    .slice(0, 20)
}

export function StarSearch({ stars, selected, onSelect }: StarSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = query.trim() ? parseCoords(query) : null
  const results = query.trim() && !parsed ? filterStars(stars, query) : []
  const showDropdown = open && query.trim().length > 0 && (results.length > 0 || parsed !== null)

  const handleSelect = useCallback(
    (star: Star | CustomStar) => {
      onSelect(star)
      setQuery("")
      setOpen(false)
    },
    [onSelect]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setQuery("")
        setOpen(false)
        return
      }
      if (e.key === "Enter") {
        if (parsed) {
          handleSelect(parsed)
        } else if (results[0]) {
          handleSelect(results[0])
        }
      }
    },
    [parsed, results, handleSelect]
  )

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={selected.name}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="bg-transparent border-b border-foreground/20 px-0 py-1.5 text-[11px] w-full outline-none placeholder:text-muted"
        spellCheck={false}
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 bg-background border border-foreground/10 max-h-48 overflow-y-auto">
          {parsed && (
            <button
              type="button"
              className="w-full text-left px-2 py-1 text-[10px] hover:bg-foreground/5 cursor-pointer"
              onClick={() => handleSelect(parsed)}
            >
              <span className="text-foreground">go to l={parsed.gl} b={parsed.gb} d={parsed.dist}kpc</span>
            </button>
          )}
          {results.map((star) => (
            <button
              key={star.name}
              type="button"
              className="w-full text-left px-2 py-1 text-[10px] hover:bg-foreground/5 cursor-pointer flex justify-between gap-2"
              onClick={() => handleSelect(star)}
            >
              <span className="text-foreground truncate">{star.name}</span>
              <span className="text-muted shrink-0">{star.dist.toFixed(2)} kpc</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
