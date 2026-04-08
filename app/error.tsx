"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console — replace with real error tracking (Sentry, etc.)
    // if you wire one up later
    console.error(error)
  }, [error])

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
        {error.digest && (
          <p className="text-[9px] text-foreground/40 font-mono mt-2">
            ref: {error.digest}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={reset}
        className="text-[10px] text-foreground/70 hover:text-foreground transition border border-foreground/20 hover:border-foreground/50 px-3 py-1.5 cursor-pointer"
      >
        try again
      </button>
    </div>
  )
}
