import { useEffect, useState } from "react"
import type React from "react"
import type { Theme } from "@/lib/state"
import { themeColors } from "@/lib/presets"

// Read the plaque's live viewBox so export can never drift from the renderer
function readViewBox(svgEl: SVGSVGElement): { w: number; h: number } {
  const vb = svgEl.viewBox.baseVal
  if (vb && vb.width > 0 && vb.height > 0) {
    return { w: vb.width, h: vb.height }
  }
  const attr = svgEl.getAttribute("viewBox")
  if (attr) {
    const parts = attr.trim().split(/\s+/).map(parseFloat)
    if (parts.length === 4 && parts[2]! > 0 && parts[3]! > 0) {
      return { w: parts[2]!, h: parts[3]! }
    }
  }
  return { w: 1700, h: 700 }
}

interface ExportButtonProps {
  svgRef: React.RefObject<SVGSVGElement | null>
  starName: string
  theme: Theme
  observerName: string
  pulsarCount: number
  onToast: (msg: string) => void
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

async function fontToDataUrl(path: string, mime: string): Promise<string> {
  try {
    const res = await fetch(path)
    const buf = await res.arrayBuffer()
    let bin = ""
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
    const base64 = btoa(bin)
    return `data:${mime};base64,${base64}`
  } catch {
    return path
  }
}

function buildInlineStyle(fg: string, tronicaUrl: string, assetUrl: string): string {
  return `
    @font-face {
      font-family: "Tronica Mono";
      src: url("${tronicaUrl}") format("woff2");
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: "Asset";
      src: url("${assetUrl}") format("truetype");
      font-weight: 400;
      font-style: normal;
    }
    svg { font-family: "Tronica Mono", ui-monospace, SFMono-Regular, monospace; }
    line { stroke: ${fg}; }
    circle { fill: ${fg}; stroke: none; }
    text { fill: ${fg}; }
  `
}

const NS = "http://www.w3.org/2000/svg"

// Canvas dimensions for the supported aspect ratios. 16:9 → wallpaper /
// embed friendly; 1:1 → social grid friendly.
const CANVAS: Record<CanvasShape, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "1:1": { w: 2160, h: 2160 },
}

type CanvasShape = "16:9" | "1:1"
type LegendStyle = "none" | "compact" | "full"
type Background = "theme" | "transparent"
type Format = "svg" | "png"

export interface ExportOptions {
  format: Format
  canvas: CanvasShape
  background: Background
  legend: LegendStyle
  scale: 1 | 2 // PNG only — SVG is resolution-independent
}

interface Preset {
  id: string
  label: string
  desc: string
  options: ExportOptions
}

// Curated presets — each is one click to download. Custom tweaks come from
// the option grid underneath; tweaking decouples the preset selection.
const PRESETS: Preset[] = [
  {
    id: "wallpaper",
    label: "4K wallpaper",
    desc: "PNG · 3840×2160 · theme bg",
    options: { format: "png", canvas: "16:9", background: "theme", legend: "none", scale: 2 },
  },
  {
    id: "social",
    label: "social square",
    desc: "PNG · 2160×2160 · compact legend",
    options: { format: "png", canvas: "1:1", background: "theme", legend: "compact", scale: 1 },
  },
  {
    id: "print",
    label: "print SVG",
    desc: "SVG · 16:9 · full legend",
    options: { format: "svg", canvas: "16:9", background: "theme", legend: "full", scale: 1 },
  },
  {
    id: "clean",
    label: "clean SVG",
    desc: "SVG · 16:9 · no legend",
    options: { format: "svg", canvas: "16:9", background: "theme", legend: "none", scale: 1 },
  },
  {
    id: "transparent",
    label: "transparent SVG",
    desc: "SVG · 16:9 · no background",
    options: { format: "svg", canvas: "16:9", background: "transparent", legend: "none", scale: 1 },
  },
]

const DEFAULT_PRESET = PRESETS[0]!

function optionsEqual(a: ExportOptions, b: ExportOptions): boolean {
  return (
    a.format === b.format &&
    a.canvas === b.canvas &&
    a.background === b.background &&
    a.legend === b.legend &&
    a.scale === b.scale
  )
}

function matchPreset(opts: ExportOptions): Preset | null {
  return PRESETS.find((p) => optionsEqual(p.options, opts)) ?? null
}

