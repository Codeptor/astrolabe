import { Component, type ErrorInfo, type ReactNode, useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Volume2, VolumeOff } from "lucide-react"
import type { Pulsar, Star, RelativePulsar, PlaqueData } from "@/lib/types"
import { selectPulsars } from "@/lib/pulsar-selection"
import { computePioneerPlaque } from "@/lib/pioneer-original"
import {
  galacticCenterAngle,
  galacticCenterDistance,
  relativePosition,
} from "@/lib/coordinates"
import {
  type AppState,
  type ObserverRef,
  type CustomObserver,
  ALL_THEMES,
  ALL_ALGORITHMS,
  DEFAULT_STATE,
  parseState,
  buildSearchString,
} from "@/lib/state"
import { useTheme } from "@/lib/theme"
import { applyProperMotion, evolvePeriod } from "@/lib/proper-motion"
import { playPulsar, playToggleCue, type PulsarVoice } from "@/lib/pulsar-audio"
import Plaque from "@/components/plaque"
import { StarSearch } from "@/components/star-search"
import { PulsarTooltip } from "@/components/pulsar-tooltip"
import { ExportButton } from "@/components/export-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AlgorithmPicker } from "@/components/algorithm-picker"
import { PulsarList } from "@/components/pulsar-list"
import { CoordPicker } from "@/components/coord-picker"
import { EmbedModal } from "@/components/embed-modal"
import { Onboarding } from "@/components/onboarding"

const DEG = Math.PI / 180
const SOL: Star = { name: "Sol", gl: 0, gb: 0, dist: 0, aliases: ["Sun", "Earth"] }

function formatPulsarForCopy(rp: RelativePulsar): string {
  const p = rp.pulsar
  const period =
    p.p0 < 0.001
      ? `${(p.p0 * 1e6).toFixed(2)}µs`
      : p.p0 < 1
        ? `${(p.p0 * 1e3).toFixed(3)}ms`
        : `${p.p0.toFixed(5)}s`
  return `PSR ${p.name} | P=${period} | d=${rp.dist.toFixed(3)}kpc | l=${rp.gl.toFixed(2)}° b=${rp.gb.toFixed(2)}°`
}

function formatEpoch(epoch: number): string {
  if (epoch === 0) return "now"
  const sign = epoch > 0 ? "+" : "-"
  const abs = Math.abs(epoch)
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}Myr`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}kyr`
  return `${sign}${abs}y`
}

function observerToOrigin(
  ref: ObserverRef,
  stars: Star[],
): Star | { name: string; gl: number; gb: number; dist: number; aliases?: string[] } {
  if (ref.kind === "custom") return ref.data
  const found = stars.find((s) => s.name === ref.name)
  return found ?? SOL
}

