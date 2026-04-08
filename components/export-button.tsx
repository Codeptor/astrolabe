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

function cloneForExport(
  svgEl: SVGSVGElement,
  inlineStyle: string,
  bg: string,
  vbW: number,
  vbH: number,
): SVGSVGElement {
  const clone = svgEl.cloneNode(true) as SVGSVGElement

  clone.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`)
  clone.setAttribute("width", String(vbW))
  clone.setAttribute("height", String(vbH))
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.removeAttribute("class")
  clone.removeAttribute("preserveAspectRatio")
  clone.removeAttribute("style")

  const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
  bgRect.setAttribute("width", "100%")
  bgRect.setAttribute("height", "100%")
  bgRect.setAttribute("fill", bg)
  clone.insertBefore(bgRect, clone.firstChild)

  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style")
  styleEl.textContent = inlineStyle
  clone.insertBefore(styleEl, clone.firstChild)

  // Strip Tailwind classes / transitions / pointer events
  clone.querySelectorAll("*").forEach((el) => {
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

  // Drop hit-area lines and cursor styles
  clone.querySelectorAll('line[stroke="transparent"]').forEach((el) => el.remove())
  clone.querySelectorAll("[cursor]").forEach((el) => el.removeAttribute("cursor"))

  return clone
}

// Augment SVG with a small text legend at the bottom — used for print export
function appendPrintLegend(
  svg: SVGSVGElement,
  fg: string,
  observerName: string,
  count: number,
  vbW: number,
  vbH: number,
  extraHeight: number,
) {
  const totalH = vbH + extraHeight
  svg.setAttribute("viewBox", `0 0 ${vbW} ${totalH}`)
  svg.setAttribute("height", String(totalH))

  const NS = "http://www.w3.org/2000/svg"
  const g = document.createElementNS(NS, "g")
  g.setAttribute("font-family", "Tronica Mono, monospace")
  g.setAttribute("fill", fg)
  g.setAttribute("font-size", "11")

  const title = document.createElementNS(NS, "text")
  title.setAttribute("x", String(vbW / 2))
  title.setAttribute("y", String(vbH + 28))
  title.setAttribute("text-anchor", "middle")
  title.setAttribute("font-size", "16")
  title.setAttribute("font-family", "Tronica Mono, monospace")
  title.textContent = "ASTROLABE"
  g.appendChild(title)

  const sub = document.createElementNS(NS, "text")
  sub.setAttribute("x", String(vbW / 2))
  sub.setAttribute("y", String(vbH + 46))
  sub.setAttribute("text-anchor", "middle")
  sub.setAttribute("font-size", "9")
  sub.setAttribute("opacity", "0.7")
  sub.textContent = `${count} pulsars · observer: ${observerName} · ATNF v2.7.0`
  g.appendChild(sub)

  const legend = document.createElementNS(NS, "text")
  legend.setAttribute("x", String(vbW / 2))
  legend.setAttribute("y", String(vbH + 62))
  legend.setAttribute("text-anchor", "middle")
  legend.setAttribute("font-size", "8")
  legend.setAttribute("opacity", "0.55")
  legend.textContent = "● observer · line length = distance (kpc) · binary ticks = period (H 21cm units) · → galactic centre"
  g.appendChild(legend)

  svg.appendChild(g)
}

async function buildExportSvg(
  svgEl: SVGSVGElement,
  theme: Theme,
  options: { print: boolean; observerName: string; count: number },
): Promise<{ svg: SVGSVGElement; bg: string; width: number; height: number }> {
  const colors = themeColors(theme)
  const tronicaUrl = await fontToDataUrl("/fonts/TronicaMono-Regular.woff2", "font/woff2")
  const assetUrl = await fontToDataUrl("/fonts/Asset.ttf", "font/ttf")
  const style = buildInlineStyle(colors.fg, tronicaUrl, assetUrl)

  const { w: vbW, h: vbH } = readViewBox(svgEl)
  const extraHeight = options.print ? 80 : 0

  const clone = cloneForExport(svgEl, style, colors.bg, vbW, vbH)
  if (options.print) {
    appendPrintLegend(clone, colors.fg, options.observerName, options.count, vbW, vbH, extraHeight)
  }
  return { svg: clone, bg: colors.bg, width: vbW, height: vbH + extraHeight }
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

  async function exportSvg(print: boolean) {
    const svgEl = svgRef.current
    if (!svgEl) return
    const { svg } = await buildExportSvg(svgEl, theme, {
      print,
      observerName,
      count: pulsarCount,
    })
    const svgStr = serializeSvg(svg)
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    download(url, `astrolabe-${name}${print ? "-print" : ""}.svg`)
    URL.revokeObjectURL(url)
    onToast(print ? "print svg saved" : "svg saved")
  }

  async function exportPng() {
    const svgEl = svgRef.current
    if (!svgEl) return
    // PNGs always include the title block + legend so they're shareable as-is
    const { svg, bg, width, height } = await buildExportSvg(svgEl, theme, {
      print: true,
      observerName,
      count: pulsarCount,
    })
    const scale = 4
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