// Clean up a cloned plaque subtree: strip Tailwind classes, transitions,
// hit-area lines, and pointer-events styles so the exported SVG renders
// deterministically without the runtime's interactive scaffolding.
function stripRuntimeDecorations(root: Element) {
  root.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("class")
    const style = el.getAttribute("style")
    if (style) {
      const cleaned = style
        .split(";")
        .filter((s) => !s.includes("transition") && !s.includes("pointer-events"))
        .join(";")
        .trim()
      if (cleaned) el.setAttribute("style", cleaned)
      else el.removeAttribute("style")
    }
  })
  root.querySelectorAll('line[stroke="transparent"]').forEach((el) => el.remove())
  root.querySelectorAll("[cursor]").forEach((el) => el.removeAttribute("cursor"))
}

function appendLegend(
  svg: SVGSVGElement,
  fg: string,
  observerName: string,
  count: number,
  canvasW: number,
  topY: number,
  style: LegendStyle,
) {
  if (style === "none") return
  const g = document.createElementNS(NS, "g")
  g.setAttribute("font-family", "Tronica Mono, monospace")
  g.setAttribute("fill", fg)

  const title = document.createElementNS(NS, "text")
  title.setAttribute("x", String(canvasW / 2))
  title.setAttribute("y", String(topY))
  title.setAttribute("text-anchor", "middle")
  title.setAttribute("font-size", "22")
  title.setAttribute("letter-spacing", "2")
  title.textContent = "ASTROLABE"
  g.appendChild(title)

  const sub = document.createElementNS(NS, "text")
  sub.setAttribute("x", String(canvasW / 2))
  sub.setAttribute("y", String(topY + 26))
  sub.setAttribute("text-anchor", "middle")
  sub.setAttribute("font-size", "11")
  sub.setAttribute("opacity", "0.7")
  sub.textContent = `${count} pulsars · observer: ${observerName} · ATNF v2.7.0`
  g.appendChild(sub)

  if (style === "full") {
    const legend = document.createElementNS(NS, "text")
    legend.setAttribute("x", String(canvasW / 2))
    legend.setAttribute("y", String(topY + 46))
    legend.setAttribute("text-anchor", "middle")
    legend.setAttribute("font-size", "10")
    legend.setAttribute("opacity", "0.5")
    legend.textContent = "● observer · line length = distance (kpc) · binary ticks = period (H 21cm units) · → galactic centre"
    g.appendChild(legend)
  }

  svg.appendChild(g)
}

interface BuildOptions {
  observerName: string
  count: number
  canvas: CanvasShape
  background: Background
  legend: LegendStyle
}

// Build the export SVG: outer canvas (sized by aspect-ratio choice), optional
// solid background, the live plaque cloned + cleaned and letterboxed inside,
// and an optional legend block in the bottom letterbox area.
async function buildExportSvg(
  svgEl: SVGSVGElement,
  theme: Theme,
  options: BuildOptions,
): Promise<{ svg: SVGSVGElement; bg: string; width: number; height: number }> {
  const colors = themeColors(theme)
  const tronicaUrl = await fontToDataUrl("/fonts/TronicaMono-Regular.woff2", "font/woff2")
  const assetUrl = await fontToDataUrl("/fonts/Asset.ttf", "font/ttf")
  const style = buildInlineStyle(colors.fg, tronicaUrl, assetUrl)

  const { w: plaqueW, h: plaqueH } = readViewBox(svgEl)

  const { w: canvasW, h: canvasH } = CANVAS[options.canvas]

  const outer = document.createElementNS(NS, "svg") as SVGSVGElement
  outer.setAttribute("xmlns", NS)
  outer.setAttribute("viewBox", `0 0 ${canvasW} ${canvasH}`)
  outer.setAttribute("width", String(canvasW))
  outer.setAttribute("height", String(canvasH))

  const styleEl = document.createElementNS(NS, "style")
  styleEl.textContent = style
  outer.appendChild(styleEl)

  if (options.background === "theme") {
    const bgRect = document.createElementNS(NS, "rect")
    bgRect.setAttribute("width", "100%")
    bgRect.setAttribute("height", "100%")
    bgRect.setAttribute("fill", colors.bg)
    outer.appendChild(bgRect)
  }

  const inner = svgEl.cloneNode(true) as SVGSVGElement
  inner.removeAttribute("class")
  inner.removeAttribute("style")
  stripRuntimeDecorations(inner)

  const scaleFit = Math.min(canvasW / plaqueW, canvasH / plaqueH)
  const innerW = plaqueW * scaleFit
  const innerH = plaqueH * scaleFit
  const innerX = (canvasW - innerW) / 2
  // Lift the plaque slightly so a legend has room beneath it.
  const innerY =
    options.legend !== "none"
      ? (canvasH - innerH) / 2 - 50
      : (canvasH - innerH) / 2

  inner.setAttribute("x", String(innerX))
  inner.setAttribute("y", String(innerY))
  inner.setAttribute("width", String(innerW))
  inner.setAttribute("height", String(innerH))
  inner.setAttribute("viewBox", `0 0 ${plaqueW} ${plaqueH}`)
  inner.setAttribute("preserveAspectRatio", "xMidYMid meet")
  outer.appendChild(inner)

  if (options.legend !== "none") {
    const legendTop = innerY + innerH + 40
    appendLegend(outer, colors.fg, options.observerName, options.count, canvasW, legendTop, options.legend)
  }

  return {
    svg: outer,
    bg: options.background === "theme" ? colors.bg : "transparent",
    width: canvasW,
    height: canvasH,
  }
}

