# Aaicha Test Infrastructure Design

## 1. Test Framework Setup

### Package.json Additions

```json
{
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/node": "^22.9.0",
    "@vitest/coverage-v8": "^2.1.0",
    "@vitest/ui": "^2.1.0",
    "electron-playwright-helpers": "^1.7.0",
    "happy-dom": "^15.7.0",
    "msw": "^2.4.0",
    "vitest": "^2.1.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:ai": "vitest run --config vitest.ai.config.ts"
  }
}
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'tests/ai/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'dist-electron/', 'tests/'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    },
    typecheck: {
      enabled: true
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron')
    }
  }
})
```

### tests/setup.ts

```typescript
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { setupServer } from 'msw/node'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock Electron APIs for renderer tests
vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn()
  }
}))

// Global window.electron mock
Object.defineProperty(window, 'electron', {
  value: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  },
  writable: true
})
```

---

## 2. Test Directory Structure

```
tests/
├── setup.ts                    # Global test setup
├── mocks/
│   ├── anthropic.ts            # Claude API mock
│   ├── google-stt.ts           # Google Speech-to-Text mock
│   ├── electron.ts             # Electron IPC mock
│   └── handlers.ts             # MSW request handlers
├── unit/
│   ├── electron/
│   │   ├── ClaudeHelper.test.ts
│   │   ├── STTHelper.test.ts
│   │   ├── Settings.test.ts
│   │   └── ProcessingHelper.test.ts
│   └── lib/
│       └── utils.test.ts
├── components/
│   ├── Chat.test.tsx
│   ├── ListeningMode.test.tsx
│   ├── Setup.test.tsx
│   └── ui/
│       └── Button.test.tsx
├── integration/
│   ├── ipc.test.ts             # IPC handler integration tests
│   └── coach-flow.test.ts      # Full coach turn flow
├── e2e/
│   ├── playwright.config.ts
│   ├── fixtures/
│   │   └── electronApp.ts
│   └── specs/
│       ├── onboarding.spec.ts
│       ├── chat.spec.ts
│       ├── listening-mode.spec.ts
│       └── settings.spec.ts
└── ai/
    ├── vitest.ai.config.ts
    ├── generators/
    │   ├── edge-case-generator.ts
    │   └── coach-response-validator.ts
    ├── fuzz/
    │   └── stt-fuzzer.ts
    └── evaluators/
        └── star-answer-evaluator.ts
```

---

## 3. Mock Implementations

### tests/mocks/anthropic.ts

```typescript
import { vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'

export function createMockAnthropicClient() {
  const mockStream = {
    on: vi.fn().mockReturnThis(),
    finalMessage: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mock response' }]
    })
  }

  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'ready' }]
      }),
      stream: vi.fn().mockReturnValue(mockStream)
    }
  }
}

export function mockStreamingResponse(chunks: string[]) {
  let deltaHandler: ((text: string) => void) | null = null
  
  return {
    on: vi.fn((event: string, handler: any) => {
      if (event === 'text') deltaHandler = handler
      return { on: vi.fn().mockReturnThis(), finalMessage: vi.fn() }
    }),
    finalMessage: vi.fn().mockImplementation(async () => {
      for (const chunk of chunks) {
        deltaHandler?.(chunk)
        await new Promise(r => setTimeout(r, 10))
      }
      return { content: [{ type: 'text', text: chunks.join('') }] }
    })
  }
}
```

### tests/mocks/google-stt.ts

```typescript
import { vi } from 'vitest'
import { EventEmitter } from 'events'

export class MockSpeechClient {
  streamingRecognize = vi.fn(() => {
    const stream = new MockSTTStream()
    return stream
  })
}

export class MockSTTStream extends EventEmitter {
  write = vi.fn()
  end = vi.fn()
  removeAllListeners = vi.fn().mockReturnThis()

  simulateInterim(text: string) {
    this.emit('data', {
      results: [{ alternatives: [{ transcript: text }], isFinal: false }]
    })
  }

  simulateFinal(text: string) {
    this.emit('data', {
      results: [{ alternatives: [{ transcript: text }], isFinal: true }]
    })
  }

  simulateError(message: string) {
    this.emit('error', new Error(message))
  }

  simulateClose() {
    this.emit('close')
  }
}
```

