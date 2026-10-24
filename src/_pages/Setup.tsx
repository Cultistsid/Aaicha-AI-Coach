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
  const [productDocs, setProductDocs] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load existing product docs on mount
  useEffect(() => {
    window.electronAPI.getProductDocs().then((text) => {
      if (text) setProductDocs(text)
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
      window.electronAPI.saveProductDocs(productDocs)
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
            hint="Required for chat, screenshots, and the live assistant. Get one at console.anthropic.com/settings/keys."
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
            hint="Optional. Only needed for Live Call Mode (live transcription). Authenticate locally first with: gcloud auth application-default login."
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
            label="Product docs — sales playbook + battlecards"
            hint="Import a one-pager, pricing sheet, or product brief (PDF or Word), then append notes below — value props, objection responses, competitor battlecards. Aaicha uses this during Live Call Mode so its suggestions match your real product instead of generic ones. Stored locally; sent to Claude as cached context."
          >
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={async () => {
                  setImportNotice(null)
                  setImporting(true)
                  const r = await window.electronAPI.importProductDocsFile()
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
                  // content below.
                  const banner = `=== Product doc (imported from ${r.filename ?? "file"}) ===\n`
                  if (!productDocs.trim()) {
                    setProductDocs(banner + incoming + "\n")
                  } else {
                    setProductDocs(
                      banner + incoming + "\n\n=== Existing notes ===\n" + productDocs.trim() + "\n"
                    )
                  }
                  setImportNotice(`Imported ${r.filename}. Review below.`)
                }}
                disabled={importing}
                className="text-[12.5px] px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-paper-warm transition-colors disabled:opacity-50"
              >
                {importing ? "Reading…" : "Import product doc (PDF or Word)…"}
              </button>
              {productDocs && (
                <button
                  onClick={() => {
                    setProductDocs("")
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
              value={productDocs}
              onChange={(e) => setProductDocs(e.target.value)}
              rows={10}
              placeholder={`Click "Import product doc" above, then append notes like:\n\n=== Value props ===\n- Cuts onboarding time 40%\n\n=== Objection responses ===\n## "Too expensive"\nReframe against cost of status quo...\n\n=== Competitor battlecards ===\n## vs Acme\n...`}
              className="w-full font-mono text-[12px] leading-[1.5] px-3 py-2 rounded-lg border border-line bg-white focus:border-coral-soft focus:outline-none resize-y min-h-[200px]"
            />
            {productDocs.length > 0 && (
              <div className="text-[11px] text-ink-subtle mt-1.5 text-right">
                {productDocs.length.toLocaleString()} characters
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