function serializeSvg(svgEl: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svgEl)
}

function download(url: string, filename: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  a.remove()
}

async function downloadSvg(
  svgEl: SVGSVGElement,
  theme: Theme,
  opts: BuildOptions,
  filename: string,
) {
  const { svg } = await buildExportSvg(svgEl, theme, opts)
  const svgStr = serializeSvg(svg)
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  download(url, filename)
  URL.revokeObjectURL(url)
}

async function downloadPng(
  svgEl: SVGSVGElement,
  theme: Theme,
  opts: BuildOptions,
  scale: 1 | 2,
  filename: string,
): Promise<boolean> {
  const { svg, bg, width, height } = await buildExportSvg(svgEl, theme, opts)
  const w = width * scale
  const h = height * scale
  const svgStr = serializeSvg(svg)
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")!
      // Theme bg paints the rect inside the SVG, but the canvas itself starts
      // transparent. For "transparent" exports we leave it that way; for theme
      // exports we paint the canvas first so any letterbox area outside the
      // inner SVG is also filled.
      if (opts.background === "theme") {
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) {
            resolve(false)
            return
          }
          const pngUrl = URL.createObjectURL(pngBlob)
          download(pngUrl, filename)
          URL.revokeObjectURL(pngUrl)
          resolve(true)
        },
        "image/png",
        1.0,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(false)
    }
    img.src = url
  })
}

function suffixFor(opts: ExportOptions): string {
  const parts: string[] = []
  if (opts.canvas === "1:1") parts.push("square")
  if (opts.background === "transparent") parts.push("transparent")
  if (opts.legend === "full") parts.push("print")
  else if (opts.legend === "compact") parts.push("captioned")
  if (opts.format === "png" && opts.scale === 2) parts.push("4k")
  return parts.length > 0 ? `-${parts.join("-")}` : ""
}

