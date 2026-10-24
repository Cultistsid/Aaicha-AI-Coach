import type { SalesMode } from "../../types/electron.d"

export type CallType = SalesMode["callType"]

export type { SalesMode }

interface Option<T extends string> {
  value: T
  label: string
  blurb: string
}

const CALL_TYPE_OPTIONS: Option<CallType>[] = [
  { value: "discovery", label: "Discovery", blurb: "Qualify, surface pain, map the buying process" },
  { value: "demo", label: "Demo", blurb: "Tie features to the pain you heard" },
  { value: "objection-handling", label: "Objections", blurb: "Price, timing, competitor, status-quo pushback" },
  { value: "closing", label: "Closing", blurb: "Recap value, align on next steps, ask for commitment" }
]

interface SalesCallSelectorProps {
  value: SalesMode
  onChange: (next: SalesMode) => void
  /** Disable while a session is live so the call type can't shift mid-call. */
  disabled?: boolean
  className?: string
}

export function SalesCallSelector({
  value,
  onChange,
  disabled,
  className = ""
}: SalesCallSelectorProps) {
  return (
    <div className={`flex flex-wrap items-end gap-5 ${className}`}>
      <PillGroup
        label="Call type"
        options={CALL_TYPE_OPTIONS}
        value={value.callType}
        onChange={(callType) => onChange({ ...value, callType })}
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

/** Segmented pill control — used for the primary call-type choice. */
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