---

## 4. Sample Unit Tests

### tests/unit/electron/ClaudeHelper.test.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeHelper } from '@electron/ClaudeHelper'
import { createMockAnthropicClient, mockStreamingResponse } from '../../mocks/anthropic'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => createMockAnthropicClient())
}))

describe('ClaudeHelper', () => {
  let helper: ClaudeHelper

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    helper = new ClaudeHelper()
  })

  describe('constructor', () => {
    it('throws if no API key provided', () => {
      delete process.env.ANTHROPIC_API_KEY
      expect(() => new ClaudeHelper()).toThrow('ANTHROPIC_API_KEY not set')
    })

    it('accepts explicit API key', () => {
      delete process.env.ANTHROPIC_API_KEY
      expect(() => new ClaudeHelper('explicit-key')).not.toThrow()
    })
  })

  describe('chat', () => {
    it('returns text response', async () => {
      const response = await helper.chat('Hello')
      expect(response).toBe('Mock response')
    })
  })

  describe('coachTurn', () => {
    it('accumulates history across turns', async () => {
      await helper.coachTurn('First question')
      await helper.coachTurn('Follow-up')
      // History should have 4 entries: 2 user + 2 assistant
      // Access via reflection or expose for testing
    })

    it('caps history at 40 messages', async () => {
      for (let i = 0; i < 25; i++) {
        await helper.coachTurn(`Turn ${i}`)
      }
      // Verify history was trimmed
    })

    it('streams deltas to callback', async () => {
      const deltas: string[] = []
      await helper.coachTurn('Question', (delta) => deltas.push(delta))
      // Verify deltas received
    })

    it('handles multimodal input with image', async () => {
      const image = { base64: 'abc123', mediaType: 'image/png' as const }
      const response = await helper.coachTurn('Describe this', undefined, image)
      expect(response).toBeDefined()
    })
  })

  describe('resetCoach', () => {
    it('clears coach history', async () => {
      await helper.coachTurn('Question')
      helper.resetCoach()
      // Next turn should start fresh
    })
  })

  describe('setBackground', () => {
    it('trims and stores background text', () => {
      helper.setBackground('  My resume  ')
      // Background should be trimmed
    })
  })

  describe('testConnection', () => {
    it('returns success on valid response', async () => {
      const result = await helper.testConnection()
      expect(result.success).toBe(true)
    })

    it('returns error on API failure', async () => {
      // Mock API to throw
      const result = await helper.testConnection()
      expect(result.success).toBe(false)
    })
  })
})
```

### tests/unit/electron/STTHelper.test.ts

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { STTHelper } from '@electron/STTHelper'
import { MockSpeechClient, MockSTTStream } from '../../mocks/google-stt'

vi.mock('@google-cloud/speech', () => ({
  SpeechClient: MockSpeechClient
}))

describe('STTHelper', () => {
  let helper: STTHelper
  let mockStream: MockSTTStream

  beforeEach(() => {
    vi.useFakeTimers()
    helper = new STTHelper()
    mockStream = new MockSTTStream()
  })

  afterEach(() => {
    vi.useRealTimers()
    helper.stop()
  })

  describe('start', () => {
    it('emits open status', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()
      expect(events).toContainEqual({ kind: 'status', status: 'open' })
    })

    it('is idempotent when already started', () => {
      helper.start()
      helper.start()
      // Should not create duplicate streams
    })
  })

  describe('event emission', () => {
    it('emits interim transcripts', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()
      mockStream.simulateInterim('testing one two')
      expect(events).toContainEqual({ kind: 'interim', text: 'testing one two' })
    })

    it('emits final transcripts trimmed', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()
      mockStream.simulateFinal('  final answer  ')
      expect(events).toContainEqual({ kind: 'final', text: 'final answer' })
    })
  })

  describe('stream rotation', () => {
    it('rotates stream at 4 minute mark', () => {
      helper.start()
      vi.advanceTimersByTime(4 * 60 * 1000)
      // Should have rotated to new stream
    })
  })

  describe('reconnection', () => {
    it('reconnects after stream error with backoff', () => {
      helper.start()
      mockStream.simulateError('Network error')
      vi.advanceTimersByTime(300) // RESTART_DELAY_MS
      // Should attempt reconnect
    })

    it('increases backoff on consecutive failures', () => {
      helper.start()
      mockStream.simulateError('Error 1')
      vi.advanceTimersByTime(300)
      mockStream.simulateError('Error 2')
      vi.advanceTimersByTime(600) // Should be 2x delay
    })

    it('resets backoff after healthy stream', () => {
      helper.start()
      vi.advanceTimersByTime(5001) // HEALTHY_STREAM_MS + 1
      mockStream.simulateError('Error')
      // Backoff should be reset to base
    })
  })

  describe('stop', () => {
    it('emits closed status', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()
      helper.stop()
      expect(events.pop()).toEqual({ kind: 'status', status: 'closed' })
    })

    it('clears all timers', () => {
      helper.start()
      helper.stop()
      vi.advanceTimersByTime(5 * 60 * 1000)
      // No rotation or restart should occur
    })
  })

  describe('writeAudio', () => {
    it('writes buffer to active stream', () => {
      helper.start()
      const buf = Buffer.from([0, 1, 2, 3])
      helper.writeAudio(buf)
      expect(mockStream.write).toHaveBeenCalledWith(buf)
    })

    it('silently ignores writes when stopped', () => {
      const buf = Buffer.from([0, 1, 2, 3])
      helper.writeAudio(buf) // No stream active
      // Should not throw
    })
  })

  describe('listener management', () => {
    it('returns unsubscribe function', () => {
      const listener = vi.fn()
      const unsub = helper.on(listener)
      helper.start()
      unsub()
      mockStream.simulateFinal('test')
      expect(listener).not.toHaveBeenCalledWith({ kind: 'final', text: 'test' })
    })
  })
})
```

