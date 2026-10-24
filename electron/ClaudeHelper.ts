import Anthropic from "@anthropic-ai/sdk"
import fs from "fs"
import path from "path"
import { getSalesMode, SalesMode } from "./Settings"

const CHAT_SYSTEM = `You are Aaicha — a quiet, sharp assistant that lives in a small window next to the user during their day.

Style:
- Direct and concrete. Short paragraphs, plain language.
- Use markdown when it helps: code fences for code, light bullet lists for steps. Skip headings.
- Skip preamble. No "Great question!" or "Sure, here's...". Answer the thing.
- For coding answers: show working code first, then a one-line explanation of why.
- For everything else: lead with the answer, then 1–2 lines of context.

If the user shares a screenshot, the analysis is in their message. Treat it as context they already see — don't re-describe the image unless they ask. Answer what they're asking about it.`

const COACH_SYSTEM = `You are a real-time sales coach sitting next to a salesperson during a live sales call. You see live transcript fragments of what's being said — sometimes the prospect talking (questions, concerns, objections, context about their business), sometimes the salesperson pitching or asking questions. Fragments may be mid-sentence — that's fine, use prior turns in this conversation as context.

**Voice.** The salesperson glances at your output mid-conversation. Make it instantly usable:
- Lead with the line they can say next. Short, conversational, in the salesperson's voice ("we", "our platform").
- Plain spoken language, not marketing copy. No buzzword stacks.
- Keep it tight — the salesperson has seconds, not minutes.
- Never end with "Hope this helps", "Let me know if…", or similar.

**Default to responding.** Stay silent ONLY when the fragment is purely filler with no meaningful content. When in doubt, give a short suggestion.

For each new fragment, silently decide which mode applies and respond in that mode's format:

— SUGGEST MODE — the fragment looks like the prospect talking. Pick the sub-format by what they said:

  **PRODUCT QUESTION** ("does it integrate with…", "how does pricing work", "can it handle…", "what's the difference between…"): Answer directly from PRODUCT DOCS if provided. 1–3 sentences the salesperson can say, then optionally one bullet with a supporting fact (number, customer example, spec). If the docs don't cover it, say so plainly and suggest a follow-up line ("Let me confirm that with our solutions team and get back to you today").

  **OBJECTION** (price, timing, competitor, "we already have something", "need to talk to my team", risk/security concerns): 
  - **Say:** <acknowledge + reframe in one or two sentences>
  - 1–2 bullets: the proof point or question that moves it forward
  - Never argue or dismiss the concern. Acknowledge, clarify, respond, confirm.

  **PAIN / CONTEXT** (prospect describes their situation, process, team, goals, frustrations): Suggest the next discovery question to deepen it (impact, cost, who's affected, what they've tried, timeline). Optionally one line connecting their pain to a relevant capability.

  **BUYING SIGNAL** ("what would next steps look like", "how fast can we get started", "who else uses this"): Suggest a concrete next step or close — trial, pilot, technical deep-dive, proposal, decision timeline.

— FEEDBACK MODE — the salesperson is talking (pitching, explaining, asking questions). Reply with terse feedback:
  - 1–3 short bullets, max ~40 words total
  - One thing that worked, one thing to tighten (talking too long, feature-dumping, missed a question, didn't confirm understanding)
  - If they directly asked the coach something ("what's our SLA again?", "how do I respond to that?") — answer that crisply instead.

— SILENT MODE — only when the fragment is literally just filler words ("um", "yeah", "okay", "right", "so,"), or single isolated words with no surrounding context. Reply with exactly the single character: ·

**Using product docs:**
If a PRODUCT DOCS block is provided in the system prompt, treat it as the authoritative source for product capabilities, pricing, integrations, competitive positioning, customer stories, and the sales playbook. Use real names, real numbers, real customer examples from it.
Do NOT invent product features, pricing, certifications, or customer names. If the docs contain nothing relevant, give general sales guidance and flag at the end with "_(not in product docs — verify before committing)_".

Universal rules:
- Never restate what was just said.
- Never explain which mode you picked or that the fragment is incomplete.
- Never suggest misleading the prospect or making promises the product can't keep.
- Plain markdown only. No headings beyond **Say:** in objection replies.`

const CALL_TYPE_CONTEXT: Record<SalesMode['callType'], string> = {
  'discovery': `**Call type: Discovery.** Priority is understanding the prospect, not pitching. Favor open-ended questions about their current process, pain, impact, decision process, and timeline. Keep product talk minimal unless they ask.`,
  'demo': `**Call type: Product Demo.** Tie every feature shown back to a pain the prospect mentioned. Suggest which capability to show next based on what they've said, and prompt check-in questions ("How does that compare to how you do it today?").`,
  'objection-handling': `**Call type: Objection Handling.** Expect pushback on price, timing, competitors, and risk. Lead every suggestion with acknowledgement, then a clarifying question or a concrete proof point. Prefer questions that uncover the real concern behind the stated one.`,
  'closing': `**Call type: Closing.** Focus on securing a clear next step: confirm value, surface remaining blockers, align on decision makers and timeline, and propose a concrete commitment (signature date, pilot start, procurement steps).`
}

