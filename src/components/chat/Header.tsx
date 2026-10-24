import { Volume2, VolumeX, Trash2, Headphones, Settings, EyeOff, Eye } from "lucide-react"
import { useEffect, useState } from "react"

interface HeaderProps {
  voiceEnabled: boolean
  onToggleVoice: () => void
  onClear: () => void
  onEnterListening: () => void
  status: "idle" | "thinking" | "listening" | "speaking"
}

const statusLabel: Record<HeaderProps["status"], string> = {
  idle: "Ready",
  thinking: "Thinking",
  listening: "Listening",
  speaking: "Speaking"
}

export function Header({ voiceEnabled, onToggleVoice, onClear, onEnterListening, status }: HeaderProps) {
  const [stealthActive, setStealthActive] = useState(false)

  useEffect(() => {
    window.electronAPI.getStealth()
      .then(({ active }) => setStealthActive(active))
      .catch((err) => console.error("[Header] getStealth failed:", err))
    return window.electronAPI.onStealthState(({ active }) =>
      setStealthActive(active)
    )
  }, [])

  const toggleStealth = async () => {
    try {
      const { active } = await window.electronAPI.toggleStealth()
      setStealthActive(active)
    } catch (err) {
      console.error("[Header] toggleStealth failed:", err)
    }
  }

  return (
    <header className="draggable flex items-center justify-between px-6 pt-3 pb-3 border-b border-line">
      <div className="flex items-center gap-3 pl-16">
        <span className="font-serif text-[19px] tracking-tight text-ink" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}>
          Aaicha
        </span>
        <span className="flex items-center gap-1.5 no-drag">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "thinking" ? "bg-coral animate-pulse-soft" :
              status === "listening" ? "bg-coral animate-pulse-soft" :
              status === "speaking" ? "bg-coral" :
              "bg-ink-faint"
            }`}
          />
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
            {statusLabel[status]}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-1 no-drag">
        <button
          onClick={toggleStealth}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
            stealthActive
              ? "bg-ink text-paper"
              : "text-ink-muted hover:bg-paper-warm"
          }`}
          title={stealthActive ? "Stealth ON: Hidden from screen capture" : "Stealth OFF: Visible in screen capture"}
        >
          {stealthActive ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{stealthActive ? "Stealth" : "Visible"}</span>
        </button>
        <button
          onClick={onEnterListening}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-ink-muted hover:bg-paper-warm transition-colors mr-1"
          title="Enter Live Call Mode (live sales assist)"
        >
          <Headphones size={14} />
          <span>Live Call Mode</span>
        </button>
        <button
          onClick={onToggleVoice}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
            voiceEnabled
              ? "bg-coral-wash text-coral-deep"
              : "text-ink-muted hover:bg-paper-warm"
          }`}
          title={voiceEnabled ? "Voice on — click to mute" : "Voice off — click to enable"}
        >
          {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          <span>{voiceEnabled ? "Voice on" : "Voice off"}</span>
        </button>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-ink-muted hover:bg-paper-warm transition-colors"
          title="Clear conversation"
        >
          <Trash2 size={14} />
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("aaicha:open-settings"))
          }
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-ink-muted hover:bg-paper-warm transition-colors"
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  )
}
