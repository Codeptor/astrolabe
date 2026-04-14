// URL state schema and serialization for sharing/bookmarking views.
// Pattern: every shareable bit of state has a key here, and is round-tripped
// through `parseState` / `buildSearchString`. Defaults are omitted from the URL.

import { parseCoordObserverString } from "./custom-observer"

export type CustomObserver = {
  name: string
  gl: number
  gb: number
  dist: number
}

export type ObserverRef =
  | { kind: "star"; name: string }
  | { kind: "custom"; data: CustomObserver }

// All themes are first-class equals — dark, light, and color presets share
// one picker. Managed by next-themes via the `themes` prop on ThemeProvider.
export type Theme = "dark" | "light" | "gold" | "blueprint"

export const ALL_THEMES: Theme[] = ["dark", "light", "gold", "blueprint"]

export type Algorithm = "gdop" | "fastest" | "closest" | "longest" | "stable" | "random"

export const ALL_ALGORITHMS: Algorithm[] = [
  "gdop",
  "fastest",
  "closest",
  "longest",
  "stable",
  "random",
]

export interface AppState {
  mode: "1972" | "custom"
  observer: ObserverRef
  pulsar: string | null  // locked pulsar name (e.g. "J1243-6423")
  count: number          // 5–50, default 14
  rings: boolean         // distance scale rings visible
  theme: Theme
  algorithm: Algorithm
  epoch: number          // years offset from 2026, for time machine (-10000 to +10000)
}

export const DEFAULT_STATE: AppState = {
  mode: "custom",
  observer: { kind: "star", name: "Sol" },
  pulsar: null,
  count: 14,
  rings: false,
  theme: "dark",
  algorithm: "gdop",
  epoch: 0,
}

function encodeObserver(o: ObserverRef): string {
  if (o.kind === "star") return o.name
  const c = o.data
  return `coord:l=${c.gl},b=${c.gb},d=${c.dist}`
}

function decodeObserver(s: string): ObserverRef | null {
  if (!s) return null
  if (s.startsWith("coord:")) {
    const parsed = parseCoordObserverString(s)
    if (!parsed) return null
    return {
      kind: "custom",
      data: parsed,
    }
  }
  return { kind: "star", name: s }
}

export function parseState(search: URLSearchParams): AppState {
  const out: AppState = { ...DEFAULT_STATE }

  const mode = search.get("mode")
  if (mode === "1972") out.mode = "1972"

  const from = search.get("from")
  if (from) {
    const o = decodeObserver(from)
    if (o) out.observer = o
  }

  const pulsar = search.get("p")
  if (pulsar) out.pulsar = pulsar

  const count = search.get("n")
  if (count) {
    const n = parseInt(count, 10)
    if (!Number.isNaN(n) && n >= 5 && n <= 50) out.count = n
  }

  if (search.get("rings") === "1") out.rings = true

  const theme = search.get("theme")
  if (theme && (ALL_THEMES as string[]).includes(theme)) {
    out.theme = theme as Theme
  }

  const algo = search.get("algo")
  if (algo && (ALL_ALGORITHMS as string[]).includes(algo)) {
    out.algorithm = algo as Algorithm
  }

  const epoch = search.get("e")
  if (epoch) {
    const ev = parseInt(epoch, 10)
    if (!Number.isNaN(ev) && ev >= -10_000_000 && ev <= 10_000_000) out.epoch = ev
  }

  return out
}

export function buildSearchString(state: AppState): string {
  const params = new URLSearchParams()
  if (state.mode !== DEFAULT_STATE.mode) params.set("mode", state.mode)
  if (
    state.observer.kind !== DEFAULT_STATE.observer.kind ||
    (state.observer.kind === "star" &&
      state.observer.name !== (DEFAULT_STATE.observer as { kind: "star"; name: string }).name)
  ) {
    params.set("from", encodeObserver(state.observer))
  }
  if (state.pulsar) params.set("p", state.pulsar)
  if (state.count !== DEFAULT_STATE.count) params.set("n", String(state.count))
  if (state.rings) params.set("rings", "1")
  if (state.theme !== DEFAULT_STATE.theme) params.set("theme", state.theme)
  if (state.algorithm !== DEFAULT_STATE.algorithm) params.set("algo", state.algorithm)
  if (state.epoch !== DEFAULT_STATE.epoch) params.set("e", String(state.epoch))
  const s = params.toString()
  return s ? `?${s}` : ""
}

export function shareableUrl(state: AppState): string {
  if (typeof window === "undefined") return ""
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}${buildSearchString(state)}`
}
