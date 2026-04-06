"use client"

import type React from "react"

// ViewBox dimensions must match plaque.tsx
const VB_W = 1000
const VB_H = 700

interface ExportButtonProps {
  svgRef: React.RefObject<SVGSVGElement | null>
  starName: string
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function getColors(isLight: boolean) {
  return isLight
    ? { fg: "#1a1a1a", bg: "#fafafa" }
    : { fg: "#e0e0e0", bg: "#0a0a10" }
}

function buildInlineStyle(isLight: boolean, fontUrl: string): string {
  const { fg } = getColors(isLight)
  return `
    @font-face {
      font-family: "Tronica Mono";
      src: url("${fontUrl}") format("woff2");
      font-weight: 400;
      font-style: normal;
    }
    svg { font-family: "Tronica Mono", ui-monospace, SFMono-Regular, monospace; }
    line { stroke: ${fg}; }
    circle { fill: ${fg}; stroke: none; }
    text { fill: ${fg}; }
  `
}

async function fontToDataUrl(): Promise<string> {
  try {
    const res = await fetch("/fonts/TronicaMono-Regular.woff2")
    const buf = await res.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
    return `data:font/woff2;base64,${base64}`
  } catch {
    return "/fonts/TronicaMono-Regular.woff2"
  }
}

function cloneForExport(svgEl: SVGSVGElement, inlineStyle: string, bg: string): SVGSVGElement {
  const clone = svgEl.cloneNode(true) as SVGSVGElement

  // Set explicit viewBox and dimensions
  clone.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`)
  clone.setAttribute("width", String(VB_W))
  clone.setAttribute("height", String(VB_H))
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.removeAttribute("class")
  clone.removeAttribute("preserveAspectRatio")
  clone.removeAttribute("style")

  // Add background rect
  const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
  bgRect.setAttribute("width", "100%")
  bgRect.setAttribute("height", "100%")
  bgRect.setAttribute("fill", bg)
  clone.insertBefore(bgRect, clone.firstChild)

  // Add inline style with embedded font
  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style")
  styleEl.textContent = inlineStyle
  clone.insertBefore(styleEl, clone.firstChild)

  // Strip all Tailwind classes and transition styles from elements
  clone.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("class")
    const style = el.getAttribute("style")
    if (style) {
      // Keep only non-transition styles
      const cleaned = style
        .split(";")
        .filter((s) => !s.includes("transition") && !s.includes("pointer-events"))
        .join(";")
        .trim()
      if (cleaned) el.setAttribute("style", cleaned)
      else el.removeAttribute("style")
    }
  })

  // Remove invisible hit-area lines (transparent stroke)
  clone.querySelectorAll('line[stroke="transparent"]').forEach((el) => el.remove())
  // Remove cursor styles
  clone.querySelectorAll("[cursor]").forEach((el) => el.removeAttribute("cursor"))

  return clone
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

export function ExportButton({ svgRef, starName }: ExportButtonProps) {
  const name = slug(starName) || "astrolabe"
  const isLight = () => document.documentElement.classList.contains("light")

  async function exportSvg() {
    const svgEl = svgRef.current
    if (!svgEl) return

    const light = isLight()
    const { bg } = getColors(light)
    const fontUrl = await fontToDataUrl()
    const style = buildInlineStyle(light, fontUrl)
    const clone = cloneForExport(svgEl, style, bg)

    const svgStr = serializeSvg(clone)
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    download(url, `astrolabe-${name}.svg`)
    URL.revokeObjectURL(url)
  }

  async function exportPng() {
    const svgEl = svgRef.current
    if (!svgEl) return

    const light = isLight()
    const { bg } = getColors(light)
    const fontUrl = await fontToDataUrl()
    const style = buildInlineStyle(light, fontUrl)
    const clone = cloneForExport(svgEl, style, bg)

    // High-res: 4x scale for crisp output
    const scale = 4
    const w = VB_W * scale
    const h = VB_H * scale

    const svgStr = serializeSvg(clone)
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")!

      // Fill background
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Draw SVG at full resolution
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)

      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) return
          const pngUrl = URL.createObjectURL(pngBlob)
          download(pngUrl, `astrolabe-${name}.png`)
          URL.revokeObjectURL(pngUrl)
        },
        "image/png",
        1.0,
      )
    }
    img.src = url
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={exportSvg}
        className="text-[10px] text-foreground/70 hover:text-foreground transition-colors"
      >
        svg
      </button>
      <button
        type="button"
        onClick={exportPng}
        className="text-[10px] text-foreground/70 hover:text-foreground transition-colors"
      >
        png
      </button>
    </div>
  )
}
