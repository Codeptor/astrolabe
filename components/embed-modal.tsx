"use client"

import { useEffect, useRef, useState } from "react"
import type { AppState } from "@/lib/state"
import { shareableUrl } from "@/lib/state"

interface EmbedModalProps {
  open: boolean
  onClose: () => void
  state: AppState
  onCopy: (msg: string) => void
}

export function EmbedModal({ open, onClose, state, onCopy }: EmbedModalProps) {
  const [url, setUrl] = useState("")
  const linkRef = useRef<HTMLInputElement>(null)
  const iframeRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) setUrl(shareableUrl(state))
  }, [open, state])

  if (!open) return null

  const iframeHtml = `<iframe src="${url}" width="800" height="600" frameborder="0" style="border:0" title="astrolabe pulsar map" loading="lazy"></iframe>`

  function copyText(text: string, label: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    navigator.clipboard.writeText(text).then(() => onCopy(`${label} copied`))
  }

  return (
    <div
      className="fixed inset-0 z-[110] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-foreground/20 max-w-xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2
            className="text-[15px] text-foreground leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            share this view
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-foreground/50 hover:text-foreground text-[14px] cursor-pointer leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[9px] text-foreground/50 uppercase tracking-wider block mb-1">
              link
            </label>
            <div className="flex gap-2">
              <input
                ref={linkRef}
                type="text"
                value={url}
                readOnly
                onClick={() => linkRef.current?.select()}
                className="flex-1 bg-transparent border border-foreground/20 px-2 py-1.5 text-[10px] outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => copyText(url, "link")}
                className="text-[10px] px-3 border border-foreground/20 hover:border-foreground/50 cursor-pointer transition text-foreground/70 hover:text-foreground"
              >
                copy
              </button>
            </div>
          </div>

          <div>
            <label className="text-[9px] text-foreground/50 uppercase tracking-wider block mb-1">
              embed (iframe)
            </label>
            <textarea
              ref={iframeRef}
              value={iframeHtml}
              readOnly
              onClick={() => iframeRef.current?.select()}
              rows={3}
              className="w-full bg-transparent border border-foreground/20 px-2 py-1.5 text-[10px] outline-none font-mono resize-none"
            />
            <button
              type="button"
              onClick={() => copyText(iframeHtml, "embed")}
              className="mt-2 text-[10px] px-3 py-1 border border-foreground/20 hover:border-foreground/50 cursor-pointer transition text-foreground/70 hover:text-foreground"
            >
              copy embed
            </button>
          </div>

          <p className="text-[9px] text-foreground/40 leading-relaxed">
            this link captures the current observer, mode, locked pulsar, color preset,
            and visualization settings — anyone opening it will see the same view.
          </p>
        </div>
      </div>
    </div>
  )
}
