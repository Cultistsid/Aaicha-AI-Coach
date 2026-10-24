import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Mic,
  Square,
  X,
  MessageSquare,
  Send,
  Image as ImageIcon,
  Eye,
  EyeOff,
  ArrowDown,
  NotebookPen,
  Trash2
} from "lucide-react"
import { useSpeechRecognition } from "../../lib/useSpeechRecognition"
import { useStickyScroll } from "../../lib/useStickyScroll"
import { Markdown } from "./Markdown"
import type { SalesMode } from "../../types/electron.d"
import { SalesCallSelector } from "../coach/SalesCallSelector"
import { FrameworkSidebar, FRAMEWORKS } from "../coach/FrameworkSidebar"
import { SessionSummary, type SessionResult } from "../coach/SessionSummary"

interface ListeningModeProps {
  onExit: () => void
}

interface CoachTurn {
  id: string
  text: string
  done: boolean
  createdAt: number
  hadImage?: boolean
}

interface PendingScreen {
  path: string
  preview: string
}

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function ListeningMode({ onExit }: ListeningModeProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [transcript, setTranscript] = useState("")
  const [turns, setTurns] = useState<CoachTurn[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(Date.now())
  const [nudge, setNudge] = useState("")
  const [overlay, setOverlayMode] = useState(false)
  const [stealth, setStealthMode] = useState(false)
  const [showFramework, setShowFramework] = useState(true)
  const [summary, setSummary] = useState<SessionResult | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [salesMode, setSalesMode] = useState<SalesMode>({
    callType: 'discovery'
  })

  // Load sales mode on mount
  useEffect(() => {
    window.electronAPI.getSalesMode()
      .then(setSalesMode)
      .catch((err) => console.error("[ListeningMode] getSalesMode failed:", err))
  }, [])

  // Subscribe to overlay state from main (toggled via header button or ⌘⇧O).
  useEffect(() => {
    window.electronAPI.getOverlay()
      .then(({ active }) => setOverlayMode(active))
      .catch((err) => console.error("[ListeningMode] getOverlay failed:", err))
    return window.electronAPI.onOverlayState(({ active }) =>
      setOverlayMode(active)
    )
  }, [])

  // Subscribe to stealth state from main.
  useEffect(() => {
    window.electronAPI.getStealth()
      .then(({ active }) => setStealthMode(active))
      .catch((err) => console.error("[ListeningMode] getStealth failed:", err))
    return window.electronAPI.onStealthState(({ active }) =>
      setStealthMode(active)
    )
  }, [])
  // Track which turns are still streaming so deltas land in the right bubble.
  const pendingTurnRef = useRef<string | null>(null)

  // Screen captured via ⌘⇧V, waiting to ride along with the next coach turn.
  // Use a custom setter to keep ref in sync synchronously (avoids race condition)
  const pendingScreenRef = useRef<PendingScreen | null>(null)
  const [pendingScreen, _setPendingScreen] = useState<PendingScreen | null>(null)
  const setPendingScreen = useCallback((screen: PendingScreen | null) => {
    pendingScreenRef.current = screen
    _setPendingScreen(screen)
  }, [])

  // Coalesce rapid-fire final segments into a single coach turn. Google STT
  // emits a "final" on every sentence/pause; without buffering we'd burn a
  // Claude call per sentence. Flush on whichever happens first:
  //   - 800ms after the most-recent final (natural-pause flush)
  //   - 4s after the first item entered the buffer (max-wait flush, so
  //     continuous speech doesn't starve the coach forever)
  const COACH_DEBOUNCE_MS = 1200
  // 12s gives a full multi-sentence problem statement room to land in one
  // batch. Shorter values caused the coach to fire twice on long question
  // setups (partial at 8s, rest 1.2s after the speaker stopped).
  const COACH_MAX_WAIT_MS = 12000
  const coachBufferRef = useRef<string[]>([])
  const coachIdleTimerRef = useRef<number | null>(null)
  const coachMaxTimerRef = useRef<number | null>(null)
  const flushingRef = useRef(false)

  const sendCoachTurn = useCallback(async (text: string) => {
    const turnId = uid()
    pendingTurnRef.current = turnId
    // Consume the pending screen (if any) for this turn only.
    const screen = pendingScreenRef.current
    pendingScreenRef.current = null
    if (screen) setPendingScreen(null)
    setTurns((prev) => [
      ...prev,
      {
        id: turnId,
        text: "",
        done: false,
        createdAt: Date.now(),
        hadImage: !!screen
      }
    ])
    try {
      await window.electronAPI.coachTurn(turnId, text, screen?.path)
    } catch (err: any) {
      console.error("[ListeningMode] coachTurn failed:", err)
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, text: "_Coach error: " + (err?.message || "unknown") + "_", done: true }
            : t
        )
      )
    }
  }, [])

  const flushCoachBuffer = useCallback(() => {
    if (flushingRef.current) return
    flushingRef.current = true
    if (coachIdleTimerRef.current !== null) {
      window.clearTimeout(coachIdleTimerRef.current)
      coachIdleTimerRef.current = null
    }
    if (coachMaxTimerRef.current !== null) {
      window.clearTimeout(coachMaxTimerRef.current)
      coachMaxTimerRef.current = null
    }
    const combined = coachBufferRef.current.join(" ").trim()
    coachBufferRef.current = []
    flushingRef.current = false
    if (combined) sendCoachTurn(combined)
  }, [sendCoachTurn])

  const handleFinal = useCallback(
    (text: string) => {
      setTranscript((prev) => (prev ? `${prev} ${text}`.trim() : text))
      const wasEmpty = coachBufferRef.current.length === 0
      coachBufferRef.current.push(text)

      // Reset the idle (pause-based) flush timer.
      if (coachIdleTimerRef.current !== null) {
        window.clearTimeout(coachIdleTimerRef.current)
      }
      coachIdleTimerRef.current = window.setTimeout(
        flushCoachBuffer,
        COACH_DEBOUNCE_MS
      )

      // Start the max-wait timer when the buffer first becomes non-empty.
      // Don't reset it on subsequent finals — that's the whole point.
      if (wasEmpty && coachMaxTimerRef.current === null) {
        coachMaxTimerRef.current = window.setTimeout(
          flushCoachBuffer,
          COACH_MAX_WAIT_MS
        )
      }
    },
    [flushCoachBuffer]
  )

  const recognition = useSpeechRecognition({ onFinal: handleFinal })

  // Pin-aware scrolling: panes follow new content only while the user is at
  // the bottom. Deps are combined content lengths so every streamed delta
  // and interim update counts as growth.
  const transcriptScroll = useStickyScroll<HTMLDivElement>(
    transcript.length + recognition.interim.length
  )
  const coachScroll = useStickyScroll<HTMLDivElement>(
    turns.reduce((n, t) => n + t.text.length, turns.length)
  )

  // Subscribe to ⌘⇧V screen-attach events from main
  useEffect(() => {
    const cleanup = window.electronAPI.onCoachScreenAttached((data) => {
      setPendingScreen({ path: data.path, preview: data.preview })
    })
    return cleanup
  }, [])

  // Subscribe to streaming coach deltas + done events
  useEffect(() => {
    const offDelta = window.electronAPI.onCoachDelta(({ turnId, text }) => {
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, text: t.text + text } : t))
      )
    })
    const offDone = window.electronAPI.onCoachDone(({ turnId, text }) => {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, text: text || t.text, done: true }
            : t
        )
      )
    })
    const offErr = window.electronAPI.onCoachError(({ turnId, error }) => {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, text: `_${error}_`, done: true } : t
        )
      )
    })
    return () => {
      offDelta()
      offDone()
      offErr()
    }
  }, [])

  // Elapsed-time ticker
  useEffect(() => {
    if (!startedAt) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [startedAt])

  // Surface recognition errors
  useEffect(() => {
    if (recognition.error) setErrorMsg(recognition.error)
  }, [recognition.error])

  const startSession = useCallback(async () => {
    setErrorMsg(null)
    try {
      await recognition.start()
      setStartedAt(Date.now())
    } catch (err: any) {
      setErrorMsg(err?.message || "Mic access denied")
    }
  }, [recognition])

  const clearSession = useCallback(async () => {
    setErrorMsg(null)
    setTurns([])
    setTranscript("")
    setSummary(null)
    await window.electronAPI.coachReset()
  }, [])

  const elapsed = useMemo(() => {
    if (!startedAt) return "0:00"
    const ms = now - startedAt
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${m}:${String(s % 60).padStart(2, "0")}`
  }, [now, startedAt])

  // Score the just-finished session. Reuses the stateless `chat` channel
  // (claude-opus, no conversation history) with a strict-JSON scoring prompt,
  // so no main-process/coach changes are needed. Best-effort: on any failure
  // the modal shows an honest error state rather than fabricated numbers.
  const generateSummary = useCallback(async () => {
    const spoken = transcript.trim()
    const coachNotes = turns
      .filter((t) => t.text.trim() && t.text.trim() !== "·")
      .map((t) => t.text.trim())
      .join("\n---\n")
    if (!spoken) return

    setSummarizing(true)
    setSummary(null)
    try {
      const prompt = [
        "You are scoring a live sales call. Return ONLY valid JSON, no prose, matching this exact shape:",
        '{"scores":{"discovery":0-100,"rapport":0-100,"objectionHandling":0-100,"value":0-100,"nextSteps":0-100},"overall":0-100,"strengths":["..."],"improvements":["..."]}',
        `Call context: ${salesMode.callType} call.`,
        "Score strictly against a strong-seller bar. 2-4 concise items per list, each one specific line.",
        "",
        "=== Salesperson transcript ===",
        spoken,
        "",
        "=== Assistant notes during the call ===",
        coachNotes || "(none)"
      ].join("\n")

      const raw = await window.electronAPI.chat(prompt)
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error("No JSON in response")
      const parsed = JSON.parse(match[0]) as SessionResult
      setSummary({
        scores: parsed.scores,
        overall: parsed.overall,
        strengths: parsed.strengths ?? [],
        improvements: parsed.improvements ?? [],
        durationLabel: elapsed
      })
    } catch (err) {
      console.error("[ListeningMode] summary failed:", err)
      setSummary({
        scores: { discovery: 0, rapport: 0, objectionHandling: 0, value: 0, nextSteps: 0 },
        overall: 0,
        strengths: [],
        improvements: ["Couldn't generate a debrief for this session — try another run."],
        durationLabel: elapsed
      })
    } finally {
      setSummarizing(false)
    }
  }, [transcript, turns, salesMode, elapsed])

  const stopSession = useCallback(async () => {
    // Flush anything still buffered so the user sees a final coach turn.
    flushCoachBuffer()
    await recognition.stop()
    setStartedAt(null)
    generateSummary()
  }, [recognition, flushCoachBuffer, generateSummary])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (coachIdleTimerRef.current !== null) {
        window.clearTimeout(coachIdleTimerRef.current)
      }
      if (coachMaxTimerRef.current !== null) {
        window.clearTimeout(coachMaxTimerRef.current)
      }
      recognition.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sessionLive = recognition.listening && !!startedAt

  // Session status chip. With the STT helper auto-restarting, an error while
  // the session is active means "reconnecting", not "dead" — only surface a
  // hard Error state when a session isn't running at all.
  type ChipState = "live" | "reconnecting" | "error" | "standby"
  const chip: ChipState = !startedAt
    ? errorMsg
      ? "error"
      : "standby"
    : recognition.error || !recognition.listening
    ? "reconnecting"
    : "live"
  const chipDot =
    chip === "live"
      ? "bg-coral animate-pulse-soft"
      : chip === "reconnecting"
      ? "bg-coral-soft animate-pulse-soft"
      : chip === "error"
      ? "bg-coral-deep"
      : "bg-ink-faint"
  const chipLabel =
    chip === "live"
      ? "Live"
      : chip === "reconnecting"
      ? "Reconnecting…"
      : chip === "error"
      ? "Error"
      : "Standby"

  const sendNudge = async () => {
    const t = nudge.trim()
    if (!t) return
    setNudge("")
    sendCoachTurn(t)
  }

  // Compact overlay rendering — full coach history, top-center translucent
  // window (sizing/opacity handled in main). Hides header, transcript pane,
  // and nudge box for minimal visual pull.
  if (overlay) {
    // Newest visible turn renders full-contrast; older ones recede.
    const visibleTurns = turns.filter((t) => !(t.done && t.text.trim() === "·"))
    const latestId = visibleTurns[visibleTurns.length - 1]?.id
    return (
      <div className="flex flex-col h-screen bg-paper/[0.92]">
        <div className="draggable flex items-center justify-between px-3 py-1.5 border-b border-line">
          <div className="flex items-center gap-2 pl-12 no-drag">
            <span className={`w-1.5 h-1.5 rounded-full ${chipDot}`} />
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle">
              {chipLabel}
            </span>
            {sessionLive && (
              <span className="font-mono text-[10.5px] text-ink-subtle tabular-nums">
                {elapsed}
              </span>
            )}
          </div>
          <button
            onClick={() => window.electronAPI.setOverlay(false)}
            className="no-drag text-[10.5px] px-2 py-1 rounded text-ink-muted hover:bg-paper-warm"
            title="Exit overlay (⌘⇧O)"
          >
            Exit overlay
          </button>
        </div>
        <div className="flex-1 relative min-h-0">
        <div
          ref={coachScroll.ref}
          className="h-full overflow-y-auto scrollbar-paper px-4 py-3"
        >
          <div className="max-w-[65ch] mx-auto space-y-2.5">
          {turns.length === 0 && (
            <p className="text-[12px] text-ink-subtle italic">
              {sessionLive
                ? "Listening. I'll chime in when you finish a thought."
                : "Start listening from the main window."}
            </p>
          )}
          {visibleTurns.map((t) => (
            <div
              key={t.id}
              className={`animate-fade-up ${
                t.id === latestId ? "" : "opacity-60"
              }`}
            >
              <div className="text-[9.5px] uppercase tracking-[0.14em] text-ink-subtle mb-1 flex items-center gap-1.5">
                <span>
                  {new Date(t.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
                {t.hadImage && (
                  <span className="inline-flex items-center gap-0.5 text-coral-deep">
                    <ImageIcon size={9} />
                    screen
                  </span>
                )}
              </div>
              {t.text ? (
                <div
                  className={
                    t.id === latestId
                      ? "text-[13.5px] leading-[1.5]"
                      : "text-[12px] leading-[1.45]"
                  }
                >
                  <Markdown>{t.text}</Markdown>
                </div>
              ) : (
                <div className="py-0.5">
                  <span className="inline-block w-[6px] h-[13px] rounded-[1px] bg-coral animate-pulse-soft" />
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
        <LatestPill
          show={!coachScroll.pinned}
          onClick={coachScroll.jumpToLatest}
        />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-paper">
      {/* Top bar */}
      <header className="draggable flex items-center justify-between px-6 pt-3 pb-3 border-b border-line">
        <div className="flex items-center gap-3 pl-16">
          <span
            className="font-serif text-[19px] tracking-tight text-ink"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
          >
            Live call
          </span>
          <span className="flex items-center gap-1.5 no-drag">
            <span className={`w-1.5 h-1.5 rounded-full ${chipDot}`} />
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
              {chipLabel}
            </span>
          </span>
          {sessionLive && (
            <span className="font-mono text-[11.5px] text-ink-subtle tabular-nums no-drag">
              {elapsed}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 no-drag">
          {sessionLive ? (
            <button
              onClick={stopSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] bg-coral text-white hover:bg-coral-deep transition-colors"
            >
              <Square size={11} fill="currentColor" />
              <span>Stop session</span>
            </button>
          ) : (
            <button
              onClick={startSession}
              disabled={!recognition.supported}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] bg-ink text-paper hover:bg-coral-deep disabled:opacity-50 transition-colors"
            >
              <Mic size={12} />
              <span>{turns.length || transcript ? "Resume listening" : "Start listening"}</span>
            </button>
          )}
          {!sessionLive && (turns.length > 0 || transcript) && (
            <button
              onClick={clearSession}
              className="ml-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-ink-muted hover:bg-paper-warm transition-colors"
              title="Clear transcript and coach history"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          )}
          <button
            onClick={() => window.electronAPI.toggleStealth()}
            className={`ml-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
              stealth
                ? "bg-ink text-paper"
                : "text-ink-muted hover:bg-paper-warm"
            }`}
            title={stealth ? "Stealth ON: Hidden from screen capture" : "Stealth OFF: Visible in screen capture"}
          >
            {stealth ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{stealth ? "Stealth" : "Visible"}</span>
          </button>
          <button
            onClick={() => setShowFramework((v) => !v)}
            className={`ml-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
              showFramework
                ? "bg-coral-tint text-coral-deep"
                : "text-ink-muted hover:bg-paper-warm"
            }`}
            title="Toggle the case-framework notepad"
          >
            <NotebookPen size={13} />
            <span>Framework</span>
          </button>
          <button
            onClick={() => window.electronAPI.toggleOverlay()}
            className="ml-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-ink-muted hover:bg-paper-warm transition-colors"
            title="Overlay mode — translucent, top-center (⌘⇧O)"
          >
            <Eye size={13} />
            <span>Overlay</span>
          </button>
          <button
            onClick={onExit}
            className="ml-1 p-1.5 rounded-md text-ink-muted hover:bg-paper-warm transition-colors"
            title="Exit Listening Mode"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Call type bar */}
      <div className="px-6 py-3 border-b border-line bg-paper-warm/40">
        <SalesCallSelector
          value={salesMode}
          onChange={(next) => {
            setSalesMode(next)
            window.electronAPI.setSalesMode(next).catch(console.error)
          }}
          disabled={sessionLive}
        />
      </div>

      {errorMsg && !startedAt && (
        <div className="px-6 py-2 bg-coral-tint border-b border-coral-soft text-[12.5px] text-coral-deep">
          {errorMsg}
        </div>
      )}

      {!recognition.supported && (
        <div className="px-6 py-2 bg-coral-tint border-b border-coral-soft text-[12.5px] text-coral-deep">
          Speech recognition isn't available in this Electron build. Listening
          mode needs <code className="font-mono">webkitSpeechRecognition</code> support.
        </div>
      )}

      {pendingScreen && (
        <div className="px-6 py-2 bg-paper-warm border-b border-line flex items-center gap-3">
          <img
            src={pendingScreen.preview}
            alt="screen"
            className="h-10 w-16 object-cover rounded border border-line"
          />
          <div className="flex-1 text-[12.5px] text-ink-muted">
            Screen attached. It rides with your next finalized sentence — or
            press <span className="font-mono text-[11px]">⌘⇧V</span> again to
            replace.
          </div>
          <button
            onClick={() => setPendingScreen(null)}
            className="text-[11.5px] text-ink-subtle hover:text-ink px-2 py-1 rounded hover:bg-paper-deep"
          >
            Discard
          </button>
        </div>
      )}

      {/* Body: two-column transcript/coach + optional framework sidebar */}
      <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1fr] overflow-hidden">
        {/* Transcript pane */}
        <div className="flex flex-col border-r border-line min-h-0 relative">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
              You
            </h2>
            {sessionLive && (
              <div className="flex items-end gap-[2px] h-3">
                {Array.from({ length: 12 }).map((_, i) => {
                  const h = Math.max(
                    8,
                    Math.min(
                      100,
                      recognition.level * 100 + (Math.random() - 0.5) * 16
                    )
                  )
                  return (
                    <div
                      key={i}
                      className="w-[2px] bg-coral-deep rounded-full transition-all duration-75"
                      style={{
                        height: `${h}%`,
                        opacity: recognition.level > 0.05 ? 1 : 0.3
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>
          <div
            ref={transcriptScroll.ref}
            className="flex-1 overflow-y-auto scrollbar-paper px-5 pb-6"
          >
            {!transcript && !recognition.interim && !sessionLive ? (
              <Welcome />
            ) : (
              <div
                className="font-serif text-[18px] leading-[1.55] text-ink-soft"
                style={{
                  fontVariationSettings: '"opsz" 16, "SOFT" 40, "wght" 380'
                }}
              >
                {transcript}
                {recognition.interim && (
                  <span className="text-ink-muted">
                    {transcript ? " " : ""}
                    {recognition.interim}
                    <span className="inline-block w-[6px] h-[18px] -mb-[2px] ml-[1px] bg-coral animate-pulse-soft" />
                  </span>
                )}
                {sessionLive && !transcript && !recognition.interim && (
                  <span className="text-ink-subtle italic">
                    Waiting for you to speak…
                  </span>
                )}
              </div>
            )}
          </div>
          <LatestPill
            show={!transcriptScroll.pinned}
            onClick={transcriptScroll.jumpToLatest}
          />
        </div>

        {/* Coach pane */}
        <div className="flex flex-col min-h-0 bg-gradient-to-br from-paper to-paper-warm relative">
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full bg-coral flex items-center justify-center text-paper text-[8px] font-serif"
              style={{ fontVariationSettings: '"opsz" 144' }}
            >
              A
            </span>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
              Aaicha's notes
            </h2>
          </div>
          <div className="relative flex-1 min-h-0">
          <div
            ref={coachScroll.ref}
            className="h-full overflow-y-auto scrollbar-paper px-5 pb-3 space-y-4"
          >
            {turns.length === 0 && !sessionLive && (
              <p className="text-[13px] text-ink-subtle italic mt-2">
                Aaicha's notes appear here when the session is live.
              </p>
            )}
            {turns.length === 0 && sessionLive && (
              <p className="text-[13px] text-ink-subtle italic mt-2">
                Listening. I'll chime in when you finish a thought.
              </p>
            )}
            {turns.map((t) => {
              const isSilence = t.done && t.text.trim() === "·"
              if (isSilence) return null // hide silent-mode replies
              return (
                <div
                  key={t.id}
                  className="animate-fade-up rounded-lg border border-line border-l-2 border-l-coral bg-paper-warm/60 px-3.5 py-3"
                >
                  <div className="text-[9.5px] uppercase tracking-[0.14em] text-ink-faint mb-1.5 flex items-center gap-1.5">
                    <span>
                      {new Date(t.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                    {t.hadImage && (
                      <span className="inline-flex items-center gap-0.5 text-coral-deep">
                        <ImageIcon size={10} />
                        screen
                      </span>
                    )}
                  </div>
                  {t.text ? (
                    <Markdown>{t.text}</Markdown>
                  ) : (
                    <div className="py-0.5">
                      <span className="inline-block w-[7px] h-[15px] rounded-[1px] bg-coral animate-pulse-soft" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <LatestPill
            show={!coachScroll.pinned}
            onClick={coachScroll.jumpToLatest}
          />
          </div>

          {/* Nudge box */}
          <div className="px-4 pb-4 pt-2 border-t border-line">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 focus-within:border-coral-soft">
              <MessageSquare size={13} className="text-ink-subtle shrink-0" />
              <input
                value={nudge}
                onChange={(e) => setNudge(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendNudge()
                  }
                }}
                placeholder={
                  sessionLive
                    ? "Whisper to Aaicha… (e.g. 'counter the price objection')"
                    : "Start the session to whisper to Aaicha"
                }
                disabled={!sessionLive}
                className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-subtle focus:outline-none disabled:opacity-40"
              />
              <button
                onClick={sendNudge}
                disabled={!sessionLive || !nudge.trim()}
                className="p-1 rounded-md text-ink-subtle hover:text-ink disabled:opacity-30"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showFramework && (
        <FrameworkSidebar
          framework={FRAMEWORKS[salesMode.callType]}
          open={showFramework}
          onOpenChange={setShowFramework}
        />
      )}
      </div>

      <SessionSummary
        open={!!summary && !summarizing}
        onClose={() => setSummary(null)}
        result={
          summary ?? {
            scores: { discovery: 0, rapport: 0, objectionHandling: 0, value: 0, nextSteps: 0 },
            overall: 0,
            strengths: [],
            improvements: []
          }
        }
      />
    </div>
  )
}

function Welcome() {
  return (
    <div className="pt-10 pb-6">
      <h1
        className="font-serif text-[34px] leading-[1.1] text-ink mb-3"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 60, "wght" 380' }}
      >
        Live sales call, with a quiet assistant in your ear.
      </h1>
      <p className="text-[14px] leading-[1.6] text-ink-muted max-w-[440px]">
        Press <span className="font-medium text-ink">Start listening</span>.
        Talk with your customer as you normally would — the live transcript
        appears here, and Aaicha's notes appear on the right.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-2.5">
        <Bullet>
          Aaicha chimes in after each finished thought, with either a ready-to-say line or a terse cue.
        </Bullet>
        <Bullet>
          Whisper a question to Aaicha in the box below right ("how should I answer this objection?").
        </Bullet>
        <Bullet>
          Press{" "}
          <span className="font-mono text-[11.5px] bg-paper-deep px-1.5 py-0.5 rounded">
            Stop session
          </span>{" "}
          to end.
        </Bullet>
      </div>
    </div>
  )
}

function LatestPill({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null
  return (
    <button
      onClick={onClick}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full border border-line-strong bg-white/95 px-2.5 py-1 text-[11px] text-ink-muted shadow-sm hover:text-ink hover:border-coral-soft transition-colors animate-fade-in"
    >
      <ArrowDown size={11} />
      latest
    </button>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[13px] text-ink-muted">
      <span className="w-1 h-1 rounded-full bg-coral mt-2 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