---

## 5. Component Tests

### tests/components/Chat.test.tsx

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Chat from '@/components/chat/Chat'

describe('Chat', () => {
  beforeEach(() => {
    window.electron = {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    }
  })

  it('renders input and send button', () => {
    render(<Chat />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('sends message on submit', async () => {
    window.electron.invoke.mockResolvedValue('AI response')
    render(<Chat />)
    
    await userEvent.type(screen.getByRole('textbox'), 'Hello AI')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    
    expect(window.electron.invoke).toHaveBeenCalledWith('claude:chat', 'Hello AI')
  })

  it('displays AI response', async () => {
    window.electron.invoke.mockResolvedValue('Here is my response')
    render(<Chat />)
    
    await userEvent.type(screen.getByRole('textbox'), 'Question')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    
    await waitFor(() => {
      expect(screen.getByText('Here is my response')).toBeInTheDocument()
    })
  })

  it('shows loading state while waiting', async () => {
    window.electron.invoke.mockImplementation(
      () => new Promise(r => setTimeout(() => r('Response'), 100))
    )
    render(<Chat />)
    
    await userEvent.type(screen.getByRole('textbox'), 'Question')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    
    expect(screen.getByText(/loading|thinking/i)).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    window.electron.invoke.mockRejectedValue(new Error('API Error'))
    render(<Chat />)
    
    await userEvent.type(screen.getByRole('textbox'), 'Question')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })
})
```

---

## 6. E2E with Playwright

### tests/e2e/playwright.config.ts

```typescript
import { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: './specs',
  timeout: 60000,
  retries: 1,
  workers: 1, // Electron tests must be serial
  use: {
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  reporter: [['html', { open: 'never' }], ['list']]
}

export default config
```

### tests/e2e/fixtures/electronApp.ts

```typescript
import { test as base, ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'path'

type Fixtures = {
  electronApp: ElectronApplication
  mainPage: Page
}

export const test = base.extend<Fixtures>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.join(__dirname, '../../../dist-electron/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ANTHROPIC_API_KEY: process.env.TEST_ANTHROPIC_KEY || 'test-key',
        GOOGLE_APPLICATION_CREDENTIALS: process.env.TEST_GOOGLE_CREDS || ''
      }
    })
    await use(app)
    await app.close()
  },

  mainPage: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  }
})

