import { Volume2, Copy, Check } from "lucide-react"
import { useState } from "react"
import { Markdown } from "./Markdown"

export type Attachment =
  | { kind: "image"; preview: string }
  | { kind: "audio"; durationMs: number }

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  attachment?: Attachment
  pending?: boolean
  error?: string
}

export function MessageBubble({
  message,
  onSpeak
}: {
  message: ChatMessage
  onSpeak?: (text: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] flex flex-col items-end gap-2">
          {message.attachment?.kind === "image" && (
            <img
              src={message.attachment.preview}
              alt="screenshot"
              className="rounded-lg max-h-48 border border-line shadow-sm"
            />
          )}
          {message.attachment?.kind === "audio" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-coral-wash text-coral-deep text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-coral-deep" />
              Voice · {(message.attachment.durationMs / 1000).toFixed(1)}s
            </div>
          )}
          {message.text && (
            <div className="rounded-2xl rounded-tr-sm bg-paper-warm border border-line px-4 py-2.5 text-[14.5px] leading-[1.5] text-ink whitespace-pre-wrap">
              {message.text}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 animate-fade-up">
      <div className="flex items-center gap-2 text-ink-subtle">
        <span className="w-5 h-5 rounded-full bg-coral flex items-center justify-center text-paper text-[10px] font-serif" style={{ fontVariationSettings: '"opsz" 144' }}>
          A
        </span>
        <span className="text-[11px] uppercase tracking-[0.14em]">Aaicha</span>
      </div>
      <div className="pl-7">
        {message.pending ? (
          <div className="flex items-center gap-1.5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-faint animate-pulse-soft" style={{ animationDelay: "0s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-ink-faint animate-pulse-soft" style={{ animationDelay: "0.2s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-ink-faint animate-pulse-soft" style={{ animationDelay: "0.4s" }} />
          </div>
        ) : message.error ? (
          <div className="text-[13px] text-coral-deep bg-coral-tint border border-coral-soft rounded-lg px-3 py-2">
            {message.error}
          </div>
        ) : (
          <Markdown>{message.text}</Markdown>
        )}

        {!message.pending && !message.error && message.text && (
          <div className="flex items-center gap-1 mt-2 -ml-1.5">
            <button
              onClick={() => onSpeak?.(message.text)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-ink-subtle hover:text-ink hover:bg-paper-warm transition-colors"
              title="Read aloud"
            >
              <Volume2 size={11} />
              <span>Speak</span>
            </button>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-ink-subtle hover:text-ink hover:bg-paper-warm transition-colors"
              title="Copy"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
