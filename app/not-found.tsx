import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "not found",
}

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p
          className="text-[32px] leading-none text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          404
        </p>
        <p className="text-[11px] text-foreground/60">
          no pulsar signal from this coordinate
        </p>
      </div>
      <Link
        href="/"
        className="text-[10px] text-foreground/70 hover:text-foreground transition border border-foreground/20 hover:border-foreground/50 px-3 py-1.5"
      >
        ← back to astrolabe
      </Link>
    </div>
  )
}
