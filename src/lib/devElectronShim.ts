// Dev-only stand-in for the Electron preload API so the renderer can run in
// a plain browser for UI QA. Streams canned transcript + coach turns.
type Handler = (payload: any) => void

const sttHandlers = new Set<Handler>()
const coachDelta = new Set<Handler>()
const coachDone = new Set<Handler>()

const SCRIPT = [
  "Tell me about a time you had to clean really messy data.",
  "Walk me through how you'd design an orders API.",
  "Why do you want to work here?"
]

const COACH_REPLY = [
  "**Answer:** I'd lead with the corrupt `ordered_by` rows. ",
  "Six RECEIVED rows named a different person entirely — ",
  "the fix was reading the field only from the PENDING row, ",
  "so corruption never even needs detecting.\n\n",
  "```python\nby = group[group.status == 'PENDING'].iloc[0].ordered_by\n",
  "# only the authoritative row — corrupt rows are ignored by construction\n```\n",
  "Close with the mutation-testing story if they push on QA."
]

let sttTimer: number | null = null
let overlayActive = false
const overlayHandlers = new Set<Handler>()

const shim = {
  getSettings: async () => ({
    configured: true,
    settings: {},
    envPath: "/dev/null (browser shim)"
  }),
  getBackground: async () => "",
  sttStart: async () => {
    sttHandlers.forEach((h) => h({ kind: "status", status: "open" }))
    let i = 0
    sttTimer = window.setInterval(() => {
      const line = SCRIPT[i % SCRIPT.length]
      sttHandlers.forEach((h) => h({ kind: "interim", text: line.slice(0, 20) }))
      window.setTimeout(
        () => sttHandlers.forEach((h) => h({ kind: "final", text: line })),
        700
      )
      i++
    }, 6000)
    return { success: true }
  },
  sttStop: async () => {
    if (sttTimer) window.clearInterval(sttTimer)
    sttHandlers.forEach((h) => h({ kind: "status", status: "closed" }))
    return { success: true }
  },
  sttSendAudio: (_b64: string) => {},
  onSTTEvent: (h: Handler) => {
    sttHandlers.add(h)
    return () => sttHandlers.delete(h)
  },
  coachReset: async () => ({ success: true }),
  coachTurn: async (turnId: string, text: string, _img?: string) => {
    // Echo the prompt first so QA screenshots show distinct turns.
    const chunks = [`_re: ${text.slice(0, 70)}_\n\n`, ...COACH_REPLY]
    let k = 0
    const t = window.setInterval(() => {
      if (k < chunks.length) {
        coachDelta.forEach((h) => h({ turnId, text: chunks[k] }))
        k++
      } else {
        window.clearInterval(t)
        coachDone.forEach((h) => h({ turnId, text: chunks.join("") }))
      }
    }, 180)
    return { success: true }
  },
  onCoachDelta: (h: Handler) => {
    coachDelta.add(h)
    return () => coachDelta.delete(h)
  },
  onCoachDone: (h: Handler) => {
    coachDone.add(h)
    return () => coachDone.delete(h)
  },
  onCoachError: (_h: Handler) => () => {},
  onCoachScreenAttached: (_h: Handler) => () => {},
  getOverlay: async () => ({ active: overlayActive }),
  setOverlay: async (a: boolean) => {
    overlayActive = !!a
    overlayHandlers.forEach((h) => h({ active: overlayActive }))
    return { active: overlayActive }
  },
  toggleOverlay: async () => {
    overlayActive = !overlayActive
    overlayHandlers.forEach((h) => h({ active: overlayActive }))
    return { active: overlayActive }
  },
  onOverlayState: (h: Handler) => {
    overlayHandlers.add(h)
    return () => overlayHandlers.delete(h)
  }
}

export function installDevShim() {
  // Fake the mic too: without this, getUserMedia's permission prompt leaves
  // startSession suspended forever and the session never reads as Live.
  const fakeMic = async () => {
    const ac = new AudioContext()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    gain.gain.value = 0 // silent but keeps the track live
    const dst = ac.createMediaStreamDestination()
    osc.connect(gain)
    gain.connect(dst)
    osc.start()
    return dst.stream
  }
  navigator.mediaDevices.getUserMedia = fakeMic as typeof navigator.mediaDevices.getUserMedia

  ;(window as any).electronAPI = new Proxy(shim, {
    // Any API the shim doesn't model becomes a harmless no-op instead of a
    // crash, so Chat/Setup screens still render. Must be synchronous and
    // return a function: `onX(handler)` results are used as React effect
    // cleanups, and a Promise there crashes with "destroy is not a function".
    get(target, prop) {
      if (prop in target) return (target as any)[prop]
      return (..._args: unknown[]) => () => {}
    }
  })
}
