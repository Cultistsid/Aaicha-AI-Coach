import { app } from "electron"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"

export interface AaichaSettings {
  anthropicApiKey?: string
  googleCloudProject?: string
  googleCloudLocation?: string
  claudeChatModel?: string
  claudeCoachModel?: string
}

export interface InterviewMode {
  type: 'case' | 'technical' | 'behavioral' | 'mixed'
  persona: 'partner' | 'manager' | 'senior-consultant'
  difficulty: 'intern' | 'analyst' | 'senior-analyst'
  company: 'deloitte' | 'generic'
}

const DEFAULT_INTERVIEW_MODE: InterviewMode = {
  type: 'mixed',
  persona: 'manager',
  difficulty: 'analyst',
  company: 'generic'
}

let currentInterviewMode: InterviewMode = { ...DEFAULT_INTERVIEW_MODE }

export function getInterviewMode(): InterviewMode {
  return { ...currentInterviewMode }
}

export function setInterviewMode(mode: InterviewMode): void {
  currentInterviewMode = { ...mode }
}

export function userEnvPath(): string {
  return path.join(app.getPath("userData"), ".env")
}

export function backgroundPath(): string {
  return path.join(app.getPath("userData"), "background.txt")
}

export function getBackground(): string {
  const p = backgroundPath()
  if (!fs.existsSync(p)) return ""
  try {
    return fs.readFileSync(p, "utf8")
  } catch {
    return ""
  }
}

export function saveBackground(text: string): void {
  const p = backgroundPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const trimmed = text.trim()
  if (!trimmed) {
    if (fs.existsSync(p)) fs.unlinkSync(p)
    return
  }
  fs.writeFileSync(p, trimmed + "\n", { mode: 0o600 })
}

// Called once at app start. Repo-root .env loads first (dev/scripted runs),
// then userData/.env overrides so an installed-app user can keep their keys
// in ~/Library/Application Support/Aaicha/.env without touching the bundle.
export function loadEnv(): void {
  const devPath = path.resolve(process.cwd(), ".env")
  if (fs.existsSync(devPath)) {
    dotenv.config({ path: devPath })
  }
  const userPath = userEnvPath()
  if (fs.existsSync(userPath)) {
    dotenv.config({ path: userPath, override: true })
  }
}

// The API key never crosses IPC — the renderer only learns whether one is set.
export function getSettings(): {
  configured: boolean
  settings: Omit<AaichaSettings, "anthropicApiKey">
  envPath: string
} {
  return {
    configured: !!process.env.ANTHROPIC_API_KEY,
    envPath: userEnvPath(),
    settings: {
      googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
      googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION,
      claudeChatModel: process.env.CLAUDE_CHAT_MODEL,
      claudeCoachModel: process.env.CLAUDE_COACH_MODEL
    }
  }
}

const FIELDS: Array<[keyof AaichaSettings, string]> = [
  ["anthropicApiKey", "ANTHROPIC_API_KEY"],
  ["googleCloudProject", "GOOGLE_CLOUD_PROJECT"],
  ["googleCloudLocation", "GOOGLE_CLOUD_LOCATION"],
  ["claudeChatModel", "CLAUDE_CHAT_MODEL"],
  ["claudeCoachModel", "CLAUDE_COACH_MODEL"]
]

export function saveSettings(input: AaichaSettings): void {
  // Blank key field means "keep the saved key" since the renderer never sees it.
  const s: AaichaSettings = {
    ...input,
    anthropicApiKey: input.anthropicApiKey?.trim() || process.env.ANTHROPIC_API_KEY
  }
  const userPath = userEnvPath()
  fs.mkdirSync(path.dirname(userPath), { recursive: true })

  const lines: string[] = ["# Written by Aaicha settings panel"]
  for (const [key, envName] of FIELDS) {
    const value = s[key]
    if (value && value.trim()) {
      // Sanitize: remove newlines/carriage returns to prevent .env corruption
      const sanitized = value.trim().replace(/[\r\n]/g, "")
      lines.push(`${envName}=${sanitized}`)
    }
  }
  fs.writeFileSync(userPath, lines.join("\n") + "\n", { mode: 0o600 })

  // Update live process.env so the rest of main sees the new values immediately.
  for (const [key, envName] of FIELDS) {
    const value = s[key]
    if (value && value.trim()) {
      process.env[envName] = value.trim()
    } else {
      delete process.env[envName]
    }
  }
}
