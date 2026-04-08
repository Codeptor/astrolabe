"use client"

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

// Target canvas: 16:9 at 1920x1080 → scales to 3840x2160 (4K) wallpaper in PNG
const EXPORT_W = 1920
const EXPORT_H = 1080
const NS = "http://www.w3.org/2000/svg"

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

// Legend + brand block, drawn inside the letterbox area underneath the plaque
function appendLegend(
  svg: SVGSVGElement,
  fg: string,
  observerName: string,
  count: number,
  canvasW: number,
  topY: number,
) {
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

  const legend = document.createElementNS(NS, "text")
  legend.setAttribute("x", String(canvasW / 2))
  legend.setAttribute("y", String(topY + 46))
  legend.setAttribute("text-anchor", "middle")
  legend.setAttribute("font-size", "10")
  legend.setAttribute("opacity", "0.5")
  legend.textContent = "● observer · line length = distance (kpc) · binary ticks = period (H 21cm units) · → galactic centre"
  g.appendChild(legend)

  svg.appendChild(g)
}

// Build a 16:9 export SVG with the plaque letterboxed inside it.
// Scales the plaque to fill the canvas in its limiting dimension, fills the
// rest with theme bg, and optionally overlays a legend block in the bottom
// letterbox area.
async function buildExportSvg(
  svgEl: SVGSVGElement,
  theme: Theme,
  options: { withLegend: boolean; observerName: string; count: number },
): Promise<{ svg: SVGSVGElement; bg: string; width: number; height: number }> {
  const colors = themeColors(theme)
  const tronicaUrl = await fontToDataUrl("/fonts/TronicaMono-Regular.woff2", "font/woff2")
  const assetUrl = await fontToDataUrl("/fonts/Asset.ttf", "font/ttf")
  const style = buildInlineStyle(colors.fg, tronicaUrl, assetUrl)

  const { w: plaqueW, h: plaqueH } = readViewBox(svgEl)

  // Build outer 16:9 SVG canvas
  const outer = document.createElementNS(NS, "svg") as SVGSVGElement
  outer.setAttribute("xmlns", NS)
  outer.setAttribute("viewBox", `0 0 ${EXPORT_W} ${EXPORT_H}`)
  outer.setAttribute("width", String(EXPORT_W))
  outer.setAttribute("height", String(EXPORT_H))

  // Embedded fonts + base stroke/fill styling
  const styleEl = document.createElementNS(NS, "style")
  styleEl.textContent = style
  outer.appendChild(styleEl)

  // Solid background fill
  const bgRect = document.createElementNS(NS, "rect")
  bgRect.setAttribute("width", "100%")
  bgRect.setAttribute("height", "100%")
  bgRect.setAttribute("fill", colors.bg)
  outer.appendChild(bgRect)

  // Clone the plaque, strip runtime decorations, nest it inside outer SVG.
  // `preserveAspectRatio="xMidYMid meet"` fits the plaque inside its nested
  // slot, letterboxed. We shift the nested slot up slightly when a legend is
  // appended so there's breathing room at the bottom.
  const inner = svgEl.cloneNode(true) as SVGSVGElement
  inner.removeAttribute("class")
  inner.removeAttribute("style")
  stripRuntimeDecorations(inner)

  const scale = Math.min(EXPORT_W / plaqueW, EXPORT_H / plaqueH)
  const innerW = plaqueW * scale
  const innerH = plaqueH * scale
  const innerX = (EXPORT_W - innerW) / 2
  const innerY = options.withLegend
    ? (EXPORT_H - innerH) / 2 - 50
    : (EXPORT_H - innerH) / 2

  inner.setAttribute("x", String(innerX))
  inner.setAttribute("y", String(innerY))
  inner.setAttribute("width", String(innerW))
  inner.setAttribute("height", String(innerH))
  inner.setAttribute("viewBox", `0 0 ${plaqueW} ${plaqueH}`)
  inner.setAttribute("preserveAspectRatio", "xMidYMid meet")
  outer.appendChild(inner)

  if (options.withLegend) {
    const legendTop = innerY + innerH + 40
    appendLegend(outer, colors.fg, options.observerName, options.count, EXPORT_W, legendTop)
  }

  return { svg: outer, bg: colors.bg, width: EXPORT_W, height: EXPORT_H }
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

export function ExportButton({
  svgRef,
  starName,
  theme,
  observerName,
  pulsarCount,
  onToast,
}: ExportButtonProps) {
  const name = slug(starName) || "astrolabe"

  async function exportSvg(withLegend: boolean) {
    const svgEl = svgRef.current
    if (!svgEl) return
    const { svg } = await buildExportSvg(svgEl, theme, {
      withLegend,
      observerName,
      count: pulsarCount,
    })
    const svgStr = serializeSvg(svg)
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    download(url, `astrolabe-${name}${withLegend ? "-print" : ""}.svg`)
    URL.revokeObjectURL(url)
    onToast(withLegend ? "print svg saved" : "svg saved")
  }

  async function exportPng() {
    const svgEl = svgRef.current
    if (!svgEl) return
    // PNG is 16:9 wallpaper-ready, no legend overlay so it's clean for any use
    const { svg, bg, width, height } = await buildExportSvg(svgEl, theme, {
      withLegend: false,
      observerName,
      count: pulsarCount,
    })
    // 2× scale: 1920×1080 → 3840×2160 (4K UHD wallpaper)
    const scale = 2
    const w = width * scale
    const h = height * scale

    const svgStr = serializeSvg(svg)
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) return
          const pngUrl = URL.createObjectURL(pngBlob)
          download(pngUrl, `astrolabe-${name}.png`)
          URL.revokeObjectURL(pngUrl)
          onToast("png saved")
        },
        "image/png",
        1.0,
      )
    }
    img.src = url
  }

  return (
    <>
      <button
        type="button"
        onClick={() => exportSvg(false)}
        className="text-[10px] text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
        title="download SVG"
      >
        svg
      </button>
      <button
        type="button"
        onClick={exportPng}
        className="text-[10px] text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
        title="download PNG (4× resolution)"
      >
        png
      </button>
      <button
        type="button"
        onClick={() => exportSvg(true)}
        className="text-[10px] text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
        title="print-ready SVG with legend"
      >
        print
      </button>
    </>
  )
}
