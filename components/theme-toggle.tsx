"use client"

import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="text-[10px] text-muted hover:text-foreground transition-colors"
    >
      {resolvedTheme === "dark" ? "light" : "dark"}
    </button>
  )
}
