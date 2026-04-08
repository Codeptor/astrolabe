"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import type { Star } from "@/lib/types"
import { raDecToGalactic } from "@/lib/coordinates"

type CustomStar = { name: string; gl: number; gb: number; dist: number; aliases?: string[] }

interface StarSearchProps {
  stars: Star[]
  selected: Star | { name: string; gl: number; gb: number; dist: number }
  onSelect: (star: Star | CustomStar) => void
  closeSignal?: boolean
}

const RECENT_KEY = "astrolabe.recent_stars"
const MAX_RECENT = 6

// Galactic coords: l=120 b=-15 d=2.5
const GAL_RE = /^l\s*=\s*([-\d.]+)\s+b\s*=\s*([-\d.]+)\s+d\s*=\s*([\d.]+)$/i
// RA/Dec sexagesimal: 18h36m56s +38d47m01s d=0.0077  (or with colons)
const RADEC_SEX_RE =
  /^(\d{1,2})[h:](\d{1,2})[m:]([\d.]+)s?\s+([+-]?\d{1,2})[d°:](\d{1,2})[m':]([\d.]+)["s]?\s+d\s*=\s*([\d.]+)$/i
// RA/Dec decimal degrees: ra=83.633 dec=22.014 d=2.0
const RADEC_DEC_RE =
  /^ra\s*=\s*([-\d.]+)\s+dec\s*=\s*([-\d.]+)\s+d\s*=\s*([\d.]+)$/i

function parseInput(query: string): CustomStar | null {
  const q = query.trim()

  const gal = q.match(GAL_RE)
  if (gal) {
    const gl = parseFloat(gal[1]!)
    const gb = parseFloat(gal[2]!)
    const dist = parseFloat(gal[3]!)
    if (!isNaN(gl) && !isNaN(gb) && !isNaN(dist)) {
      return { name: `l=${gl} b=${gb} d=${dist}kpc`, gl, gb, dist }
    }
  }

  const radecDec = q.match(RADEC_DEC_RE)
  if (radecDec) {
    const ra = parseFloat(radecDec[1]!)
    const dec = parseFloat(radecDec[2]!)
    const dist = parseFloat(radecDec[3]!)
    if (!isNaN(ra) && !isNaN(dec) && !isNaN(dist)) {
      const { gl, gb } = raDecToGalactic(ra, dec)
      return { name: `RA=${ra} Dec=${dec} d=${dist}kpc`, gl, gb, dist }
    }
  }

  const radecSex = q.match(RADEC_SEX_RE)
  if (radecSex) {
    const rh = parseFloat(radecSex[1]!)
    const rm = parseFloat(radecSex[2]!)
    const rs = parseFloat(radecSex[3]!)
    const dSign = radecSex[4]!.startsWith("-") ? -1 : 1
    const dd = Math.abs(parseFloat(radecSex[4]!))
    const dm = parseFloat(radecSex[5]!)
    const ds = parseFloat(radecSex[6]!)
    const dist = parseFloat(radecSex[7]!)
    const ra = (rh + rm / 60 + rs / 3600) * 15
    const dec = dSign * (dd + dm / 60 + ds / 3600)
    if (!isNaN(ra) && !isNaN(dec) && !isNaN(dist)) {
      const { gl, gb } = raDecToGalactic(ra, dec)
      return { name: q, gl, gb, dist }
    }
  }

  return null
}

// Lightweight fuzzy match scoring
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim()
  const t = target.toLowerCase()
  if (!q) return 0
  if (t === q) return 1000
  if (t.startsWith(q)) return 500 + Math.max(0, 50 - t.length)
  const idx = t.indexOf(q)
  if (idx !== -1) return 200 - idx * 2 + Math.max(0, 30 - (t.length - q.length))

  // All chars in order
  let qi = 0
  let lastIdx = -1
  let score = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += ti === lastIdx + 1 ? 5 : 1
      lastIdx = ti
      qi++
    }
  }
  return qi === q.length ? score : 0
}

interface ScoredStar { star: Star; score: number }

function searchStars(stars: Star[], query: string, limit = 12): ScoredStar[] {
  const scored: ScoredStar[] = []
  for (const s of stars) {
    let best = fuzzyScore(query, s.name)
    for (const alias of s.aliases) {
      const aliasScore = fuzzyScore(query, alias)
      if (aliasScore > best) best = aliasScore
    }
    if (best > 0) scored.push({ star: s, score: best })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

function loadRecent(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : []
  } catch {
    return []
  }
}

function saveRecent(name: string) {
  if (typeof window === "undefined") return
  try {
    const current = loadRecent().filter((n) => n !== name)
    current.unshift(name)
    localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, MAX_RECENT)))
  } catch {}
}

