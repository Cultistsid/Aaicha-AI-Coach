import { useCallback, useEffect, useRef, useState } from "react"

export interface UsePCMRecorderOptions {
  onChunk: (base64Pcm: string) => void
}

export interface UsePCMRecorderResult {
  level: number
  start: () => Promise<void>
  stop: () => Promise<void>
}

// Captures mic audio, downsamples to 16kHz Int16 PCM via an AudioWorklet, and
// hands ~100ms base64 chunks to `onChunk`. Also exposes a smooth VU `level`
// (0..1) via a side analyser.
export function usePCMRecorder(
  opts: UsePCMRecorderOptions
): UsePCMRecorderResult {
  const [level, setLevel] = useState(0)
  const ctxRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<AudioWorkletNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const onChunkRef = useRef(opts.onChunk)
  useEffect(() => {
    onChunkRef.current = opts.onChunk
  }, [opts.onChunk])

  const stop = useCallback(async () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (nodeRef.current) {
      try {
        nodeRef.current.port.onmessage = null
        nodeRef.current.disconnect()
      } catch {
        /* ignore */
      }
      nodeRef.current = null
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch {
        /* ignore */
      }
      analyserRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (ctxRef.current) {
      await ctxRef.current.close().catch(() => {})
      ctxRef.current = null
    }
    setLevel(0)
  }, [])

  const start = useCallback(async () => {
    if (ctxRef.current) return // already running
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    })
    streamRef.current = stream

    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)()
    ctxRef.current = ctx

    // Relative path so this works under both Vite dev server (/) and the
    // packaged file:// renderer (./pcm-worklet.js next to index.html).
    await ctx.audioWorklet.addModule("./pcm-worklet.js")
    const src = ctx.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(ctx, "pcm-worklet")
    node.port.onmessage = (ev) => {
      const ab = ev.data as ArrayBuffer
      if (!ab || ab.byteLength === 0) return
      const bytes = new Uint8Array(ab)
      let bin = ""
      // Chunked toString to avoid call-stack issues on large arrays.
      const CHUNK = 0x8000
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(
          null,
          bytes.subarray(i, i + CHUNK) as unknown as number[]
        )
      }
      onChunkRef.current(btoa(bin))
    }

    // Side analyser for the VU meter
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256

    src.connect(analyser)
    src.connect(node)
    // node doesn't need to be connected to destination — output silence

    nodeRef.current = node
    analyserRef.current = analyser

    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = sum / data.length / 255
      setLevel(Math.min(1, avg * 2.5))
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  useEffect(() => {
    return () => {
      stop().catch(() => {})
    }
  }, [stop])

  return { level, start, stop }
}
