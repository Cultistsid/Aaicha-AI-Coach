import { useState } from "react"
import { Check, ChevronRight, NotebookPen } from "lucide-react"
import type { InterviewType } from "./InterviewModeSelector"

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

/** Built-in frameworks keyed by interview type. The coach surfaces the one
 *  matching the active session; "mixed" falls back to the case structure. */
export const FRAMEWORKS: Record<InterviewType, Framework> = {
  case: {
    name: "Case structure",
    tagline: "A clean issue tree beats a clever answer.",
    steps: [
      { id: "clarify", title: "Clarify the question", detail: "Restate the ask, confirm the objective and the metric of success." },
      { id: "structure", title: "Lay out a structure", detail: "2–4 MECE buckets. Ask for a moment to think before you speak." },
      { id: "hypothesis", title: "State a hypothesis", detail: "Where do you think the answer lands, and what would prove it?" },
      { id: "analyze", title: "Work the buckets", detail: "Drive to numbers. Narrate your logic as you go." },
      { id: "synthesize", title: "Synthesize", detail: "So-what first, then the supporting two or three reasons." },
      { id: "recommend", title: "Recommend + risks", detail: "A clear call, the next step, and what could break it." }
    ]
  },
  technical: {
    name: "Technical structure",
    tagline: "Say the approach out loud before you touch the detail.",
    steps: [
      { id: "restate", title: "Restate + assumptions", detail: "Confirm inputs, outputs, scale, and edge cases." },
      { id: "approach", title: "Name the approach", detail: "Brute force first, then the optimization and its tradeoff." },
      { id: "plan", title: "Plan the steps", detail: "Break into stages before writing or estimating anything." },
      { id: "execute", title: "Execute cleanly", detail: "Keep it readable. Talk through each decision." },
      { id: "verify", title: "Test + complexity", detail: "Walk an example, cover edge cases, state time/space cost." }
    ]
  },
  behavioral: {
    name: "STAR structure",
    tagline: "Specific beats impressive. Numbers beat adjectives.",
    steps: [
      { id: "situation", title: "Situation", detail: "One or two lines of context. Where, when, your role." },
      { id: "task", title: "Task", detail: "The concrete goal and why it mattered." },
      { id: "action", title: "Action", detail: "What YOU did — first person, specific decisions." },
      { id: "result", title: "Result", detail: "Quantified outcome, then the lesson you carried forward." }
    ]
  },
  mixed: {
    name: "Case structure",
    tagline: "A clean issue tree beats a clever answer.",
    steps: [
      { id: "clarify", title: "Clarify the question", detail: "Restate the ask, confirm the objective and the metric of success." },
      { id: "structure", title: "Lay out a structure", detail: "2–4 MECE buckets. Ask for a moment to think before you speak." },
      { id: "hypothesis", title: "State a hypothesis", detail: "Where do you think the answer lands, and what would prove it?" },
      { id: "analyze", title: "Work the buckets", detail: "Drive to numbers. Narrate your logic as you go." },
      { id: "synthesize", title: "Synthesize", detail: "So-what first, then the supporting two or three reasons." },
      { id: "recommend", title: "Recommend + risks", detail: "A clear call, the next step, and what could break it." }
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
                  Coach's notepad
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
