import { useState } from "react"
import { Check, ChevronRight, NotebookPen } from "lucide-react"
import type { CallType } from "./SalesCallSelector"

export interface FrameworkStep {
  id: string
  title: string
  detail?: string
}

export interface Framework {
  name: string
  tagline: string
  steps: FrameworkStep[]
}

/** Built-in sales playbooks keyed by call type. The assistant surfaces the one
 *  matching the active session. */
export const FRAMEWORKS: Record<CallType, Framework> = {
  discovery: {
    name: "Discovery structure",
    tagline: "Diagnose before you prescribe. Questions over pitches.",
    steps: [
      { id: "rapport", title: "Open + set the agenda", detail: "Confirm time, state the goal of the call, earn the right to ask." },
      { id: "current", title: "Map the current state", detail: "How do they do this today? What tools, who's involved, what volume?" },
      { id: "pain", title: "Surface the pain", detail: "What's not working, what does it cost them, why now?" },
      { id: "impact", title: "Quantify the impact", detail: "Put a number on the problem — time, money, risk." },
      { id: "process", title: "Map the buying process", detail: "Decision makers, budget, timeline, what else they're evaluating." },
      { id: "next", title: "Agree a next step", detail: "A concrete, scheduled next action before you hang up." }
    ]
  },
  demo: {
    name: "Demo structure",
    tagline: "Show the one thing that solves their pain, not every feature.",
    steps: [
      { id: "recap", title: "Recap their pain", detail: "Replay what you heard so they know this is tailored." },
      { id: "framing", title: "Frame the outcome", detail: "Lead with the result, not the UI tour." },
      { id: "show", title: "Show to the pain", detail: "Demo only the paths that map to their problem." },
      { id: "proof", title: "Drop proof points", detail: "A relevant customer, a metric, a before/after." },
      { id: "checkin", title: "Check for resonance", detail: "\"How would that work for your team?\" Pause and listen." },
      { id: "next", title: "Agree a next step", detail: "Trial, stakeholder intro, or proposal — name the date." }
    ]
  },
  "objection-handling": {
    name: "Objection structure",
    tagline: "Acknowledge first. Never argue — clarify, then reframe.",
    steps: [
      { id: "listen", title: "Hear it fully", detail: "Let them finish. Don't jump to defend." },
      { id: "acknowledge", title: "Acknowledge", detail: "\"That's fair\" — lower the temperature before responding." },
      { id: "clarify", title: "Clarify the real concern", detail: "Is price the issue, or value? Ask one isolating question." },
      { id: "respond", title: "Respond with proof", detail: "Reframe against value or risk, back it with evidence." },
      { id: "confirm", title: "Confirm it's resolved", detail: "\"Does that address it?\" Don't assume — check." }
    ]
  },
  closing: {
    name: "Closing structure",
    tagline: "Ask for the business. Silence after the ask is your friend.",
    steps: [
      { id: "summarize", title: "Summarize the value", detail: "Recap the pain, the fit, and the agreed outcome." },
      { id: "confirm", title: "Confirm alignment", detail: "\"Anything standing between us and moving forward?\"" },
      { id: "ask", title: "Make the ask", detail: "Direct and specific. Then stop talking." },
      { id: "terms", title: "Handle terms", detail: "Pricing, start date, paperwork — stay concrete." },
      { id: "next", title: "Lock the next step", detail: "Signature, kickoff date, or the exact follow-up and when." }
    ]
  }
}

interface FrameworkSidebarProps {
  framework: Framework
  /** Controlled open state. Omit to let the panel manage its own. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function FrameworkSidebar({
  framework,
  open: openProp,
  onOpenChange
}: FrameworkSidebarProps) {
  const [openInternal, setOpenInternal] = useState(true)
  const open = openProp ?? openInternal
  const setOpen = (v: boolean) => {
    setOpenInternal(v)
    onOpenChange?.(v)
  }

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))

  const done = framework.steps.filter((s) => checked[s.id]).length
  const total = framework.steps.length

  return (
    <aside
      className={`relative shrink-0 h-full border-l border-line bg-paper-warm transition-[width] duration-300 ease-out ${
        open ? "w-[300px]" : "w-[44px]"
      }`}
    >
      {/* Collapsed rail */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Open framework"
          className="group flex flex-col items-center gap-2 w-full h-full pt-4 text-ink-subtle hover:text-coral-deep transition-colors"
        >
          <NotebookPen size={15} />
          <span
            className="text-[10.5px] uppercase tracking-[0.16em] [writing-mode:vertical-rl]"
          >
            Framework
          </span>
        </button>
      )}

      {open && (
        <div className="flex flex-col h-full animate-fade-in">
          {/* Header — torn-notepad feel via a subtle top edge */}
          <div className="px-4 pt-4 pb-3 border-b border-line">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-coral-tint flex items-center justify-center">
                  <NotebookPen size={12} className="text-coral-deep" />
                </span>
                <h2 className="text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle pt-1">
                  Playbook
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                title="Collapse"
                className="p-1 -mr-1 rounded-md text-ink-subtle hover:text-ink hover:bg-white/60 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <div
              className="font-serif text-[20px] text-ink mt-2 leading-tight"
              style={{ fontVariationSettings: '"opsz" 40, "SOFT" 50, "wght" 400' }}
            >
              {framework.name}
            </div>
            <p className="text-[12px] italic text-ink-muted leading-[1.45] mt-1">
              {framework.tagline}
            </p>
          </div>

          {/* Progress */}
          <div className="px-4 py-2.5 flex items-center gap-2 border-b border-line/70">
            <div className="flex-1 h-1 rounded-full bg-paper-deep overflow-hidden">
              <div
                className="h-full bg-coral rounded-full transition-all duration-300"
                style={{ width: `${total ? (done / total) * 100 : 0}%` }}
              />
            </div>
            <span className="font-mono text-[10.5px] text-ink-subtle tabular-nums">
              {done}/{total}
            </span>
          </div>

          {/* Checklist */}
          <div className="flex-1 overflow-y-auto scrollbar-paper px-2 py-2">
            <ol className="space-y-0.5">
              {framework.steps.map((step, i) => {
                const isDone = !!checked[step.id]
                return (
                  <li key={step.id}>
                    <button
                      onClick={() => toggle(step.id)}
                      className="group w-full text-left flex gap-2.5 px-2 py-2 rounded-lg hover:bg-white/60 transition-colors"
                    >
                      <span
                        className={`mt-0.5 shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                          isDone
                            ? "bg-coral border-coral text-white"
                            : "border-line-strong text-transparent group-hover:border-coral-soft"
                        }`}
                      >
                        <Check size={11} strokeWidth={3} />
                      </span>
                      <div className="min-w-0">
                        <div
                          className={`text-[13px] leading-snug transition-colors ${
                            isDone
                              ? "text-ink-subtle line-through decoration-coral-soft"
                              : "text-ink"
                          }`}
                        >
                          <span className="font-mono text-[11px] text-ink-faint mr-1.5">
                            {i + 1}
                          </span>
                          {step.title}
                        </div>
                        {step.detail && (
                          <div className="text-[11.5px] text-ink-muted leading-[1.45] mt-0.5">
                            {step.detail}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
    </aside>
  )
}
