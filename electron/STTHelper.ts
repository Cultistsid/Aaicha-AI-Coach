import { SpeechClient } from "@google-cloud/speech"
import { Writable } from "stream"

type Listener = (event: STTEvent) => void

export type STTEvent =
  | { kind: "status"; status: "open" | "closed" | "error"; message?: string }
  | { kind: "interim"; text: string }
  | { kind: "final"; text: string }

// Google's streaming Recognize caps each stream at 305 seconds. We proactively
// rotate at 4 minutes so we never see a mid-utterance cutoff.
const STREAM_ROTATE_MS = 4 * 60 * 1000
// If a stream dies unexpectedly (network blip, server reset), reopen after a
// short pause instead of killing the whole session. Backoff doubles per
// consecutive fast failure so a real outage doesn't spin-loop the API.
const RESTART_DELAY_MS = 300
const RESTART_DELAY_MAX_MS = 5000
// A stream that survived this long counts as healthy → reset the backoff.
const HEALTHY_STREAM_MS = 5000

export class STTHelper {
  private client: SpeechClient
  private stream: Writable | null = null
  private listeners = new Set<Listener>()
  private rotateTimer: NodeJS.Timeout | null = null
  private restartTimer: NodeJS.Timeout | null = null
  private wantOpen = false
  private failCount = 0
  private languageCode: string

  constructor(opts: { languageCode?: string } = {}) {
    this.client = new SpeechClient()
    this.languageCode = opts.languageCode || "en-US"
  }

  public on(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: STTEvent) {
    for (const l of this.listeners) {
      try {
        l(event)
      } catch (err) {
        console.error("[STTHelper] listener error:", err)
      }
    }
  }

  public start(): void {
    if (this.wantOpen) return
    this.wantOpen = true
    this.failCount = 0
    this.openStream()
  }

  private openStream(): void {
    const request = {
      config: {
        encoding: "LINEAR16" as const,
        sampleRateHertz: 16000,
        languageCode: this.languageCode,
        enableAutomaticPunctuation: true,
        model: "latest_long",
        useEnhanced: true
      },
      interimResults: true
    }

    try {
      const openedAt = Date.now()
      // 'error' and 'end'/'close' can all fire on the same stream — run the
      // down-path exactly once per stream.
      let down = false
      const streamDown = (message?: string) => {
        if (down) return
        down = true
        if (this.stream === stream) this.stream = null
        if (Date.now() - openedAt >= HEALTHY_STREAM_MS) this.failCount = 0
        else this.failCount++
        if (message) {
          this.emit({ kind: "status", status: "error", message })
        }
        if (this.wantOpen) {
          this.scheduleRestart()
        } else {
          this.emit({ kind: "status", status: "closed" })
        }
      }

      const stream = this.client
        .streamingRecognize(request)
        .on("error", (err: any) => {
          console.error("[STTHelper] stream error:", err?.message || err)
          streamDown(err?.message || String(err))
        })
        .on("data", (data: any) => {
          const result = data?.results?.[0]
          if (!result) return
          const transcript = result.alternatives?.[0]?.transcript ?? ""
          if (!transcript) return
          if (result.isFinal) {
            this.emit({ kind: "final", text: transcript.trim() })
          } else {
            this.emit({ kind: "interim", text: transcript })
          }
        })
        .on("end", () => streamDown())
        .on("close", () => streamDown())

      this.stream = stream as unknown as Writable
      this.emit({ kind: "status", status: "open" })

      // Schedule proactive rotation
      if (this.rotateTimer) clearTimeout(this.rotateTimer)
      this.rotateTimer = setTimeout(() => this.rotate(), STREAM_ROTATE_MS)
    } catch (err: any) {
      console.error("[STTHelper] failed to open stream:", err?.message)
      this.failCount++
      this.emit({
        kind: "status",
        status: "error",
        message: err?.message || String(err)
      })
      if (this.wantOpen) this.scheduleRestart()
    }
  }

  // Seamless rotation: open the new stream FIRST, then detach the old one —
  // so no audio chunk ever lands on an ended stream and the old stream's
  // end/error events can't touch session state.
  private rotate(): void {
    if (!this.wantOpen) return
    const old = this.stream
    // Open the new stream BEFORE nulling the old one — avoids audio gap
    this.openStream()
    // openStream swallows its own errors; if it failed, this.stream still
    // points at `old`, which would make scheduleRestart's guard skip forever.
    if (this.stream === old) this.stream = null
    if (old) {
      old.removeAllListeners()
      old.on("error", () => {}) // late gRPC errors on a discarded stream
      try {
        old.end()
      } catch {
        /* ignore */
      }
    }
  }

  private scheduleRestart(): void {
    if (this.restartTimer) return
    const delay = Math.min(
      RESTART_DELAY_MAX_MS,
      RESTART_DELAY_MS * 2 ** Math.max(0, this.failCount - 1)
    )
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      if (this.wantOpen && !this.stream) this.openStream()
    }, delay)
  }

  public writeAudio(buf: Buffer): void {
    const s = this.stream
    if (!s) return
    // gRPC streams may not expose .destroyed/.writable reliably — guard + swallow
    if ((s as any).destroyed || (s as any).writableEnded) return
    try {
      s.write(buf)
    } catch {
      // Stream died mid-write; rotation will handle it — ignore silently
    }
  }

  public stop(): void {
    this.wantOpen = false
    if (this.rotateTimer) {
      clearTimeout(this.rotateTimer)
      this.rotateTimer = null
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    const old = this.stream
    this.stream = null
    if (old) {
      old.removeAllListeners()
      old.on("error", () => {})
      try {
        old.end()
      } catch {
        /* ignore */
      }
    }
    this.emit({ kind: "status", status: "closed" })
  }
}
