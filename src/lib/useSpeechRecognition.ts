import { useCallback, useEffect, useRef, useState } from "react"
import { usePCMRecorder } from "./usePCMRecorder"

export interface UseSpeechRecognitionOptions {
  onFinal?: (text: string) => void
  onInterim?: (text: string) => void
  lang?: string
}

export interface UseSpeechRecognitionResult {
  supported: boolean
  listening: boolean
  interim: string
  error: string | null
  level: number
  start: () => Promise<void>
  stop: () => Promise<void>
}

// Streams 16kHz PCM audio from the renderer to the Electron main process,
// which feeds it into Google Cloud Speech streamingRecognize and pipes
// interim/final transcripts back via the stt:event IPC channel.
export function useSpeechRecognition(
  opts: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [error, setError] = useState<string | null>(null)

  const onFinalRef = useRef(opts.onFinal)
  const onInterimRef = useRef(opts.onInterim)
  useEffect(() => {
    onFinalRef.current = opts.onFinal
    onInterimRef.current = opts.onInterim
  }, [opts.onFinal, opts.onInterim])

  const sendChunk = useCallback((b64: string) => {
    window.electronAPI.sttSendAudio(b64)
  }, [])

  const recorder = usePCMRecorder({ onChunk: sendChunk })

  // Subscribe to STT events from main
  useEffect(() => {
    const cleanup = window.electronAPI.onSTTEvent((event) => {
      switch (event.kind) {
        case "status":
          if (event.status === "open") {
            setListening(true)
            setError(null)
          } else if (event.status === "closed") {
            setListening(false)
            setInterim("")
          } else if (event.status === "error") {
            setError(event.message || "Speech recognition error")
          }
          break
        case "interim":
          setInterim(event.text || "")
          onInterimRef.current?.(event.text || "")
          break
        case "final": {
          const text = event.text?.trim() || ""
          setInterim("")
          if (text) onFinalRef.current?.(text)
          break
        }
      }
    })
    return cleanup
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setInterim("")
    const result = await window.electronAPI.sttStart()
    if (!result.success) {
      setError(result.error || "Failed to start speech recognition")
      return
    }
    try {
      await recorder.start()
    } catch (err: any) {
      setError(err?.message || "Mic access denied")
      await window.electronAPI.sttStop()
    }
  }, [recorder])

  const stop = useCallback(async () => {
    await recorder.stop()
    await window.electronAPI.sttStop()
    setListening(false)
    setInterim("")
  }, [recorder])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recorder.stop().catch(() => {})
      window.electronAPI.sttStop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    supported: true,
    listening,
    interim,
    error,
    level: recorder.level,
    start,
    stop
  }
}