function readSearch(): string {
  if (typeof window === "undefined") return ""
  return window.location.search
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center px-6 gap-6">
          <div className="flex flex-col items-center gap-2 text-center max-w-md">
            <p
              className="text-[24px] leading-none text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              signal lost
            </p>
            <p className="text-[11px] text-foreground/60">
              something broke while computing the pulsar map.
            </p>
          </div>
          <button
            type="button"
            onClick={this.reset}
            className="text-[10px] text-foreground/70 hover:text-foreground transition border border-foreground/20 hover:border-foreground/50 px-3 py-1.5 cursor-pointer"
          >
            try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function PageInner() {
  const { setTheme } = useTheme()

  // Parse the URL once on mount, then keep state in React. Updates to state
  // push to the URL via history.replaceState so back/forward + bookmarks work.
  const initialState = useMemo<AppState>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE
    return parseState(new URLSearchParams(window.location.search))
  }, [])

  const [appState, setAppState] = useState<AppState>(initialState)
  const [pulsars, setPulsars] = useState<Pulsar[]>([])
  const [stars, setStars] = useState<Star[]>([])
  const [hoveredPulsar, setHoveredPulsar] = useState<RelativePulsar | null>(null)
  const [lockedPulsar, setLockedPulsar] = useState<RelativePulsar | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [coordOpen, setCoordOpen] = useState(false)
  const [embedOpen, setEmbedOpen] = useState(false)
  // Audio playback — when enabled, hovering a pulsar plays its period;
  // leaving the pulsar stops it. Off by default (browser autoplay policies).
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [timePlaying, setTimePlaying] = useState(false)
  const voiceRef = useRef<PulsarVoice | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track the last search string we wrote to the URL, so the popstate handler
  // can tell whether a URL change came from us (ignore) or from the
  // browser back/forward (sync).
  const lastPushedSearch = useRef<string>(buildSearchString(initialState))

  // Load catalogue + stars once
  useEffect(() => {
    Promise.all([
      fetch("/data/pulsars.json").then((r) => r.json()),
      fetch("/data/stars.json").then((r) => r.json()),
    ]).then(([p, s]: [Pulsar[], Star[]]) => {
      setPulsars(p)
      setStars(s)
    })
  }, [])

  // Sync theme to the <html> class (theme hook writes both class and localStorage)
  useEffect(() => {
    setTheme(appState.theme)
  }, [appState.theme, setTheme])

  // State → URL: after each state change, replace the URL (no scroll, no history push)
  useEffect(() => {
    const search = buildSearchString(appState)
    if (search === lastPushedSearch.current) return
    lastPushedSearch.current = search
    const href = `${window.location.pathname}${search}`
    window.history.replaceState(null, "", href)
  }, [appState])

  // URL → state: on browser back/forward, sync state from URL.
  // Skip if the current URL already matches our last pushed search.
  useEffect(() => {
    const onPop = () => {
      const currentSearch = readSearch()
      if (currentSearch === lastPushedSearch.current) return
      lastPushedSearch.current = currentSearch
      setAppState(parseState(new URLSearchParams(currentSearch)))
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  // Resolve observer ref → actual coordinates
  const origin = useMemo(
    () => observerToOrigin(appState.observer, stars),
    [appState.observer, stars],
  )

  const plaqueData = useMemo<PlaqueData | null>(() => {
    if (pulsars.length === 0) return null
    const useOrigin = appState.mode === "1972" ? SOL : origin

    // Select pulsars from the present-day catalogue first so the chosen set
    // stays stable as the time-machine slider moves. Otherwise the line set
    // would shuffle on every drag and re-trigger the discovery animation.
    const selected =
      appState.mode === "1972"
        ? computePioneerPlaque(pulsars)
        : selectPulsars(pulsars, useOrigin, appState.count, appState.algorithm)

    // Then apply synthetic proper motion + spindown to the chosen pulsars
    // and recompute their relative coordinates. Position drift smoothly
    // rotates/resizes the lines; period evolution flips bits in the binary
    // code (real pulsars slow down via magnetic braking).
    const driftedSelected =
      appState.epoch === 0
        ? selected
        : selected.map((rp) => {
            const drifted = applyProperMotion(rp.pulsar, appState.epoch)
            const evolvedP0 = evolvePeriod(
              rp.pulsar.p0,
              rp.pulsar.p1,
              appState.epoch,
            )
            const driftedPulsar = {
              ...rp.pulsar,
              gl: drifted.gl,
              gb: drifted.gb,
              p0: evolvedP0,
            }
            const rel = relativePosition(useOrigin, {
              gl: driftedPulsar.gl,
              gb: driftedPulsar.gb,
              dist: driftedPulsar.dist,
            })
            if (rel.dist < 1e-6) return rp
            const angle = Math.atan2(
              Math.sin(rel.gl * DEG) * Math.cos(rel.gb * DEG),
              Math.cos(rel.gl * DEG) * Math.cos(rel.gb * DEG),
            )
            return {
              ...rp,
              pulsar: driftedPulsar,
              gl: rel.gl,
              gb: rel.gb,
              dist: rel.dist,
              angle,
            }
          })

    const gcAngle = galacticCenterAngle(useOrigin)
    const gcDist = galacticCenterDistance(useOrigin)
    return { origin: useOrigin, pulsars: driftedSelected, gcAngle, gcDist }
  }, [pulsars, origin, appState.mode, appState.count, appState.algorithm, appState.epoch])

  // Apply persisted locked pulsar from URL once data is loaded
  useEffect(() => {
    if (!plaqueData) return
    if (appState.pulsar && !lockedPulsar) {
      const found = plaqueData.pulsars.find(
        (rp) => rp.pulsar.name === appState.pulsar,
      )
      if (found) setLockedPulsar(found)
    }
    // If selected pulsar drops out of the new selection, clear lock
    if (lockedPulsar) {
      const stillThere = plaqueData.pulsars.find(
        (rp) => rp.pulsar.name === lockedPulsar.pulsar.name,
      )
      if (!stillThere) setLockedPulsar(null)
    }
  }, [plaqueData, appState.pulsar])

  // Hover previews via the plaque line highlight + footer tooltip.
  // The pulsar *list* selection (highlight + auto-scroll) is reserved
  // for click-to-lock — see the lockedPulsar prop on <PulsarList> below.
  const activePulsar = lockedPulsar ?? hoveredPulsar
  const distToGC = plaqueData?.gcDist ?? 0

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    const id = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(id)
  }, [])

  const handleStarSelect = useCallback(
    (star: Star | { name: string; gl: number; gb: number; dist: number; aliases?: string[] }) => {
      const isCustom = !stars.find((s) => s.name === star.name)
      const observer: ObserverRef = isCustom
        ? {
            kind: "custom",
            data: { name: star.name, gl: star.gl, gb: star.gb, dist: star.dist },
          }
        : { kind: "star", name: star.name }
      setAppState((s) => ({ ...s, observer, mode: "custom", pulsar: null }))
      setLockedPulsar(null)
      setHoveredPulsar(null)
    },
    [stars, setAppState],
  )

  const handleCustomCoords = useCallback(
    (obs: CustomObserver) => {
      setAppState((s) => ({
        ...s,
        observer: { kind: "custom", data: obs },
        mode: "custom",
        pulsar: null,
      }))
      setLockedPulsar(null)
      setHoveredPulsar(null)
    },
    [setAppState],
  )

  const handlePulsarSelect = useCallback(
    (rp: RelativePulsar | null) => {
      setLockedPulsar(rp)
      setAppState((s) => ({ ...s, pulsar: rp?.pulsar.name ?? null }))
    },
    [setAppState],
  )

  const handlePulsarCopy = useCallback(
    (rp: RelativePulsar) => {
      const text = formatPulsarForCopy(rp)
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(
          () => showToast("copied"),
          () => showToast("copy failed"),
        )
      }
    },
    [showToast],
  )

  const handleReset = useCallback(() => {
    // Preserve the current theme — only reset observer / pulsar / view options.
    setAppState((s) => ({ ...DEFAULT_STATE, theme: s.theme }))
    setLockedPulsar(null)
    setHoveredPulsar(null)
    setTimePlaying(false)
  }, [setAppState])

  // Time-lapse tick: advances epoch by one slider step every 50ms,
  // loops from +10Myr back to -10Myr. Stops on any manual interaction.
  useEffect(() => {
    if (!timePlaying) return
    const id = window.setInterval(() => {
      setAppState((s) => {
        const next = s.epoch + 50_000
        return { ...s, epoch: next > 10_000_000 ? -10_000_000 : next }
      })
    }, 50)
    return () => window.clearInterval(id)
  }, [timePlaying])

  const handleRandomStar = useCallback(() => {
    if (stars.length === 0) return
    const pool = stars.filter((s) => s.name !== "Sol" && s.name !== origin.name)
    if (pool.length === 0) return
    const pick = pool[Math.floor(Math.random() * pool.length)]!
    handleStarSelect(pick)
    showToast(`→ ${pick.name}`)
  }, [stars, origin.name, handleStarSelect, showToast])

  // Hover-to-play: whenever the hovered pulsar changes (and audio is on),
  // start a fresh voice for it and stop the previous one. Stops on unhover.
  useEffect(() => {
    if (voiceRef.current) {
      voiceRef.current.stop()
      voiceRef.current = null
    }
    if (!audioEnabled || !hoveredPulsar) return
    voiceRef.current = playPulsar(hoveredPulsar)
    return () => {
      if (voiceRef.current) {
        voiceRef.current.stop()
        voiceRef.current = null
      }
    }
  }, [audioEnabled, hoveredPulsar])

  // Stop the voice on unmount
  useEffect(() => {
    return () => {
      if (voiceRef.current) {
        voiceRef.current.stop()
        voiceRef.current = null
      }
    }
  }, [])

  // Place observer at a uniformly-random point in the galactic disk —
  // not from the curated star list, just somewhere in the galaxy.
  const handleRandomElsewhere = useCallback(() => {
    // Distance: 1 to 12 kpc, biased toward closer
    const dist = 1 + Math.random() * 11
    // Galactic longitude: uniform 0–360
    const gl = Math.random() * 360
    // Galactic latitude: tightly clustered around the disk (±1°)
    const gb = (Math.random() - 0.5) * 2
    const obs: CustomObserver = {
      name: `random l=${gl.toFixed(0)}° d=${dist.toFixed(1)}kpc`,
      gl,
      gb,
      dist,
    }
    handleCustomCoords(obs)
    showToast("→ random galactic point")
  }, [handleCustomCoords, showToast])

  // Keyboard navigation through pulsars (Tab/Shift-Tab/arrows when sidebar open)
  const cyclePulsar = useCallback(
    (direction: 1 | -1) => {
      if (!plaqueData || plaqueData.pulsars.length === 0) return
      const sorted = [...plaqueData.pulsars].sort((a, b) => a.angle - b.angle)
      const currentIdx = lockedPulsar
        ? sorted.findIndex((rp) => rp.pulsar.name === lockedPulsar.pulsar.name)
        : -1
      const nextIdx =
        currentIdx === -1
          ? direction === 1
            ? 0
            : sorted.length - 1
          : (currentIdx + direction + sorted.length) % sorted.length
      const next = sorted[nextIdx]!
      handlePulsarSelect(next)
    },
    [plaqueData, lockedPulsar, handlePulsarSelect],
  )

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return
      if (document.activeElement?.tagName === "TEXTAREA") return

      if (e.key === "Escape") {
        if (infoOpen) {
          setInfoOpen(false)
          return
        }
        if (coordOpen) {
          setCoordOpen(false)
          return
        }
        if (embedOpen) {
          setEmbedOpen(false)
          return
        }
        if (sidebarOpen) {
          setSidebarOpen(false)
          return
        }
        if (lockedPulsar) {
          handlePulsarSelect(null)
          return
        }
        handleReset()
        return
      }

      if (e.key === "?") {
        e.preventDefault()
        setInfoOpen((v) => !v)
      } else if (e.key === "r" || e.key === "R") {
        if (infoOpen) return
        if (e.shiftKey) handleRandomElsewhere()
        else handleRandomStar()
      } else if (e.key === "l" || e.key === "L") {
        if (infoOpen) return
        setSidebarOpen((v) => !v)
      } else if (e.key === "g" || e.key === "G") {
        if (infoOpen) return
        setAppState((s) => ({ ...s, rings: !s.rings }))
      } else if (e.key === "m" || e.key === "M") {
        if (infoOpen) return
        setAppState((s) => ({
          ...s,
          mode: s.mode === "1972" ? "custom" : "1972",
          pulsar: null,
        }))
        setLockedPulsar(null)
        setHoveredPulsar(null)
      } else if (e.key === "a" || e.key === "A") {
        if (infoOpen) return
        setAppState((s) => {
          const idx = ALL_ALGORITHMS.indexOf(s.algorithm)
          const next = ALL_ALGORITHMS[(idx + 1) % ALL_ALGORITHMS.length]!
          showToast(`algo · ${next}`)
          return { ...s, algorithm: next }
        })
      } else if (e.key === "t" || e.key === "T") {
        if (infoOpen) return
        setAppState((s) => {
          const idx = ALL_THEMES.indexOf(s.theme)
          const next = ALL_THEMES[(idx + 1) % ALL_THEMES.length]!
          showToast(`theme · ${next}`)
          return { ...s, theme: next }
        })
      } else if (e.key === "s" || e.key === "S") {
        if (infoOpen) return
        setAudioEnabled((v) => {
          const next = !v
          playToggleCue(next)
          showToast(next ? "audio on — hover any pulsar" : "audio muted")
          return next
        })
      } else if (e.key === "k" || e.key === "K") {
        if (infoOpen || coordOpen || embedOpen) return
        setCoordOpen(true)
      } else if (e.key === "e" || e.key === "E") {
        if (infoOpen || coordOpen || embedOpen) return
        setEmbedOpen(true)
      } else if (e.key === "[") {
        if (infoOpen) return
        setAppState((s) => ({ ...s, count: Math.max(5, s.count - 1) }))
      } else if (e.key === "]") {
        if (infoOpen) return
        setAppState((s) => ({ ...s, count: Math.min(50, s.count + 1) }))
      } else if (e.key === ",") {
        if (infoOpen) return
        setAppState((s) => ({ ...s, epoch: Math.max(-10_000_000, s.epoch - 10_000) }))
      } else if (e.key === ".") {
        if (infoOpen) return
        setAppState((s) => ({ ...s, epoch: Math.min(10_000_000, s.epoch + 10_000) }))
      } else if (e.key === "<") {
        if (infoOpen) return
        setAppState((s) => ({ ...s, epoch: Math.max(-10_000_000, s.epoch - 1_000_000) }))
      } else if (e.key === ">") {
        if (infoOpen) return
        setAppState((s) => ({ ...s, epoch: Math.min(10_000_000, s.epoch + 1_000_000) }))
      } else if (e.key === "0") {
        if (infoOpen) return
        setTimePlaying(false)
        setAppState((s) => ({ ...s, epoch: 0 }))
      } else if (e.key === " ") {
        if (infoOpen || coordOpen || embedOpen) return
        e.preventDefault()
        setTimePlaying((p) => !p)
      } else if (e.key === "Tab") {
        if (infoOpen || coordOpen || embedOpen) return
        e.preventDefault()
        cyclePulsar(e.shiftKey ? -1 : 1)
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        if (infoOpen || coordOpen || embedOpen) return
        if (lockedPulsar) {
          e.preventDefault()
          cyclePulsar(1)
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        if (infoOpen || coordOpen || embedOpen) return
        if (lockedPulsar) {
          e.preventDefault()
          cyclePulsar(-1)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    infoOpen,
    coordOpen,
    embedOpen,
    sidebarOpen,
    lockedPulsar,
    handleRandomStar,
    handleRandomElsewhere,
    handleReset,
    handlePulsarSelect,
    cyclePulsar,
    showToast,
    setAppState,
  ])

  if (pulsars.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted text-[10px] animate-pulse">loading catalogue...</p>
      </div>
    )
  }

  const dot = <span className="text-foreground/40">·</span>

  return (
    <div
      ref={containerRef}
      className="flex h-svh flex-col overflow-hidden"
      onClick={() => {
        setLockedPulsar(null)
        setHoveredPulsar(null)
        setAppState((s) => ({ ...s, pulsar: null }))
      }}
    >
      {/* Header */}
      <header className="shrink-0 px-4 pt-3 sm:px-6 sm:pt-4 flex items-baseline justify-between z-50 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-foreground leading-none">astrolabe</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setAppState((s) => ({
                  ...s,
                  mode: s.mode === "1972" ? "custom" : "1972",
                  pulsar: null,
                }))
                setLockedPulsar(null)
                setHoveredPulsar(null)
              }}
              className={`text-[10px] transition cursor-pointer border px-2 py-[5px] ${
                appState.mode === "1972"
                  ? "text-background bg-foreground border-foreground"
                  : "text-foreground/70 hover:text-foreground border-foreground/20 hover:border-foreground/50"
              }`}
              title="show the original 1972 Pioneer plaque (Drake's 14 pulsars from Sol)"
            >
              1972
            </button>
            <div
              className="w-[240px]"
              onFocusCapture={() => setSidebarOpen(false)}
            >
              <StarSearch
                stars={stars}
                selected={origin}
                onSelect={(s) => handleStarSelect(s)}
                closeSignal={sidebarOpen}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setCoordOpen(true)
              }}
              className="text-[10px] text-foreground/60 hover:text-foreground transition cursor-pointer border border-foreground/15 hover:border-foreground/40 px-2 py-[5px]"
              title="enter custom coordinates"
            >
              coords
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRandomElsewhere()
              }}
              className="text-[10px] text-foreground/60 hover:text-foreground transition cursor-pointer border border-foreground/15 hover:border-foreground/40 px-2 py-[5px]"
              title="place observer at a random point in the galactic disk"
            >
              random *
            </button>
          </div>
        </div>

        {plaqueData && (
          <div className="hidden md:flex gap-3 text-[10px] text-foreground/70 leading-none">
            <span>{plaqueData.pulsars.length} pulsars</span>
            {dot}
            <span>from {origin.name}</span>
            {dot}
            <span>{distToGC.toFixed(1)} kpc</span>
          </div>
        )}

        <div className="flex flex-col items-end gap-3">
          {/* Action buttons */}
          <div className="flex items-center gap-4 leading-none text-[10px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setAudioEnabled((v) => {
                  const next = !v
                  playToggleCue(next)
                  showToast(next ? "audio on — hover any pulsar" : "audio muted")
                  return next
                })
              }}
              className="inline-flex items-center leading-none text-foreground/70 hover:text-foreground transition cursor-pointer"
              title={audioEnabled ? "mute" : "unmute"}
              aria-label={audioEnabled ? "mute audio" : "unmute audio"}
            >
              {audioEnabled ? <Volume2 size={11} /> : <VolumeOff size={11} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleReset()
                showToast("reset")
              }}
              className="text-[10px] text-foreground/70 hover:text-foreground transition cursor-pointer"
              title="reset observer to Sol (Esc)"
            >
              reset
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSidebarOpen((v) => !v)
              }}
              className="text-[10px] text-foreground/70 hover:text-foreground transition cursor-pointer"
              title="toggle pulsar list (L)"
            >
              list
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setAppState((s) => ({ ...s, rings: !s.rings }))
              }}
              className={`text-[10px] transition cursor-pointer ${
                appState.rings ? "text-foreground" : "text-foreground/70 hover:text-foreground"
              }`}
              title="toggle distance scale rings (G)"
            >
              rings
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setEmbedOpen(true)
              }}
              className="text-[10px] text-foreground/70 hover:text-foreground transition cursor-pointer"
              title="share / embed this view"
            >
              share
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setInfoOpen(true)
              }}
              className="text-[10px] text-foreground/70 hover:text-foreground transition cursor-pointer"
              title="about (?)"
            >
              about
            </button>
            <AlgorithmPicker
              value={appState.algorithm}
              onChange={(a) => setAppState((s) => ({ ...s, algorithm: a }))}
            />
            <ThemeToggle
              value={appState.theme}
              onChange={(t) => setAppState((s) => ({ ...s, theme: t }))}
            />
            <ExportButton
              svgRef={svgRef}
              starName={origin.name}
              theme={appState.theme}
              observerName={origin.name}
              pulsarCount={plaqueData?.pulsars.length ?? 14}
              onToast={showToast}
            />
          </div>

          {/* Pulsar count slider */}
          {appState.mode !== "1972" && (
            <div
              className="flex items-center gap-1.5 text-[9px] text-foreground/55 select-none"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className="text-foreground/75 w-3 text-right">n</span>
              <span className="text-foreground/30">[</span>
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={appState.count}
                onChange={(e) =>
                  setAppState((s) => ({ ...s, count: parseInt(e.target.value, 10) }))
                }
                onClick={(e) => e.stopPropagation()}
                className="themed-slider"
                style={{ width: "112px" }}
                title="number of pulsars to select (5–50)"
                aria-label="number of pulsars"
              />
              <span className="text-foreground/30">]</span>
              <span className="tabular-nums w-14 text-right text-foreground/85">
                {appState.count.toString().padStart(2, "0")}
              </span>
            </div>
          )}

          {/* Time machine slider — applies synthetic proper motion */}
          <div
            className="flex items-center gap-1.5 text-[9px] text-foreground/55 select-none"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <button
              type="button"
              onClick={() => setTimePlaying((p) => !p)}
              aria-label={timePlaying ? "pause time animation" : "play time animation"}
              aria-pressed={timePlaying}
              title={timePlaying ? "pause (space)" : "play time-lapse (space)"}
              className="text-[10px] text-foreground/75 hover:text-foreground cursor-pointer w-3 text-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground"
            >
              {timePlaying ? "⏸" : "▶"}
            </button>
            <span className="text-foreground/75 w-3 text-right">t</span>
            <span className="text-foreground/30">[</span>
            <input
              type="range"
              min={-10_000_000}
              max={10_000_000}
              step={50_000}
              value={appState.epoch}
              onChange={(e) => {
                setTimePlaying(false)
                setAppState((s) => ({ ...s, epoch: parseInt(e.target.value, 10) }))
              }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setTimePlaying(false)
                setAppState((s) => ({ ...s, epoch: 0 }))
              }}
              className="themed-slider"
              style={{ width: "112px" }}
              title="time machine: ±10 Myr from 2026 (double-click to reset)"
              aria-label="time epoch offset in years"
            />
            <span className="text-foreground/30">]</span>
            <span className="tabular-nums w-14 text-right text-foreground/85">
              {formatEpoch(appState.epoch)}
            </span>
          </div>

          {/* Legend + shortcuts */}
          <div className="text-[9px] text-right leading-relaxed whitespace-nowrap hidden sm:block">
            <div className="text-foreground/35 uppercase tracking-[0.1em] text-[8px] mb-1">
              legend
            </div>
            <div className="text-foreground/55 space-y-0.5">
              <div>
                <span className="text-foreground/80">●</span> observer
              </div>
              <div>
                <span className="text-foreground/80">─</span> length = distance (kpc, linear)
              </div>
              <div>
                <span className="font-mono text-foreground/80">| −</span> period bits (H 21cm units)
              </div>
              <div>
                <span className="text-foreground/80">→</span> fixed line = direction to GC
              </div>
            </div>

            <div className="text-foreground/35 uppercase tracking-[0.1em] text-[8px] mt-2.5 mb-1">
              shortcuts
            </div>
            <div className="text-foreground/55 space-y-0.5">
              <div>hover · click to lock · click tooltip to copy</div>
              <div>
                <span className="font-mono text-foreground/75">/</span> search ·{" "}
                <span className="font-mono text-foreground/75">R</span> random ·{" "}
                <span className="font-mono text-foreground/75">⇧R</span> random * ·{" "}
                <span className="font-mono text-foreground/75">K</span> coords ·{" "}
                <span className="font-mono text-foreground/75">M</span> 1972
              </div>
              <div>
                <span className="font-mono text-foreground/75">A</span> algo ·{" "}
                <span className="font-mono text-foreground/75">T</span> theme ·{" "}
                <span className="font-mono text-foreground/75">S</span> sound ·{" "}
                <span className="font-mono text-foreground/75">G</span> rings ·{" "}
                <span className="font-mono text-foreground/75">L</span> list
              </div>
              <div>
                <span className="font-mono text-foreground/75">[ ]</span> count ·{" "}
                <span className="font-mono text-foreground/75">, .</span> ±10 kyr ·{" "}
                <span className="font-mono text-foreground/75">{"< >"}</span> ±1 Myr ·{" "}
                <span className="font-mono text-foreground/75">0</span> now
              </div>
              <div>
                <span className="font-mono text-foreground/75">E</span> share ·{" "}
                <span className="font-mono text-foreground/75">Tab</span> cycle ·{" "}
                <span className="font-mono text-foreground/75">?</span> help ·{" "}
                <span className="font-mono text-foreground/75">Esc</span> reset
              </div>
            </div>
          </div>
        </div>
      </header>

      <main
        id="main"
        aria-label="pulsar map"
        className={`fixed inset-0 z-0 flex items-center justify-center pointer-events-none px-48 py-24 transition-[padding] duration-300 ${
          sidebarOpen ? "md:pl-[324px]" : ""
        }`}
      >
        {plaqueData && (
          <div className="w-full h-full pointer-events-auto">
            <Plaque
              ref={svgRef}
              data={plaqueData}
              activePulsar={activePulsar}
              showRings={appState.rings}
              onHover={setHoveredPulsar}
              onClick={handlePulsarSelect}
            />
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[70] bg-foreground/10 backdrop-blur px-3 py-1 text-[10px] text-foreground border border-foreground/20 pointer-events-none">
          {toast}
        </div>
      )}

      {plaqueData && (
        <PulsarList
          pulsars={plaqueData.pulsars}
          activePulsar={lockedPulsar}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onHover={(rp) => setHoveredPulsar(rp)}
          onSelect={handlePulsarSelect}
        />
      )}

      <CoordPicker
        open={coordOpen}
        onClose={() => setCoordOpen(false)}
        onSubmit={handleCustomCoords}
      />

      <EmbedModal
        open={embedOpen}
        onClose={() => setEmbedOpen(false)}
        state={appState}
        onCopy={showToast}
      />

      <Onboarding />

      {infoOpen && (
        <div
          className="fixed inset-0 z-[100] bg-background/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 sm:p-8 overflow-y-auto"
          onClick={() => setInfoOpen(false)}
        >
          <div
            className="bg-background border border-foreground/20 max-w-2xl w-full p-6 sm:p-8 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <h2
                className="text-[20px] text-foreground leading-none"
                style={{ fontFamily: "var(--font-display)" }}
              >
                about astrolabe
              </h2>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="text-foreground/50 hover:text-foreground text-[14px] cursor-pointer leading-none"
                aria-label="close"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-foreground/70 leading-relaxed space-y-4">
              <p>
                A Pioneer/Voyager-style pulsar map generator. Pick any star in the
                galaxy and Astrolabe computes the best pulsars for triangulating
                that position, rendered in the same line-art style Frank Drake and
                Carl Sagan used to encode humanity's address on the Pioneer plaques
                in 1972.
              </p>

              <div>
                <h3
                  className="text-foreground text-[12px] mb-1.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  what you're seeing
                </h3>
                <p>
                  The center dot is the observer — whichever star you've selected.
                  Each line radiating outward points to one of the pulsars chosen
                  for that vantage point. Three pieces of information are encoded
                  in every line:
                </p>
                <ul className="list-none mt-2 space-y-1.5 pl-3">
                  <li>
                    <span className="text-foreground/90">direction</span> — the
                    pulsar's bearing in galactic coordinates, measured relative to
                    the long horizontal line on the right
                  </li>
                  <li>
                    <span className="text-foreground/90">length</span> — distance
                    from the observer to the pulsar, on a linear scale (kpc)
                  </li>
                  <li>
                    <span className="text-foreground/90">binary tick marks</span>{" "}
                    at the tip — the pulsar's spin period, written in binary using
                    the hydrogen 21-cm spin-flip transition (~0.7040 ns) as the
                    base unit. LSB nearest the observer, MSB at the tip
                    (Pioneer convention).
                  </li>
                </ul>
                <p className="mt-2">
                  The long horizontal line points to the galactic center (Sgr A*)
                  and stays fixed regardless of the observer. It's the universal
                  angular reference — any alien receiver can identify the GC by
                  its bright radio emission, so all pulsar angles on the map are
                  measured relative to it.
                </p>
              </div>

              <div>
                <h3
                  className="text-foreground text-[12px] mb-1.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  how the pulsars are chosen
                </h3>
                <p>
                  Pulsars are picked using Geometric Dilution of Precision
                  (GDOP) — a metric borrowed from GPS theory that measures how
                  well a set of beacons can localize a position. The greedy
                  selector picks one pulsar at a time, balancing three objectives:
                </p>
                <ul className="list-none mt-2 space-y-1.5 pl-3">
                  <li>
                    <span className="text-foreground/90">quality (50%)</span> —
                    characteristic age (long-lived pulsars are more stable),
                    distance diversity, and spin-down stability
                  </li>
                  <li>
                    <span className="text-foreground/90">geometry (35%)</span> —
                    pulsars must span all directions to minimize positional
                    ambiguity (PDOP)
                  </li>
                  <li>
                    <span className="text-foreground/90">uniqueness (15%)</span>{" "}
                    — periods should be distinct enough that decoding isn't
                    ambiguous
                  </li>
                </ul>
              </div>

              <div>
                <h3
                  className="text-foreground text-[12px] mb-1.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  controls
                </h3>
                <ul className="list-none space-y-1 pl-3">
                  <li>
                    <span className="font-mono text-foreground/90">/</span> focus
                    search ·{" "}
                    <span className="font-mono text-foreground/90">R</span> random
                    star ·{" "}
                    <span className="font-mono text-foreground/90">L</span> toggle
                    pulsar list ·{" "}
                    <span className="font-mono text-foreground/90">G</span> toggle
                    rings ·{" "}
                    <span className="font-mono text-foreground/90">?</span> this
                    panel ·{" "}
                    <span className="font-mono text-foreground/90">Esc</span>{" "}
                    close / reset
                  </li>
                  <li>
                    <span className="font-mono text-foreground/90">Tab</span> /{" "}
                    <span className="font-mono text-foreground/90">Shift+Tab</span>{" "}
                    cycle through pulsars · arrow keys when locked
                  </li>
                  <li>
                    hover a pulsar line to see its info in the bottom-left corner
                  </li>
                  <li>
                    click a pulsar line to lock the selection — the info stays
                    even after the mouse moves away
                  </li>
                  <li>
                    click the bottom-left tooltip to copy the pulsar info
                    (PSR name, period, distance, l/b) to your clipboard
                  </li>
                  <li>
                    enter coordinates directly via the "coords" button or in the
                    search box:{" "}
                    <span className="font-mono text-foreground/90">
                      l=120 b=-15 d=2.5
                    </span>{" "}
                    or{" "}
                    <span className="font-mono text-foreground/90">
                      ra=83.633 dec=22.014 d=2.0
                    </span>
                  </li>
                  <li>
                    use the export buttons to download the current map as PNG,
                    SVG, or print-ready SVG (with title block + legend)
                  </li>
                </ul>
              </div>

              <div>
                <h3
                  className="text-foreground text-[12px] mb-1.5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  data
                </h3>
                <p>
                  Pulsar positions, periods, and distances come from the{" "}
                  <a
                    href="https://www.atnf.csiro.au/research/pulsar/psrcat/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    ATNF Pulsar Catalogue
                  </a>{" "}
                  v2.7.0 (3,924 pulsars). Star positions for the local catalogue
                  (95 curated stars) and the SIMBAD fallback for any other
                  catalogued star are resolved via the CDS Sesame service. All
                  coordinates use the IAU J2000 galactic system.
                </p>
              </div>

              <div className="pt-2 text-[10px] text-foreground/50">
                made by{" "}
                <a
                  href="https://github.com/codeptor"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground transition"
                >
                  bhanu
                </a>
                {" · "}
                <a
                  href="https://github.com/codeptor/astrolabe"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground transition"
                >
                  source on github
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="shrink-0 px-4 pb-2 sm:pb-3 flex items-center justify-between">
        <div
          className={`min-h-[40px] w-fit ${activePulsar ? "cursor-pointer" : ""}`}
          onClick={(e) => {
            e.stopPropagation()
            if (activePulsar) handlePulsarCopy(activePulsar)
          }}
        >
          <PulsarTooltip pulsar={activePulsar} locked={!!lockedPulsar} />
        </div>
        <p className="text-[9px] text-foreground/50 shrink-0">
          ATNF v2.7.0 · {pulsars.length} pulsars
        </p>
      </footer>
    </div>
  )
}

export function App() {
  return (
    <AppErrorBoundary>
      <PageInner />
    </AppErrorBoundary>
  )
}