export function StarSearch({ stars, selected, onSelect, closeSignal }: StarSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [apiResult, setApiResult] = useState<CustomStar | null>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setRecent(loadRecent()) }, [])

  // Expose focus via global keyboard listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const parsed = useMemo(() => (query.trim() ? parseInput(query) : null), [query])
  const results = useMemo(
    () => (query.trim() && !parsed ? searchStars(stars, query) : []),
    [stars, query, parsed],
  )

  // Debounced SIMBAD lookup when local search has no high-quality results
  useEffect(() => {
    setApiResult(null)
    if (!query.trim() || parsed) {
      setApiLoading(false)
      return
    }
    const topScore = results[0]?.score ?? 0
    if (topScore >= 500) {
      setApiLoading(false)
      return
    }
    const handle = setTimeout(async () => {
      setApiLoading(true)
      try {
        const r = await fetch(`/api/star-resolve?name=${encodeURIComponent(query.trim())}`)
        if (r.ok) {
          const data = await r.json()
          setApiResult({ name: data.name, gl: data.gl, gb: data.gb, dist: data.dist })
        }
      } catch {}
      setApiLoading(false)
    }, 350)
    return () => clearTimeout(handle)
  }, [query, parsed, results])

  const recentStars = useMemo(() => {
    const map = new Map(stars.map((s) => [s.name, s]))
    return recent.map((n) => map.get(n)).filter((s): s is Star => !!s)
  }, [recent, stars])

  const showDropdown =
    open &&
    (query.trim().length > 0 || recentStars.length > 0)

  const handleSelect = useCallback(
    (star: Star | CustomStar) => {
      onSelect(star)
      saveRecent(star.name)
      setRecent(loadRecent())
      setQuery("")
      setOpen(false)
    },
    [onSelect],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setQuery("")
        setOpen(false)
        inputRef.current?.blur()
        return
      }
      if (e.key === "Enter") {
        if (parsed) handleSelect(parsed)
        else if (results[0]) handleSelect(results[0].star)
        else if (apiResult) handleSelect(apiResult)
      }
    },
    [parsed, results, apiResult, handleSelect],
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

  // External close trigger — parent flips this when something else (e.g.
  // the pulsar list sidebar) opens and we should yield focus.
  useEffect(() => {
    if (closeSignal) {
      setOpen(false)
      setQuery("")
      inputRef.current?.blur()
    }
  }, [closeSignal])

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={`${selected.name}  ·  / to search`}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="bg-transparent border-b border-foreground/30 px-0 py-1.5 text-[11px] w-full outline-none placeholder:text-foreground/50 focus:border-accent"
        spellCheck={false}
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 bg-background border border-foreground/10 max-h-64 overflow-y-auto">
          {parsed && (
            <button
              type="button"
              className="w-full text-left px-2 py-1 text-[10px] hover:bg-foreground/5 cursor-pointer"
              onClick={() => handleSelect(parsed)}
            >
              <span className="text-foreground">go to {parsed.name}</span>
            </button>
          )}

          {!query.trim() && recentStars.length > 0 && (
            <>
              <div className="px-2 py-1 text-[9px] text-foreground/40 uppercase tracking-wider">recent</div>
              {recentStars.map((star) => (
                <button
                  key={`recent-${star.name}`}
                  type="button"
                  className="w-full text-left px-2 py-1 text-[10px] hover:bg-foreground/5 cursor-pointer flex justify-between gap-2"
                  onClick={() => handleSelect(star)}
                >
                  <span className="text-foreground truncate">{star.name}</span>
                  <span className="text-foreground/50 shrink-0">{star.dist.toFixed(2)} kpc</span>
                </button>
              ))}
            </>
          )}

          {results.map(({ star }) => (
            <button
              key={star.name}
              type="button"
              className="w-full text-left px-2 py-1 text-[10px] hover:bg-foreground/5 cursor-pointer flex justify-between gap-2"
              onClick={() => handleSelect(star)}
            >
              <span className="text-foreground truncate">{star.name}</span>
              <span className="text-foreground/50 shrink-0">{star.dist.toFixed(2)} kpc</span>
            </button>
          ))}

          {apiLoading && !parsed && (
            <div className="px-2 py-1 text-[10px] text-foreground/50 italic">searching SIMBAD…</div>
          )}

          {apiResult && !parsed && (
            <button
              type="button"
              className="w-full text-left px-2 py-1 text-[10px] hover:bg-foreground/5 cursor-pointer flex justify-between gap-2 border-t border-foreground/10"
              onClick={() => handleSelect(apiResult)}
            >
              <span className="text-foreground truncate">
                {apiResult.name} <span className="text-foreground/40">via SIMBAD</span>
              </span>
              <span className="text-foreground/50 shrink-0">{apiResult.dist.toFixed(2)} kpc</span>
            </button>
          )}

          {query.trim() && !parsed && results.length === 0 && !apiLoading && !apiResult && (
            <div className="px-2 py-1 text-[10px] text-foreground/50 italic">no matches</div>
          )}
        </div>
      )}
    </div>
  )
}
