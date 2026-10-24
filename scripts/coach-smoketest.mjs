// Hits the real Anthropic API with the current COACH_SYSTEM prompt from
// electron/ClaudeHelper.ts and replays the RandomizedSet mock-interview
// transcript so we can eyeball the "is this code suspiciously clean?" fix.
//
// Usage: node scripts/coach-smoketest.mjs

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import Anthropic from "@anthropic-ai/sdk"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
// Try Application Support first (live key for installed builds), fall back
// to repo-root .env. dotenv won't override already-set vars by default.
dotenv.config({
  path: path.join(
    process.env.HOME,
    "Library/Application Support/Aaicha/.env"
  )
})
dotenv.config({ path: path.join(root, ".env") })

// Extract COACH_SYSTEM verbatim from the source so the test always matches
// what ships.
const src = fs.readFileSync(
  path.join(root, "electron/ClaudeHelper.ts"),
  "utf8"
)
const m = src.match(/const COACH_SYSTEM = `([\s\S]*?)`\n/)
if (!m) throw new Error("Could not find COACH_SYSTEM in ClaudeHelper.ts")
const COACH_SYSTEM = m[1]
  // Un-escape what TS template literals interpret.
  .replace(/\\`/g, "`")
  .replace(/\\\$/g, "$")

const COACH_MODEL = process.env.CLAUDE_COACH_MODEL || "claude-haiku-4-5"

// Mock-interview transcript, broken into the same fragments the coach saw
// live. Each entry is a single user-turn fragment.
const fragments = [
  "Okay, so this is the question I want you to design a class that supports these three operations. So the first operation is inserting a value. And you can assume that there's no duplicates allowed, so you might be given a duplicate, but you don't want to actually store the duplicate. The second thing is removing a value from this class and where it gets interesting is I want you to be able to get a random value that is already inserted. And Among The Valleys that are inserted, I want it to be of equal probability. So just these three operations.",
  "Why is that the case?",
  "Because it could be in on average will not be constant times. Since if it's in the middle of the array, we have to move all the elements at the end and like, pushed him back.",
  "Yeah, that's true. Is there any case where we're moving from? An array actually, is constant time.",
  "Oh, if it's at the end of the array, it'll be constant. So If that's the case. Wait, what is that? Tell me."
]

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const history = []

for (let i = 0; i < fragments.length; i++) {
  const frag = fragments[i]
  history.push({ role: "user", content: frag })

  process.stdout.write(`\n\n===== TURN ${i + 1} =====\n`)
  process.stdout.write(`USER: ${frag}\n\n`)
  process.stdout.write(`COACH: `)

  const stream = client.messages.stream({
    model: COACH_MODEL,
    max_tokens: 2500,
    system: [{ type: "text", text: COACH_SYSTEM }],
    messages: history
  })

  let reply = ""
  stream.on("text", (t) => {
    reply += t
    process.stdout.write(t)
  })
  await stream.finalMessage()
  history.push({ role: "assistant", content: reply })
}

process.stdout.write("\n\n===== DONE =====\n")
