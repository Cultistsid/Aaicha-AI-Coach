import { Dialog, DialogContent } from "../ui/dialog"
import { ArrowUpRight, Sparkles, X } from "lucide-react"

export type ScoreDimension =
  | "structure"
  | "communication"
  | "technical"
  | "business"
  | "fit"

/** 0–100 per dimension. */
export type Scores = Record<ScoreDimension, number>

export interface SessionResult {
  scores: Scores
  overall: number
  strengths: string[]
  improvements: string[]
  durationLabel?: string
}

const DIMENSIONS: { key: ScoreDimension; label: string }[] = [
  { key: "structure", label: "Structure" },
  { key: "communication", label: "Communication" },
  { key: "technical", label: "Technical" },
  { key: "business", label: "Business" },
  { key: "fit", label: "Fit" }
]

interface SessionSummaryProps {
  open: boolean
  onClose: () => void
  result: SessionResult
}

export function SessionSummary({ open, onClose, result }: SessionSummaryProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!bg-transparent !p-0 !shadow-none w-[min(92vw,620px)]">
        <div className="rounded-2xl bg-paper border border-line shadow-xl overflow-hidden animate-fade-up">
          {/* Header */}
          <div className="relative px-7 pt-7 pb-5 bg-gradient-to-br from-paper to-paper-warm border-b border-line">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-md text-ink-subtle hover:text-ink hover:bg-white/60 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle mb-2">
              <Sparkles size={12} className="text-coral-deep" />
              Session debrief
              {result.durationLabel && (
                <span className="font-mono normal-case tracking-normal text-ink-faint ml-1">
                  · {result.durationLabel}
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-4">
              <h2
                className="font-serif text-[30px] text-ink leading-tight"
                style={{ fontVariationSettings: '"opsz" 144, "SOFT" 60, "wght" 380' }}
              >
                Here's how that landed.
              </h2>
              <ScoreBadge value={result.overall} />
            </div>
          </div>

          {/* Body */}
          <div className="px-7 py-6 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6">
            <div className="flex flex-col items-center">
              <RadarChart scores={result.scores} />
            </div>

            <div className="space-y-5">
              <Column
                tone="positive"
                title="What worked"
                items={result.strengths}
              />
              <Column
                tone="growth"
                title="Sharpen next time"
                items={result.improvements}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-7 py-4 border-t border-line bg-paper-warm/50 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-ink text-paper text-[13px] font-medium hover:bg-coral-deep transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScoreBadge({ value }: { value: number }) {
  const band =
    value >= 80
      ? "Strong"
      : value >= 65
      ? "Solid"
      : value >= 50
      ? "Developing"
      : "Early"
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-[72px] h-[72px]">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r="31" fill="none" stroke="#e8e4d9" strokeWidth="6" />
          <circle
            cx="36"
            cy="36"
            r="31"
            fill="none"
            stroke="#cc785c"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 31}
            strokeDashoffset={2 * Math.PI * 31 * (1 - clamp(value) / 100)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-serif text-[24px] text-ink tabular-nums"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 420' }}
          >
            {Math.round(clamp(value))}
          </span>
        </div>
      </div>
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-coral-deep mt-1">
        {band}
      </span>
    </div>
  )
}

function Column({
  tone,
  title,
  items
}: {
  tone: "positive" | "growth"
  title: string
  items: string[]
}) {
  const dot = tone === "positive" ? "bg-coral" : "bg-ink-subtle"
  return (
    <div>
      <h3 className="text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle mb-2">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint italic">Nothing noted.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[13px] text-ink-soft leading-[1.5]"
            >
              <span className={`w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 ${dot}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Dependency-free radar/spider chart drawn as inline SVG. */
function RadarChart({ scores }: { scores: Scores }) {
  const size = 180
  const c = size / 2
  const maxR = c - 26
  const n = DIMENSIONS.length
  const rings = [0.25, 0.5, 0.75, 1]

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2
  const point = (i: number, r: number) => ({
    x: c + Math.cos(angle(i)) * r,
    y: c + Math.sin(angle(i)) * r
  })

  const valuePoints = DIMENSIONS.map((d, i) =>
    point(i, (clamp(scores[d.key]) / 100) * maxR)
  )
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-[180px] h-[180px]">
      {/* grid rings */}
      {rings.map((rf, ri) => (
        <polygon
          key={ri}
          points={toPath(DIMENSIONS.map((_, i) => point(i, maxR * rf)))}
          fill="none"
          stroke="#e8e4d9"
          strokeWidth="1"
        />
      ))}
      {/* spokes */}
      {DIMENSIONS.map((_, i) => {
        const p = point(i, maxR)
        return (
          <line
            key={i}
            x1={c}
            y1={c}
            x2={p.x}
            y2={p.y}
            stroke="#e8e4d9"
            strokeWidth="1"
          />
        )
      })}
      {/* value polygon */}
      <polygon
        points={toPath(valuePoints)}
        fill="#cc785c"
        fillOpacity="0.16"
        stroke="#cc785c"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {valuePoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#b8694e" />
      ))}
      {/* labels */}
      {DIMENSIONS.map((d, i) => {
        const p = point(i, maxR + 15)
        const anchor =
          Math.abs(p.x - c) < 4 ? "middle" : p.x > c ? "start" : "end"
        return (
          <text
            key={d.key}
            x={p.x}
            y={p.y}
            dy="0.32em"
            textAnchor={anchor}
            className="fill-ink-muted"
            style={{ fontSize: "8.5px", letterSpacing: "0.04em" }}
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}

function clamp(v: number) {
  return Math.max(0, Math.min(100, v || 0))
}
