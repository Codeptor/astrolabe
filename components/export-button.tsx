"use client"

import type React from "react"

interface ExportButtonProps {
  svgRef: React.RefObject<SVGSVGElement | null>
  starName: string
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function getColors(isLight: boolean) {
  return isLight
    ? { stroke: "#1a1a1a", bg: "#fafafa" }
    : { stroke: "#e0e0e0", bg: "#0d0d12" }
}

function buildInlineStyle(isLight: boolean): string {
  const { stroke } = getColors(isLight)
  return `
    line, circle, path { stroke: ${stroke}; }
    circle.fill-line { fill: ${stroke}; stroke: none; }
  `
}

function cloneWithInlineStyles(svgEl: SVGSVGElement, isLight: boolean): SVGSVGElement {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style")
  style.textContent = buildInlineStyle(isLight)
  clone.insertBefore(style, clone.firstChild)
  clone.removeAttribute("class")
  return clone
}

function svgToBlob(svgEl: SVGSVGElement): Blob {
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgEl)
  return new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" })
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

  function exportSvg() {
    const svgEl = svgRef.current
    if (!svgEl) return
    const isLight = document.documentElement.classList.contains("light")
    const clone = cloneWithInlineStyles(svgEl, isLight)
    const blob = svgToBlob(clone)
    const url = URL.createObjectURL(blob)
    download(url, `astrolabe-${name}.svg`)
    URL.revokeObjectURL(url)
  }

  function exportPng() {
    const svgEl = svgRef.current
    if (!svgEl) return
    const isLight = document.documentElement.classList.contains("light")
    const { bg } = getColors(isLight)
    const clone = cloneWithInlineStyles(svgEl, isLight)
    const blob = svgToBlob(clone)
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      const SIZE = 1200
      const canvas = document.createElement("canvas")
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.drawImage(img, 0, 0, SIZE, SIZE)
      URL.revokeObjectURL(url)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return
        const pngUrl = URL.createObjectURL(pngBlob)
        download(pngUrl, `astrolabe-${name}.png`)
        URL.revokeObjectURL(pngUrl)
      }, "image/png")
    }
    img.src = url
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={exportSvg}
        className="text-[10px] text-muted hover:text-foreground transition-colors"
      >
        svg
      </button>
      <button
        type="button"
        onClick={exportPng}
        className="text-[10px] text-muted hover:text-foreground transition-colors"
      >
        png
      </button>
    </div>
  )
}
