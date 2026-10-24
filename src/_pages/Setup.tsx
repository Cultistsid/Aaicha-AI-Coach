import { useEffect, useState } from "react"
import { AaichaSettings } from "../types/electron"

interface SetupProps {
  initial?: Omit<AaichaSettings, "anthropicApiKey">
  keyConfigured?: boolean
  envPath?: string
  onSaved: () => void
  // If true, render as a settings modal (with a back / cancel button); if
  // false, render as the first-run welcome screen.
  asModal?: boolean
  onClose?: () => void
}

export function Setup({
  initial,
  keyConfigured,
  envPath,
  onSaved,
  asModal,
  onClose
}: SetupProps) {
  const [anthropicApiKey, setKey] = useState("")
  const keyMissing = !keyConfigured && !anthropicApiKey.trim()
  const [googleCloudProject, setProject] = useState(
    initial?.googleCloudProject || ""
  )
  const [googleCloudLocation, setLocation] = useState(
    initial?.googleCloudLocation || "us-central1"
  )
  const [background, setBackground] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load existing background on mount
  useEffect(() => {
    window.electronAPI.getBackground().then((text) => {
      if (text) setBackground(text)
    })
  }, [])

  // Auto-focus the first empty field
  useEffect(() => {
    const target = keyMissing ? "key" : !googleCloudProject ? "proj" : null
    if (target) {
      const el = document.getElementById(target) as HTMLInputElement | null
      el?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    setError(null)
    if (keyMissing) {
      setError("Anthropic API key is required.")
      return
    }
    setSaving(true)
    const [r1, r2] = await Promise.all([
      window.electronAPI.saveSettings({
        anthropicApiKey: anthropicApiKey.trim() || undefined,
        googleCloudProject: googleCloudProject.trim() || undefined,
        googleCloudLocation: googleCloudLocation.trim() || undefined
      }),
      window.electronAPI.saveBackground(background)
    ])
    setSaving(false)
    const result = !r1.success ? r1 : r2
    if (!result.success) {
      setError(result.error || "Failed to save")
      return
    }
    onSaved()
  }

  return (
    <div className="flex flex-col h-screen bg-paper overflow-y-auto scrollbar-paper">
      {asModal && (
        <div className="draggable flex items-center justify-between px-6 pt-3 pb-3 border-b border-line">
          <span
            className="font-serif text-[19px] tracking-tight text-ink pl-16"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
          >
            Settings
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="no-drag text-[12px] px-3 py-1.5 rounded-md text-ink-muted hover:bg-paper-warm"
            >
              Done
            </button>
          )}
        </div>
      )}
      <div className="max-w-[560px] w-full mx-auto px-8 py-12">
        {!asModal && (
          <h1
            className="font-serif text-[44px] leading-[1.05] text-ink mb-3"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 60, "wght" 380' }}
          >
            Welcome to Aaicha.
          </h1>
        )}
        <p className="text-[14.5px] leading-[1.6] text-ink-muted mb-8">
          A couple of keys and you're set. These stay on your machine — saved
          to{" "}
          <code className="font-mono text-[12px] bg-paper-deep px-1.5 py-0.5 rounded">
            {envPath || "~/Library/Application Support/Aaicha/.env"}
          </code>
          .
        </p>

        <div className="space-y-6">
          <Field
            label="Anthropic API key"
            hint="Required for chat, screenshots, and the live coach. Get one at console.anthropic.com/settings/keys."
          >
            <div className="flex gap-2 items-stretch">
              <input
                id="key"
                type={showKey ? "text" : "password"}
                value={anthropicApiKey}
                onChange={(e) => setKey(e.target.value)}
                placeholder={keyConfigured ? "Saved — leave blank to keep" : "sk-ant-..."}
                className="flex-1 font-mono text-[12.5px] px-3 py-2 rounded-lg border border-line bg-white focus:border-coral-soft focus:outline-none"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="px-3 py-2 rounded-lg border border-line bg-white text-[12px] text-ink-muted hover:bg-paper-warm"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          <Field
            label="Google Cloud project"
            hint="Optional. Only needed for Listening Mode (live transcription). Authenticate locally first with: gcloud auth application-default login."
          >
            <input
              id="proj"
              type="text"
              value={googleCloudProject}
              onChange={(e) => setProject(e.target.value)}
              placeholder="my-gcp-project-id"
              className="w-full font-mono text-[12.5px] px-3 py-2 rounded-lg border border-line bg-white focus:border-coral-soft focus:outline-none"
            />
          </Field>

          <Field
            label="Google Cloud location"
            hint="Defaults to us-central1. Leave alone unless you know you want different."
          >
            <input
              type="text"
              value={googleCloudLocation}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="us-central1"
              className="w-full font-mono text-[12.5px] px-3 py-2 rounded-lg border border-line bg-white focus:border-coral-soft focus:outline-none"
            />
          </Field>

          <Field
            label="Background — résumé + STAR story bank"
            hint="Import your résumé (PDF or Word), then append STAR stories below. The coach uses this only for behavioral questions during Listening Mode, drawing on your real experience instead of inventing generic answers. Stored locally; sent to Claude as cached context."
          >
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={async () => {
                  setImportNotice(null)
                  setImporting(true)
                  const r = await window.electronAPI.importBackgroundFile()
                  setImporting(false)
                  if (r.canceled) return
                  if (!r.success) {
                    setImportNotice(r.error || "Couldn't read the file.")
                    return
                  }
                  const incoming = (r.text || "").trim()
                  if (!incoming) {
                    setImportNotice("File had no extractable text.")
                    return
                  }
                  // Replace or prepend, with a separator if there's existing
                  // STAR-style content below.
                  const banner = `=== Résumé (imported from ${r.filename ?? "file"}) ===\n`
                  if (!background.trim()) {
                    setBackground(banner + incoming + "\n")
                  } else {
                    setBackground(
                      banner + incoming + "\n\n=== Existing notes ===\n" + background.trim() + "\n"
                    )
                  }
                  setImportNotice(`Imported ${r.filename}. Review below.`)
                }}
                disabled={importing}
                className="text-[12.5px] px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-paper-warm transition-colors disabled:opacity-50"
              >
                {importing ? "Reading…" : "Import résumé (PDF or Word)…"}
              </button>
              {background && (
                <button
                  onClick={() => {
                    setBackground("")
                    setImportNotice(null)
                  }}
                  className="text-[12px] text-ink-subtle hover:text-ink px-2 py-1.5"
                >
                  Clear
                </button>
              )}
            </div>
            {importNotice && (
              <div className="text-[11.5px] text-ink-subtle mb-1.5">
                {importNotice}
              </div>
            )}
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              rows={10}
              placeholder={`Click "Import résumé" above, then append STAR stories like:\n\n=== STAR stories ===\n\n## Conflict with a teammate\nSituation: ...\nTask: ...\nAction: ...\nResult: ...\n\n## A time I failed\n...`}
              className="w-full font-mono text-[12px] leading-[1.5] px-3 py-2 rounded-lg border border-line bg-white focus:border-coral-soft focus:outline-none resize-y min-h-[200px]"
            />
            {background.length > 0 && (
              <div className="text-[11px] text-ink-subtle mt-1.5 text-right">
                {background.length.toLocaleString()} characters
              </div>
            )}
          </Field>
        </div>

        {error && (
          <div className="mt-6 px-4 py-3 rounded-lg bg-coral-tint border border-coral-soft text-[13px] text-coral-deep">
            {error}
          </div>
        )}

        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || keyMissing}
            className="px-5 py-2.5 rounded-lg bg-ink text-paper hover:bg-coral-deep text-[13.5px] font-medium transition-colors disabled:bg-ink-faint disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : asModal ? "Save" : "Save and continue"}
          </button>
          {asModal && onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-[13px] text-ink-muted hover:bg-paper-warm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[11.5px] uppercase tracking-[0.14em] text-ink-subtle mb-2">
        {label}
      </div>
      {children}
      {hint && (
        <div className="text-[12px] text-ink-muted leading-[1.5] mt-1.5">
          {hint}
        </div>
      )}
    </div>
  )
}
