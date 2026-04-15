import { useCallback, useEffect, useState } from "react"
import { ALL_THEMES, type Theme } from "./state"

const STORAGE_KEY = "astrolabe-theme"

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark"
  const html = document.documentElement
  for (const t of ALL_THEMES) {
    if (html.classList.contains(t)) return t
  }
  return "dark"
}

function writeTheme(next: Theme) {
  if (typeof document === "undefined") return
  const html = document.documentElement
  for (const t of ALL_THEMES) html.classList.remove(t)
  html.classList.add(next)
  html.style.colorScheme = next === "light" ? "light" : "dark"
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore — storage may be disabled
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readTheme())

  const setTheme = useCallback((next: Theme) => {
    writeTheme(next)
    setThemeState(next)
  }, [])

  useEffect(() => {
    const observed = readTheme()
    if (observed !== theme) setThemeState(observed)
  }, [theme])

  return { theme, setTheme }
}
