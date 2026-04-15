import { useEffect, useRef, useState } from "react"
import type { AppState } from "@/lib/state"
import { buildSearchString, parseState } from "@/lib/state"

const STORAGE_KEY = "astrolabe.saved_views"
const MAX_VIEWS = 20

interface SavedView {
  id: string
  name: string
  search: string
  savedAt: number
}

function loadViews(): SavedView[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (v): v is SavedView =>
        v &&
        typeof v.id === "string" &&
        typeof v.name === "string" &&
        typeof v.search === "string" &&
        typeof v.savedAt === "number",
    )
  } catch {
    return []
  }
}

function writeViews(views: SavedView[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {}
}

function formatAge(ts: number): string {
  const delta = Date.now() - ts
  const sec = Math.round(delta / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  return `${day}d ago`
}

interface SavedViewsProps {
  open: boolean
  onClose: () => void
  state: AppState
  onApply: (state: AppState) => void
  onToast: (msg: string) => void
}

export function SavedViews({ open, onClose, state, onApply, onToast }: SavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>([])
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setViews(loadViews())
      setName("")
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      inputRef.current?.focus()
      return
    }
    const search = buildSearchString(state)
    const nextView: SavedView = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      search,
      savedAt: Date.now(),
    }
    const next = [nextView, ...views.filter((v) => v.name !== trimmed)].slice(0, MAX_VIEWS)
    writeViews(next)
    setViews(next)
    setName("")
    onToast(`saved · ${trimmed}`)
  }

  function apply(view: SavedView) {
    const params = new URLSearchParams(view.search.startsWith("?") ? view.search.slice(1) : view.search)
    const nextState = parseState(params)
    onApply(nextState)
    onToast(`loaded · ${view.name}`)
    onClose()
  }

  function remove(id: string) {
    const next = views.filter((v) => v.id !== id)
    writeViews(next)
    setViews(next)
  }

  return (
    <div
      className="fixed inset-0 z-[110] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-views-title"
        className="bg-background border border-foreground/20 max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2
            id="saved-views-title"
            className="text-[15px] text-foreground leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            saved views
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-foreground/50 hover:text-foreground text-[14px] cursor-pointer leading-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            ref={inputRef}
            type="text"
            value={name}
            placeholder="name this view…"
            maxLength={48}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                save()
              }
            }}
            className="flex-1 bg-transparent border-b border-foreground/30 px-0 py-1.5 text-[11px] outline-none placeholder:text-foreground/40 focus:border-foreground"
            aria-label="view name"
          />
          <button
            type="button"
            onClick={save}
            className="text-[10px] bg-foreground text-background px-3 py-1.5 cursor-pointer hover:bg-foreground/90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            save current
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto -mx-1 themed-scroll">
          {views.length === 0 ? (
            <p className="px-1 py-6 text-[10px] text-foreground/50 italic text-center">
              no saved views yet · save the current map to name and recall it later.
            </p>
          ) : (
            <ul className="flex flex-col">
              {views.map((v) => (
                <li key={v.id} className="flex items-stretch hover:bg-foreground/5 group">
                  <button
                    type="button"
                    onClick={() => apply(v)}
                    className="flex-1 min-w-0 text-left px-2 py-1.5 flex justify-between items-baseline gap-3 cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
                  >
                    <span className="text-[11px] text-foreground truncate">{v.name}</span>
                    <span className="text-[9px] text-foreground/40 shrink-0 tabular-nums">
                      {formatAge(v.savedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    aria-label={`delete ${v.name}`}
                    className="px-2 text-[11px] text-foreground/30 hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-[9px] text-foreground/40 uppercase tracking-wider">
          stored locally · press v to toggle · esc to close
        </p>
      </div>
    </div>
  )
}