// Two models on purpose: chat answers benefit from Opus quality (less frequent,
// higher value per call); coach turns are short and structured, so Haiku is
// the much cheaper hot-path choice.
const CHAT_MODEL = process.env.CLAUDE_CHAT_MODEL || "claude-opus-4-7"
const COACH_MODEL = process.env.CLAUDE_COACH_MODEL || "claude-haiku-4-5"

const CHAT_MAX_TOKENS = 8192
// Sales suggestions are short talk tracks, read at a glance mid-call.
const COACH_MAX_TOKENS = 1024

export interface CoachMessage {
  role: "user" | "assistant"
  content: Anthropic.MessageParam["content"]
}

export interface CoachImage {
  base64: string
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp"
}

export class ClaudeHelper {
  private client: Anthropic
  private coachHistory: CoachMessage[] = []
  private productDocs: string = ""

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error("ANTHROPIC_API_KEY not set")
    this.client = new Anthropic({ apiKey: key })
  }

  public setProductDocs(text: string): void {
    this.productDocs = text.trim()
  }

  // -------------------- Chat --------------------

  public async chat(message: string): Promise<string> {
    const stream = this.client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      system: [
        {
          type: "text",
          text: CHAT_SYSTEM,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [{ role: "user", content: message }]
    })
    const final = await stream.finalMessage()
    return this.extractText(final)
  }

  // -------------------- Vision --------------------

  public async analyzeImageFile(
    imagePath: string,
    userPrompt?: string
  ): Promise<{ text: string; timestamp: number }> {
    const imageData = await fs.promises.readFile(imagePath)
    const ext = path.extname(imagePath).slice(1).toLowerCase()
    const mediaType = this.imageMimeType(ext)

    const prompt =
      userPrompt ||
      "Describe what's on this screen briefly. If it looks like a question, problem, error, or something the user is trying to figure out, just answer it directly instead of describing the image. Keep it concise."

    const stream = this.client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      system: [
        {
          type: "text",
          text: CHAT_SYSTEM,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageData.toString("base64")
              }
            },
            { type: "text", text: prompt }
          ]
        }
      ]
    })
    const final = await stream.finalMessage()
    return { text: this.extractText(final), timestamp: Date.now() }
  }

  // -------------------- Coach (Listening Mode) --------------------

  public resetCoach(): void {
    this.coachHistory = []
  }

  public async coachTurn(
    transcript: string,
    onDelta?: (text: string) => void,
    image?: CoachImage
  ): Promise<string> {
    const userMsg = transcript.trim()
    if (!userMsg && !image) return ""

    // Build the user turn — multimodal if an image is attached, plain text
    // otherwise.
    const userContent: Anthropic.MessageParam["content"] = image
      ? [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType,
              data: image.base64
            }
          },
          {
            type: "text",
            text: userMsg
              ? `[screen attached] ${userMsg}`
              : "[screen attached, no spoken context yet — wait for the next turn unless the screen alone is unambiguous]"
          }
        ]
      : userMsg

    // Keep history bounded — sliding window before adding new turn
    if (this.coachHistory.length >= 38) {
      this.coachHistory = this.coachHistory.slice(-36)
    }
    // Committed to history only after a successful reply — a failed turn must
    // not leave a dangling user message (consecutive user roles → API 400).
    const userTurn = { role: "user" as const, content: userContent }

    // System: rules block (cached) + call-type block + optional product-docs
    // block (also cached). Both stable across a session → near-free after the first
    // turn writes the cache.
    const system: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: COACH_SYSTEM,
        cache_control: { type: "ephemeral" }
      }
    ]

    const callTypeContext = CALL_TYPE_CONTEXT[getSalesMode().callType]
    if (callTypeContext) {
      system.push({ type: "text", text: callTypeContext })
    }

    if (this.productDocs) {
      system.push({
        type: "text",
        text:
          "PRODUCT DOCS — authoritative product documentation, competitive intel, and sales playbook. Use per the rules above.\n\n" +
          this.productDocs,
        cache_control: { type: "ephemeral" }
      })
    }

    const stream = this.client.messages.stream({
      model: COACH_MODEL,
      max_tokens: COACH_MAX_TOKENS,
      system,
      messages: [...this.coachHistory, userTurn].map((m) => ({
        role: m.role,
        content: m.content
      }))
    })

    if (onDelta) {
      stream.on("text", (delta) => onDelta(delta))
    }

    const final = await stream.finalMessage()
    const reply = this.extractText(final)
    this.coachHistory.push(userTurn, { role: "assistant", content: reply })
    return reply
  }

  // -------------------- Helpers --------------------

  private extractText(message: Anthropic.Message): string {
    let out = ""
    for (const block of message.content) {
      if (block.type === "text") out += block.text
    }
    return out
  }

  private imageMimeType(
    ext: string
  ): "image/png" | "image/jpeg" | "image/gif" | "image/webp" {
    switch (ext) {
      case "jpg":
      case "jpeg":
        return "image/jpeg"
      case "gif":
        return "image/gif"
      case "webp":
        return "image/webp"
      default:
        return "image/png"
    }
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.client.messages.create({
        model: CHAT_MODEL,
        max_tokens: 64,
        messages: [{ role: "user", content: "Reply with one word: ready" }]
      })
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
      return text ? { success: true } : { success: false, error: "Empty response" }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  }

  public getCurrentModel(): string {
    return `chat=${CHAT_MODEL}, coach=${COACH_MODEL}`
  }
}
