import { useEffect, useRef, useState } from "react"
import { Mic, Camera, ArrowUp, Square, X } from "lucide-react"
import { useSpeechRecognition } from "../../lib/useSpeechRecognition"

export interface PendingScreenshot {
  path: string
  preview: string
}

interface ComposerProps {
  busy: boolean
  pendingScreenshot: PendingScreenshot | null
  onClearScreenshot: () => void
  onTakeScreenshot: () => Promise<void>
  onSendText: (text: string) => Promise<void>
  onListeningChange?: (listening: boolean) => void
}

export function Composer({
  busy,
  pendingScreenshot,
  onClearScreenshot,
  onTakeScreenshot,
  onSendText,
  onListeningChange
}: ComposerProps) {
  const [text, setText] = useState("")
  const [recStartedAt, setRecStartedAt] = useState<number>(0)
  const [now, setNow] = useState<number>(Date.now())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Accumulate final segments while the mic is open so a multi-sentence
  // utterance ends up as one message.
  const finalsRef = useRef<string[]>([])
  // STT events are a global bus — only collect finals from OUR recording,
  // not from a listening-mode session that happens to be streaming.
  const recordingRef = useRef(false)

  const recognition = useSpeechRecognition({
    onFinal: (chunk) => {
      if (!recordingRef.current) return
      finalsRef.current.push(chunk)
      setText(finalsRef.current.join(" "))
    }
  })

  useEffect(() => {
    onListeningChange?.(recognition.listening)
  }, [recognition.listening, onListeningChange])

  useEffect(() => {
    if (!recognition.listening) return
    const t = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(t)
  }, [recognition.listening])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 180) + "px"
  }, [text, recognition.interim])

  const elapsedMs = recognition.listening ? now - recStartedAt : 0

  const startRecording = async () => {
    if (recognition.listening || busy) return
    if (!recognition.supported) return
    finalsRef.current = []
    setText("")
    setRecStartedAt(Date.now())
    recordingRef.current = true
    await recognition.start()
  }

  const stopRecording = async () => {
    recordingRef.current = false
    await recognition.stop()
    // Send whatever was accumulated.
    const combined = finalsRef.current.join(" ").trim()
    finalsRef.current = []
    if (combined) {
      setText("")
      await onSendText(combined)
    }
  }

  const submitText = async () => {
    const trimmed = text.trim()
    if (!trimmed && !pendingScreenshot) return
    setText("")
    await onSendText(trimmed)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submitText()
    }
  }

  const canSend = !busy && (text.trim().length > 0 || !!pendingScreenshot)

  // Bars driven by recognition.level
  const bars = 16
  const levels = Array.from({ length: bars }).map(() => {
    const base = recognition.level
    return Math.max(
      0.08,
      Math.min(1, base * 2 + (Math.random() - 0.5) * 0.3)
    )
  })

  return (
    <div className="px-6 pb-5 pt-3 bg-gradient-to-t from-paper via-paper to-transparent">
      <div
        className={`relative rounded-2xl border bg-white shadow-[0_1px_2px_rgba(42,26,20,0.04),0_8px_24px_-12px_rgba(42,26,20,0.12)] transition-all ${
          recognition.listening ? "border-coral-soft" : "border-line"
        }`}
      >
        {/* Pending screenshot chip */}
        {pendingScreenshot && (
          <div className="px-3 pt-3">
            <div className="inline-flex items-center gap-2 pr-1 pl-1 py-1 rounded-lg bg-paper-warm border border-line">
              <img
                src={pendingScreenshot.preview}
                alt="screenshot"
                className="h-12 w-16 object-cover rounded-md border border-line"
              />
              <div className="flex flex-col pr-1">
                <span className="text-[11px] text-ink-subtle uppercase tracking-[0.12em]">
                  Screenshot
                </span>
                <span className="text-[11px] text-ink-muted">attached</span>
              </div>
              <button
                onClick={onClearScreenshot}
                className="ml-1 p-1 rounded-md text-ink-subtle hover:text-ink hover:bg-paper-deep"
                title="Remove"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Recording overlay */}
        {recognition.listening ? (
          <div className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-[3px] h-7 flex-1">
                {levels.map((l, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-coral-deep transition-all duration-75"
                    style={{ height: `${Math.max(8, l * 100)}%` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[12px] text-coral-deep tabular-nums">
                {(elapsedMs / 1000).toFixed(1)}s
              </span>
              <button
                onClick={stopRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-coral text-white hover:bg-coral-deep text-[12.5px] font-medium transition-colors"
                title="Stop and send"
              >
                <Square size={12} fill="currentColor" />
                <span>Send</span>
              </button>
            </div>
            {(text || recognition.interim) && (
              <div className="text-[13.5px] leading-[1.45] text-ink min-h-[20px]">
                {text}
                {recognition.interim && (
                  <span className="text-ink-muted">
                    {text ? " " : ""}
                    {recognition.interim}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              pendingScreenshot
                ? "Ask about this screenshot…"
                : "Ask Aaicha anything…"
            }
            rows={1}
            disabled={busy}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[14.5px] leading-[1.5] text-ink placeholder:text-ink-subtle focus:outline-none disabled:opacity-50"
          />
        )}

        {/* Bottom action row */}
        {!recognition.listening && (
          <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1">
            <div className="flex items-center gap-0.5">
              <button
                onClick={onTakeScreenshot}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-warm text-[12.5px] transition-colors disabled:opacity-40"
                title="Capture screen (⌘H)"
              >
                <Camera size={14} />
                <span>Screen</span>
              </button>
              <button
                onClick={startRecording}
                disabled={busy || !recognition.supported}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-warm text-[12.5px] transition-colors disabled:opacity-40"
                title={
                  recognition.supported
                    ? "Speak — transcribed locally"
                    : "Speech recognition not available"
                }
              >
                <Mic size={14} />
                <span>Voice</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-ink-subtle uppercase tracking-[0.12em] hidden sm:inline">
                ↵ to send
              </span>
              <button
                onClick={submitText}
                disabled={!canSend}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-ink text-paper hover:bg-coral-deep transition-colors disabled:bg-ink-faint disabled:cursor-not-allowed"
                title="Send (↵)"
              >
                <ArrowUp size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
