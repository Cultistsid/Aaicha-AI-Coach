import { useCallback, useEffect, useState } from "react"
import Chat from "./_pages/Chat"
import { Setup } from "./_pages/Setup"
import { AaichaSettings } from "./types/electron"
import { ErrorBoundary } from "./components/ErrorBoundary"

const App: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [initial, setInitial] = useState<AaichaSettings | undefined>(undefined)
  const [envPath, setEnvPath] = useState<string | undefined>(undefined)

  const refresh = useCallback(async () => {
    const r = await window.electronAPI.getSettings()
    setConfigured(r.configured)
    setInitial(r.settings)
    setEnvPath(r.envPath)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Allow the renderer to open settings from anywhere via an event.
  useEffect(() => {
    const handler = () => setShowSettings(true)
    window.addEventListener("aaicha:open-settings", handler)
    return () => window.removeEventListener("aaicha:open-settings", handler)
  }, [])

  if (loading) return null

  if (!configured) {
    return (
      <Setup
        initial={initial}
        envPath={envPath}
        onSaved={() => {
          refresh()
        }}
      />
    )
  }

  if (showSettings) {
    return (
      <Setup
        initial={initial}
        envPath={envPath}
        asModal
        onClose={() => setShowSettings(false)}
        onSaved={() => {
          refresh()
          setShowSettings(false)
        }}
      />
    )
  }

  return (
    <ErrorBoundary>
      <Chat />
    </ErrorBoundary>
  )
}

export default App
