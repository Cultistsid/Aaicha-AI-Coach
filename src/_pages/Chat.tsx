import { useCallback, useEffect, useRef, useState } from "react"
import { Header } from "../components/chat/Header"
import { ChatMessage, MessageBubble } from "../components/chat/MessageBubble"
import { Composer, PendingScreenshot } from "../components/chat/Composer"
import { ListeningMode } from "../components/chat/ListeningMode"
import { useTTS } from "../lib/useTTS"

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export default function Chat() {
  const tts = useTTS()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingScreenshot, setPendingScreenshot] =
    useState<PendingScreenshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [listeningMode, setListeningMode] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastSpokenRef = useRef<string | null>(null)

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages])

  // Auto-speak new assistant messages
  useEffect(() => {
    if (!tts.enabled) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== "assistant" || last.pending || last.error) return
    if (lastSpokenRef.current === last.id) return
    lastSpokenRef.current = last.id
    tts.speak(last.text)
  }, [messages, tts.enabled])

  const appendUser = useCallback(
    (msg: Omit<ChatMessage, "id" | "role">) => {
      const message: ChatMessage = { id: uid(), role: "user", ...msg }
      setMessages((m) => [...m, message])
      return message.id
    },
    []
  )

  const appendAssistantPending = useCallback(() => {
    const message: ChatMessage = {
      id: uid(),
      role: "assistant",
      text: "",
      pending: true
    }
    setMessages((m) => [...m, message])
    return message.id
  }, [])

  const updateMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    },
    []
  )

  const sendText = useCallback(
    async (text: string) => {
      const screenshot = pendingScreenshot
      if (!text && !screenshot) return

      appendUser({
        text,
        attachment: screenshot
          ? { kind: "image", preview: screenshot.preview }
          : undefined
      })
      setPendingScreenshot(null)

      const assistantId = appendAssistantPending()
      setBusy(true)

      try {
        let reply: string
        if (screenshot) {
          const visionResult = await window.electronAPI.analyzeImageFile(
            screenshot.path,
            text || undefined
          )
          reply = visionResult.text
        } else {
          reply = await window.electronAPI.chat(text)
        }
        updateMessage(assistantId, { text: reply, pending: false })
      } catch (err: any) {
        updateMessage(assistantId, {
          pending: false,
          error: err?.message || "Something went wrong contacting Claude."
        })
      } finally {
        setBusy(false)
      }
    },
    [pendingScreenshot, appendUser, appendAssistantPending, updateMessage]
  )

  const takeScreenshot = useCallback(async () => {
    try {
      const result = await window.electronAPI.takeScreenshot()
      if (result?.path && result?.preview) {
        setPendingScreenshot({ path: result.path, preview: result.preview })
      }
    } catch (err) {
      console.error("Screenshot failed:", err)
    }
  }, [])

  // Wire global Cmd+H from main process to renderer
  useEffect(() => {
    const cleanup = window.electronAPI.onScreenshotTaken((data) => {
      setPendingScreenshot({ path: data.path, preview: data.preview })
    })
    return cleanup
  }, [])

  // Cmd+R reset → wired from main process
  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      setMessages([])
      setPendingScreenshot(null)
    })
    return cleanup
  }, [])

  const status: "idle" | "thinking" | "listening" | "speaking" = listening
    ? "listening"
    : busy
    ? "thinking"
    : tts.speaking
    ? "speaking"
    : "idle"

  const showWelcome = messages.length === 0

  if (listeningMode) {
    return <ListeningMode onExit={() => setListeningMode(false)} />
  }

  return (
    <div className="flex flex-col h-screen bg-paper">
      <Header
        voiceEnabled={tts.enabled}
        onToggleVoice={() => tts.setEnabled(!tts.enabled)}
        onEnterListening={() => setListeningMode(true)}
        onClear={() => {
          setMessages([])
          setPendingScreenshot(null)
          tts.stop()
        }}
        status={status}
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-paper"
      >
        <div className="max-w-[680px] mx-auto px-6 py-8">
          {showWelcome ? (
            <Welcome onTakeScreenshot={takeScreenshot} />
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} onSpeak={tts.speak} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[680px] w-full mx-auto">
        <Composer
          busy={busy}
          pendingScreenshot={pendingScreenshot}
          onClearScreenshot={() => setPendingScreenshot(null)}
          onTakeScreenshot={takeScreenshot}
          onSendText={sendText}
          onListeningChange={setListening}
        />
      </div>
    </div>
  )
}

function Welcome({ onTakeScreenshot }: { onTakeScreenshot: () => void }) {
  return (
    <div className="pt-12 pb-8 animate-fade-in">
      <h1
        className="font-serif text-[44px] leading-[1.05] text-ink mb-3"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 60, "wght" 380' }}
      >
        Good to see you.
      </h1>
      <p className="text-[15.5px] leading-[1.6] text-ink-muted max-w-[520px] mb-8">
        Your sales co-pilot for the moment. Type a question, capture your
        screen, or hold a thought out loud — Aaicha listens, reads, and responds.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Hint
          title="Capture your screen"
          body="Press ⌘H or tap Screen below. Aaicha will read what's on it."
          onClick={onTakeScreenshot}
        />
        <Hint
          title="Speak naturally"
          body="Tap Voice — transcribed locally and sent to Claude."
        />
        <Hint
          title="Type freely"
          body="Markdown, code, lists — formatted output will render nicely."
        />
        <Hint
          title="Live call mode"
          body="Tap the headphones to start a live sales-call session."
        />
      </div>
    </div>
  )
}

function Hint({
  title,
  body,
  onClick
}: {
  title: string
  body: string
  onClick?: () => void
}) {
  const Tag = onClick ? "button" : "div"
  return (
    <Tag
      onClick={onClick}
      className={`text-left rounded-xl border border-line bg-white px-4 py-3.5 ${
        onClick
          ? "hover:border-coral-soft hover:shadow-sm transition-all cursor-pointer"
          : ""
      }`}
    >
      <div className="text-[13px] font-medium text-ink mb-1">{title}</div>
      <div className="text-[12.5px] text-ink-muted leading-[1.5]">{body}</div>
    </Tag>
  )
}
