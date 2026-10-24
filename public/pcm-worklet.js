// Downsamples mic input (usually 44.1k or 48k mono Float32) to 16k mono
// Int16 PCM and posts ~100ms chunks (1600 samples) to the main thread as
// base64 strings. The renderer forwards each chunk over IPC to the main
// process, which feeds Google's streamingRecognize.
class PCMWorklet extends AudioWorkletProcessor {
  constructor() {
    super()
    this.targetRate = 16000
    this.chunkSamples = 1600 // ~100ms at 16kHz
    this.outBuf = new Int16Array(this.chunkSamples)
    this.outIdx = 0
    this.inRate = sampleRate // global from AudioWorkletGlobalScope
    // resampler position (fractional source index)
    this.cursor = 0
    this.lastSample = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const ch = input[0]
    if (!ch) return true

    const ratio = this.inRate / this.targetRate
    let i = this.cursor
    while (i < ch.length) {
      const i0 = Math.floor(i)
      const i1 = Math.min(i0 + 1, ch.length - 1)
      const frac = i - i0
      // linear interpolation between adjacent input samples
      const s = ch[i0] * (1 - frac) + ch[i1] * frac
      const clamped = Math.max(-1, Math.min(1, s))
      this.outBuf[this.outIdx++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
      if (this.outIdx === this.chunkSamples) {
        this.emitChunk()
        this.outIdx = 0
      }
      i += ratio
    }
    // remember leftover fractional position relative to next input frame
    this.cursor = i - ch.length
    this.lastSample = ch[ch.length - 1] ?? 0
    return true
  }

  emitChunk() {
    // Copy the chunk and transfer its ArrayBuffer to the main thread.
    // (btoa isn't available in AudioWorkletGlobalScope, so base64 happens
    // in usePCMRecorder.)
    const view = new Int16Array(this.outBuf.length)
    view.set(this.outBuf)
    this.port.postMessage(view.buffer, [view.buffer])
  }
}

registerProcessor("pcm-worklet", PCMWorklet)
