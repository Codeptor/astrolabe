import type { Theme } from "./state"

export interface ThemeMeta {
  id: Theme
  label: string
  swatch: string
  fg: string
  bg: string
}

// Single source of truth for all 4 themes. Used by:
// - ThemeToggle picker (label, swatch)
// - ExportButton (fg/bg for raster export when CSS isn't available)
export const THEMES: ThemeMeta[] = [
  { id: "dark",      label: "dark",      swatch: "#0a0a10", fg: "#e0e0e0", bg: "#0a0a10" },
  { id: "light",     label: "light",     swatch: "#fafafa", fg: "#1a1a1a", bg: "#fafafa" },
  { id: "gold",      label: "gold",      swatch: "#f0d9a8", fg: "#1a0e02", bg: "#f0d9a8" },
  { id: "blueprint", label: "blueprint", swatch: "#08153a", fg: "#9ce4ff", bg: "#08153a" },
  { id: "plaque",    label: "plaque",    swatch: "#d2a978", fg: "#2c2012", bg: "#d2a978" },
]

export function themeColors(theme: Theme): { fg: string; bg: string } {
  const meta = THEMES.find((t) => t.id === theme) ?? THEMES[0]!
  return { fg: meta.fg, bg: meta.bg }
}