export { expect } from '@playwright/test'
```

### tests/e2e/specs/listening-mode.spec.ts

```typescript
import { test, expect } from '../fixtures/electronApp'

test.describe('Listening Mode', () => {
  test('starts and stops listening session', async ({ mainPage }) => {
    // Navigate to listening mode
    await mainPage.click('[data-testid="listening-mode-tab"]')
    
    // Start listening
    await mainPage.click('[data-testid="start-listening"]')
    await expect(mainPage.locator('[data-testid="listening-indicator"]')).toBeVisible()
    
    // Stop listening
    await mainPage.click('[data-testid="stop-listening"]')
    await expect(mainPage.locator('[data-testid="listening-indicator"]')).not.toBeVisible()
  })

  test('displays real-time transcript', async ({ mainPage }) => {
    await mainPage.click('[data-testid="listening-mode-tab"]')
    await mainPage.click('[data-testid="start-listening"]')
    
    // Simulate audio input (requires mock or actual mic)
    // For real tests, use a test audio file
    
    await expect(mainPage.locator('[data-testid="transcript"]')).toContainText(/.+/)
  })

  test('shows coach response with streaming', async ({ mainPage }) => {
    await mainPage.click('[data-testid="listening-mode-tab"]')
    await mainPage.click('[data-testid="start-listening"]')
    
    // Wait for coach response area
    await expect(mainPage.locator('[data-testid="coach-response"]')).toBeVisible()
  })
})
```

---

## 7. AI-Assisted Testing with Opus 5.5

### tests/ai/generators/edge-case-generator.ts

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface EdgeCase {
  input: string
  expectedBehavior: string
  category: 'boundary' | 'malformed' | 'unicode' | 'injection' | 'timing'
}

export async function generateEdgeCases(
  componentDescription: string,
  inputSchema: string,
  count: number = 10
): Promise<EdgeCase[]> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 4096,
    system: `You are a senior QA engineer specializing in edge case generation.
Generate edge cases that are:
1. Realistic (could happen in production)
2. Diverse (cover different failure modes)
3. Testable (clear expected behavior)

Output JSON array of EdgeCase objects.`,
    messages: [{
      role: 'user',
      content: `Generate ${count} edge cases for:

Component: ${componentDescription}
Input Schema: ${inputSchema}

Categories to cover:
- boundary: min/max values, empty inputs, single elements
- malformed: invalid types, missing fields, extra fields
- unicode: emoji, RTL text, zero-width chars, combining chars
- injection: script tags, SQL-like strings, shell metacharacters
- timing: rapid inputs, delayed responses, concurrent operations`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]')
}

// Usage example for STTHelper
export async function generateSTTEdgeCases(): Promise<EdgeCase[]> {
  return generateEdgeCases(
    'Speech-to-text helper that processes audio buffers and emits transcript events',
    `{
      input: Buffer (PCM 16-bit, 16kHz),
      events: 'interim' | 'final' | 'status',
      methods: start(), stop(), writeAudio(buf)
    }`,
    15
  )
}
```

### tests/ai/evaluators/coach-response-validator.ts

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface ValidationResult {
  valid: boolean
  score: number // 0-100
  issues: string[]
  suggestions: string[]
}

