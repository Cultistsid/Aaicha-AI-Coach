import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import type { InterviewMode } from "../../types/electron.d"

export type InterviewType = InterviewMode["type"]
export type Persona = InterviewMode["persona"]
export type Difficulty = InterviewMode["difficulty"]
export type Company = InterviewMode["company"]

export type { InterviewMode }

interface Option<T extends string> {
  value: T
  label: string
  blurb: string
}

const TYPE_OPTIONS: Option<InterviewType>[] = [
  { value: "case", label: "Case", blurb: "Market sizing, profitability, strategy" },
  { value: "technical", label: "Technical", blurb: "Data, SQL, estimation, structuring" },
  { value: "behavioral", label: "Behavioral", blurb: "STAR stories, fit, leadership" },
  { value: "mixed", label: "Mixed", blurb: "A realistic blend of all three" }
]

const PERSONA_OPTIONS: Option<Persona>[] = [
  { value: "partner", label: "Partner", blurb: "Terse, senior, time-pressured" },
  { value: "manager", label: "Manager", blurb: "Structured, probing, supportive" },
  { value: "senior-consultant", label: "Senior Consultant", blurb: "Peer tone, detail-focused" }
]

const DIFFICULTY_OPTIONS: Option<Difficulty>[] = [
  { value: "intern", label: "Intern", blurb: "Gentle pacing, more scaffolding" },
  { value: "analyst", label: "Analyst", blurb: "Standard Deloitte bar" },
  { value: "senior-analyst", label: "Senior Analyst", blurb: "Fast, sharp, less hand-holding" }
]

const COMPANY_OPTIONS: Option<Company>[] = [
  { value: "deloitte", label: "Deloitte", blurb: "Deloitte-flavored cases and bar" },
  { value: "generic", label: "Generic", blurb: "Firm-agnostic interview" }
]

interface InterviewModeSelectorProps {
  value: InterviewMode
  onChange: (next: InterviewMode) => void
  /** Disable while a session is live so mode can't shift mid-interview. */
  disabled?: boolean
  className?: string
}

export function InterviewModeSelector({
  value,
  onChange,
  disabled,
  className = ""
}: InterviewModeSelectorProps) {
  return (
    <div className={`flex flex-wrap items-end gap-5 ${className}`}>
      <Dropdown
        label="Firm"
        options={COMPANY_OPTIONS}
        value={value.company}
        onChange={(company) => onChange({ ...value, company })}
        disabled={disabled}
      />
      <PillGroup
        label="Interview type"
        options={TYPE_OPTIONS}
        value={value.type}
        onChange={(type) => onChange({ ...value, type })}
        disabled={disabled}
      />
      <Dropdown
        label="Persona"
        options={PERSONA_OPTIONS}
        value={value.persona}
        onChange={(persona) => onChange({ ...value, persona })}
        disabled={disabled}
      />
      <Dropdown
        label="Difficulty"
        options={DIFFICULTY_OPTIONS}
        value={value.difficulty}
        onChange={(difficulty) => onChange({ ...value, difficulty })}
        disabled={disabled}
      />
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle mb-1.5">
      {children}
    </div>
  )
}

/** Segmented pill control — used for the primary interview-type choice. */
function PillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div
        role="radiogroup"
        aria-label={label}
        className={`inline-flex rounded-xl border border-line bg-paper-warm p-1 ${
          disabled ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              title={opt.blurb}
              onClick={() => onChange(opt.value)}
              className={`relative px-3.5 py-1.5 text-[12.5px] rounded-lg transition-all duration-200 ${
                active
                  ? "bg-coral text-white shadow-sm"
                  : "text-ink-muted hover:text-ink hover:bg-white/60"
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Compact dropdown — used for persona and difficulty. */
function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Label>{label}</Label>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 min-w-[160px] justify-between px-3 py-1.5 rounded-xl border bg-white text-[12.5px] transition-colors disabled:opacity-50 ${
          open ? "border-coral-soft" : "border-line hover:border-line-strong"
        }`}
      >
        <span className="text-ink">{current.label}</span>
        <ChevronDown
          size={13}
          className={`text-ink-subtle transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1.5 w-[240px] rounded-xl border border-line bg-white shadow-lg overflow-hidden animate-fade-up"
        >
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`w-full text-left px-3.5 py-2.5 transition-colors ${
                  active ? "bg-coral-tint" : "hover:bg-paper-warm"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[13px] ${
                      active ? "text-coral-deep font-medium" : "text-ink"
                    }`}
                  >
                    {opt.label}
                  </span>
                  {active && <Check size={13} className="text-coral-deep" />}
                </div>
                <div className="text-[11.5px] text-ink-muted leading-[1.4] mt-0.5">
                  {opt.blurb}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
