"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import type { Star } from "@/lib/types"
import { createLatestOnlyRunner } from "@/lib/async-latest"
import { looksLikeObserverInput, parseObserverInput } from "@/lib/custom-observer"

type CustomStar = { name: string; gl: number; gb: number; dist: number; aliases?: string[] }

interface StarSearchProps {
  stars: Star[]
  selected: Star | { name: string; gl: number; gb: number; dist: number }
  onSelect: (star: Star | CustomStar) => void
  closeSignal?: boolean
}

const RECENT_KEY = "astrolabe.recent_stars"
const MAX_RECENT = 6

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

  const parsed = useMemo(() => (query.trim() ? parseObserverInput(query) : null), [query])
  const structuredInput = useMemo(() => looksLikeObserverInput(query), [query])
  const results = useMemo(
    () => (query.trim() && !parsed ? searchStars(stars, query) : []),
    [stars, query, parsed],
  )
  const resolveRemoteStar = useMemo(
    () =>
      createLatestOnlyRunner(async (name: string): Promise<CustomStar | null> => {
        const response = await fetch(`/api/star-resolve?name=${encodeURIComponent(name)}`)
        if (!response.ok) return null
        const data = await response.json()
        return { name: data.name, gl: data.gl, gb: data.gb, dist: data.dist }
      }),
    [],
  )

  // Debounced SIMBAD lookup when local search has no high-quality results
  useEffect(() => {
    let cancelled = false
    setApiResult(null)
    if (!query.trim() || parsed) {
      setApiLoading(false)
      return
    }
    if (structuredInput) {
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
        const { value, isLatest } = await resolveRemoteStar(query.trim())
        if (!cancelled && isLatest) {
          setApiResult(value)
        }
      } catch {
        if (!cancelled) setApiResult(null)
      } finally {
        if (!cancelled) setApiLoading(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, parsed, results, resolveRemoteStar, structuredInput])

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