export async function validateCoachResponse(
  interviewQuestion: string,
  coachResponse: string,
  candidateBackground?: string
): Promise<ValidationResult> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 2048,
    system: `You are evaluating interview coaching responses for quality.

Score on these criteria (0-100 total):
1. Authenticity (25pts): Does it sound like a human candidate, not AI?
2. Relevance (25pts): Does it answer the actual question?
3. Conciseness (20pts): Is it appropriately brief for live delivery?
4. Technical accuracy (15pts): For coding questions, is the solution correct?
5. STAR compliance (15pts): For behavioral, does it follow STAR format?

Red flags that should fail validation:
- Type hints in Python code
- Docstrings or "Solution" class wrappers
- Bulleted lists for code explanations (should be spoken)
- Closers like "Does that make sense?" or "Let me know if..."
- Over-engineered variable names like "frequency_map"

Output JSON: { valid: boolean, score: number, issues: string[], suggestions: string[] }`,
    messages: [{
      role: 'user',
      content: `Interview Question: ${interviewQuestion}

Coach Response:
${coachResponse}

${candidateBackground ? `Candidate Background:\n${candidateBackground}` : ''}`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{"valid":false,"score":0,"issues":["Parse error"],"suggestions":[]}')
}

// Batch validation for regression testing
export async function validateCoachResponseBatch(
  testCases: Array<{ question: string; response: string; background?: string }>
): Promise<Map<number, ValidationResult>> {
  const results = new Map<number, ValidationResult>()
  
  // Process in parallel with rate limiting
  const batchSize = 5
  for (let i = 0; i < testCases.length; i += batchSize) {
    const batch = testCases.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(tc => validateCoachResponse(tc.question, tc.response, tc.background))
    )
    batchResults.forEach((result, idx) => results.set(i + idx, result))
  }
  
  return results
}
```

### tests/ai/evaluators/star-answer-evaluator.ts

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface STARScore {
  situation: { present: boolean; score: number; feedback: string }
  task: { present: boolean; score: number; feedback: string }
  action: { present: boolean; score: number; feedback: string }
  result: { present: boolean; score: number; feedback: string }
  overall: number
  improvements: string[]
}

export async function evaluateSTARAnswer(
  question: string,
  answer: string
): Promise<STARScore> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 2048,
    system: `You evaluate behavioral interview answers using the STAR method.

For each STAR component, assess:
- present: Is this component clearly identifiable?
- score: 0-25 points based on clarity, specificity, and impact
- feedback: One sentence of actionable feedback

Good STAR answers:
- Use specific names, numbers, dates, outcomes
- Keep Situation/Task brief (20% of answer)
- Expand on Actions (50% of answer)
- Quantify Results where possible

Output JSON matching the STARScore interface.`,
    messages: [{
      role: 'user',
      content: `Question: ${question}

Answer: ${answer}`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')
}
```

### tests/ai/fuzz/stt-fuzzer.ts

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { STTHelper, STTEvent } from '@electron/STTHelper'

const client = new Anthropic()

interface FuzzScenario {
  name: string
  audioPattern: 'silence' | 'noise' | 'rapid-speech' | 'slow-speech' | 'mixed'
  duration: number
  expectedBehavior: string
}

export async function generateFuzzScenarios(): Promise<FuzzScenario[]> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 2048,
    system: `Generate fuzz testing scenarios for a speech-to-text system.
Focus on:
- Audio edge cases (silence, noise, overlapping speech)
- Timing edge cases (very fast, very slow, pauses)
- Stream management (reconnects, rotation during speech)
- Resource limits (long sessions, memory pressure)

Output JSON array of FuzzScenario objects.`,
    messages: [{ role: 'user', content: 'Generate 10 fuzz scenarios for STT pipeline' }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]')
}

// Synthetic audio generator for fuzz testing
export function generateSyntheticAudio(pattern: FuzzScenario['audioPattern'], durationMs: number): Buffer {
  const sampleRate = 16000
  const samples = Math.floor((durationMs / 1000) * sampleRate)
  const buf = Buffer.alloc(samples * 2) // 16-bit PCM

  for (let i = 0; i < samples; i++) {
    let value: number
    switch (pattern) {
      case 'silence':
        value = 0
        break
      case 'noise':
        value = Math.floor(Math.random() * 65536) - 32768
        break
      case 'rapid-speech':
        value = Math.sin(i * 0.1) * 16000 + (Math.random() - 0.5) * 4000
        break
      case 'slow-speech':
        value = Math.sin(i * 0.01) * 8000
        break
      case 'mixed':
        value = i % 1000 < 500 ? 0 : Math.sin(i * 0.05) * 12000
        break
    }
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.floor(value))), i * 2)
  }

  return buf
}