export function ExportButton({
  svgRef,
  starName,
  theme,
  observerName,
  pulsarCount,
  onToast,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_PRESET.options)
  const [busy, setBusy] = useState(false)
  const name = slug(starName) || "astrolabe"

  // Close on Escape and reset to the default preset whenever the modal opens
  // so the user always starts from a known good state.
  useEffect(() => {
    if (!open) return
    setOpts(DEFAULT_PRESET.options)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  async function runExport(target?: ExportOptions) {
    const svgEl = svgRef.current
    if (!svgEl) {
      onToast("export unavailable")
      return
    }
    const o = target ?? opts
    const buildOpts: BuildOptions = {
      observerName,
      count: pulsarCount,
      canvas: o.canvas,
      background: o.background,
      legend: o.legend,
    }
    setBusy(true)
    const filename = `astrolabe-${name}${suffixFor(o)}.${o.format}`
    try {
      if (o.format === "svg") {
        await downloadSvg(svgEl, theme, buildOpts, filename)
        onToast(`${o.format} saved`)
      } else {
        const ok = await downloadPng(svgEl, theme, buildOpts, o.scale, filename)
        onToast(ok ? "png saved" : "export failed")
      }
      setOpen(false)
    } catch {
      onToast("export failed")
    } finally {
      setBusy(false)
    }
  }

  function applyPreset(preset: Preset) {
    setOpts(preset.options)
    runExport(preset.options)
  }

  const matched = matchPreset(opts)

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className="text-[10px] text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
        title="export the current plaque"
      >
        export
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-background/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 sm:p-8 overflow-y-auto themed-scroll"
          onClick={() => setOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="bg-background border border-foreground/20 max-w-xl w-full p-6 sm:p-7 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2
                  className="text-[18px] text-foreground leading-none mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  export
                </h2>
                <p className="text-[10px] text-foreground/55">
                  one-click presets, or tweak the options below
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-foreground/50 hover:text-foreground text-[14px] cursor-pointer leading-none"
                aria-label="close export"
              >
                ✕
              </button>
            </div>

            <div className="text-foreground/35 uppercase tracking-[0.15em] text-[8px] mb-2">
              presets
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
              {PRESETS.map((p) => {
                const active = matched?.id === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation()
                      applyPreset(p)
                    }}
                    className={`text-left px-3 py-2 border transition-colors cursor-pointer disabled:opacity-50 ${
                      active
                        ? "border-foreground bg-foreground/[0.04]"
                        : "border-foreground/15 hover:border-foreground/40 hover:bg-foreground/[0.02]"
                    }`}
                  >
                    <div className="text-[11px] text-foreground leading-none mb-1">
                      {p.label}
                    </div>
                    <div className="text-[9px] text-foreground/50 leading-tight">
                      {p.desc}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="text-foreground/35 uppercase tracking-[0.15em] text-[8px] mb-2">
              options
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 mb-5 text-[10px]">
              <OptionRow label="format">
                <Pill
                  active={opts.format === "svg"}
                  onClick={() => setOpts({ ...opts, format: "svg" })}
                  label="svg"
                />
                <Pill
                  active={opts.format === "png"}
                  onClick={() => setOpts({ ...opts, format: "png" })}
                  label="png"
                />
              </OptionRow>
              <OptionRow label="canvas">
                <Pill
                  active={opts.canvas === "16:9"}
                  onClick={() => setOpts({ ...opts, canvas: "16:9" })}
                  label="16:9"
                />
                <Pill
                  active={opts.canvas === "1:1"}
                  onClick={() => setOpts({ ...opts, canvas: "1:1" })}
                  label="square"
                />
              </OptionRow>
              <OptionRow label="bg">
                <Pill
                  active={opts.background === "theme"}
                  onClick={() => setOpts({ ...opts, background: "theme" })}
                  label="theme"
                />
                <Pill
                  active={opts.background === "transparent"}
                  onClick={() => setOpts({ ...opts, background: "transparent" })}
                  label="transparent"
                />
              </OptionRow>
              <OptionRow label="legend">
                <Pill
                  active={opts.legend === "none"}
                  onClick={() => setOpts({ ...opts, legend: "none" })}
                  label="none"
                />
                <Pill
                  active={opts.legend === "compact"}
                  onClick={() => setOpts({ ...opts, legend: "compact" })}
                  label="compact"
                />
                <Pill
                  active={opts.legend === "full"}
                  onClick={() => setOpts({ ...opts, legend: "full" })}
                  label="full"
                />
              </OptionRow>
              {opts.format === "png" && (
                <OptionRow label="scale">
                  <Pill
                    active={opts.scale === 1}
                    onClick={() => setOpts({ ...opts, scale: 1 })}
                    label="1×"
                  />
                  <Pill
                    active={opts.scale === 2}
                    onClick={() => setOpts({ ...opts, scale: 2 })}
                    label="2× (4k)"
                  />
                </OptionRow>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-foreground/10">
              <div className="text-[9px] text-foreground/45 tabular-nums">
                {opts.format.toUpperCase()} · {CANVAS[opts.canvas].w}×{CANVAS[opts.canvas].h}
                {opts.format === "png" && opts.scale === 2 ? ` · 2×` : ""}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation()
                  runExport()
                }}
                className="text-[11px] text-background bg-foreground hover:bg-foreground/85 transition-colors px-4 py-1.5 cursor-pointer disabled:opacity-50"
              >
                {busy ? "rendering…" : "download"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="text-foreground/45 uppercase tracking-[0.1em] text-[8px] self-center text-right">
        {label}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </>
  )
}

function Pill({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`text-[10px] px-2 py-1 border transition-colors cursor-pointer leading-none ${
        active
          ? "border-foreground text-foreground bg-foreground/[0.05]"
          : "border-foreground/15 text-foreground/60 hover:border-foreground/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}