// Run fuzz test
export async function runSTTFuzz(scenario: FuzzScenario): Promise<{
  passed: boolean
  events: STTEvent[]
  errors: string[]
}> {
  const helper = new STTHelper()
  const events: STTEvent[] = []
  const errors: string[] = []

  helper.on((event) => {
    events.push(event)
    if (event.kind === 'status' && event.status === 'error') {
      errors.push(event.message || 'Unknown error')
    }
  })

  try {
    helper.start()
    
    const audio = generateSyntheticAudio(scenario.audioPattern, scenario.duration)
    const chunkSize = 1600 // 100ms chunks
    
    for (let i = 0; i < audio.length; i += chunkSize) {
      helper.writeAudio(audio.subarray(i, i + chunkSize))
      await new Promise(r => setTimeout(r, 50))
    }

    await new Promise(r => setTimeout(r, 1000))
    helper.stop()

    return {
      passed: errors.length === 0 || scenario.expectedBehavior.includes('recover'),
      events,
      errors
    }
  } catch (err: any) {
    return { passed: false, events, errors: [err.message] }
  }
}
```

---

## 8. CI/CD Integration

### .github/workflows/test.yml

```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: true

  component-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run component tests
        run: npm run test -- --testPathPattern=components

  e2e-tests:
    runs-on: macos-latest # Electron needs actual display
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build app
        run: npm run build
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          TEST_ANTHROPIC_KEY: ${{ secrets.TEST_ANTHROPIC_KEY }}
      
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: tests/e2e/playwright-report/

  ai-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run AI-assisted tests
        run: npm run test:ai
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 9. Coverage Thresholds

| Category | Target | Rationale |
|----------|--------|-----------|
| Lines | 70% | Core logic coverage |
| Functions | 70% | All public methods tested |
| Branches | 60% | Key decision paths |
| Statements | 70% | Executable code coverage |

Critical paths requiring 90%+ coverage:
- `ClaudeHelper.coachTurn()` - Core coach loop
- `STTHelper.openStream()` - Stream lifecycle
- `STTHelper.scheduleRestart()` - Reconnection logic
- `ipcHandlers.ts` - All IPC channels

---

## 10. Visual Regression (Optional)

### Using Percy or Playwright screenshots

```typescript
// tests/e2e/specs/visual.spec.ts
import { test, expect } from '../fixtures/electronApp'

test.describe('Visual Regression', () => {
  test('chat interface matches snapshot', async ({ mainPage }) => {
    await mainPage.click('[data-testid="chat-tab"]')
    await expect(mainPage).toHaveScreenshot('chat-empty.png')
  })

  test('listening mode matches snapshot', async ({ mainPage }) => {
    await mainPage.click('[data-testid="listening-mode-tab"]')
    await expect(mainPage).toHaveScreenshot('listening-idle.png')
  })

  test('settings dialog matches snapshot', async ({ mainPage }) => {
    await mainPage.click('[data-testid="settings-button"]')
    await expect(mainPage.locator('[data-testid="settings-dialog"]')).toHaveScreenshot('settings.png')
  })
})
```

---

## Summary

This infrastructure provides:

1. **Unit tests** with Vitest for `ClaudeHelper`, `STTHelper`, and utilities
2. **Component tests** with React Testing Library for UI components
3. **Integration tests** for IPC handlers and coach flow
4. **E2E tests** with Playwright for full Electron app flows
5. **AI-assisted testing** using Opus 5.5 for:
   - Edge case generation
   - Coach response quality validation
   - STAR answer evaluation
   - STT pipeline fuzzing
6. **CI/CD** with GitHub Actions, coverage reporting, and artifact uploads

The AI testing layer is optional but powerful — it catches quality issues that static tests miss (e.g., coach responses that "sound AI-generated") and generates test cases humans wouldn't think of.
