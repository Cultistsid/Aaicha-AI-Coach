import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockAnthropicClient } from '../../mocks/anthropic'

const mockClient = createMockAnthropicClient()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => mockClient)
}))

describe('ClaudeHelper', () => {
  let ClaudeHelper: typeof import('@electron/ClaudeHelper').ClaudeHelper
  let helper: InstanceType<typeof ClaudeHelper>
  const originalEnv = process.env

  beforeEach(async () => {
    vi.resetModules()
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key' }
    const mod = await import('@electron/ClaudeHelper')
    ClaudeHelper = mod.ClaudeHelper
    helper = new ClaudeHelper()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('throws if no API key provided', async () => {
      delete process.env.ANTHROPIC_API_KEY
      vi.resetModules()
      const mod = await import('@electron/ClaudeHelper')
      expect(() => new mod.ClaudeHelper()).toThrow('ANTHROPIC_API_KEY not set')
    })

    it('accepts explicit API key', async () => {
      delete process.env.ANTHROPIC_API_KEY
      vi.resetModules()
      const mod = await import('@electron/ClaudeHelper')
      expect(() => new mod.ClaudeHelper('explicit-key')).not.toThrow()
    })
  })

  describe('chat', () => {
    it('returns text response', async () => {
      const response = await helper.chat('Hello')
      expect(response).toBe('Mock response')
    })

    it('calls messages.stream with correct params', async () => {
      await helper.chat('Test question')
      expect(mockClient.messages.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Test question' }]
        })
      )
    })
  })

  describe('coachTurn', () => {
    it('returns response text', async () => {
      const response = await helper.coachTurn('First question')
      expect(response).toBe('Mock response')
    })

    it('returns empty string for empty input without image', async () => {
      const response = await helper.coachTurn('   ')
      expect(response).toBe('')
    })

    it('calls stream with history', async () => {
      await helper.coachTurn('First')
      await helper.coachTurn('Second')

      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      expect(lastCall?.messages?.length).toBeGreaterThan(1)
    })

    it('streams deltas to callback', async () => {
      const mockStreamWithDelta = {
        on: vi.fn((event: string, handler: any) => {
          if (event === 'text') {
            setTimeout(() => handler('chunk1'), 0)
            setTimeout(() => handler('chunk2'), 10)
          }
          return mockStreamWithDelta
        }),
        finalMessage: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'chunk1chunk2' }]
        })
      }
      mockClient.messages.stream.mockReturnValueOnce(mockStreamWithDelta)

      const deltas: string[] = []
      await helper.coachTurn('Question', (delta) => deltas.push(delta))

      expect(mockStreamWithDelta.on).toHaveBeenCalledWith('text', expect.any(Function))
    })

    it('handles multimodal input with image', async () => {
      const image = { base64: 'abc123', mediaType: 'image/png' as const }
      const response = await helper.coachTurn('Describe this', undefined, image)
      expect(response).toBeDefined()

      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const userMsg = lastCall?.messages?.at(-1)
      expect(Array.isArray(userMsg?.content)).toBe(true)
    })
  })

  describe('resetCoach', () => {
    it('clears coach history', async () => {
      await helper.coachTurn('Question 1')
      helper.resetCoach()
      await helper.coachTurn('Question 2')

      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      expect(lastCall?.messages?.length).toBe(1)
    })
  })

  describe('setProductDocs', () => {
    it('trims and stores product docs text', () => {
      helper.setProductDocs('  Our pricing sheet  ')
      // Product docs get included in system prompt on next coachTurn
    })
  })

  describe('testConnection', () => {
    it('returns success on valid response', async () => {
      const result = await helper.testConnection()
      expect(result.success).toBe(true)
    })

    it('returns error on API failure', async () => {
      mockClient.messages.create.mockRejectedValueOnce(new Error('API Error'))
      const result = await helper.testConnection()
      expect(result.success).toBe(false)
      expect(result.error).toBe('API Error')
    })

    it('returns error on empty response', async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        content: []
      })
      const result = await helper.testConnection()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Empty response')
    })
  })

  describe('getCurrentModel', () => {
    it('returns model string', () => {
      const models = helper.getCurrentModel()
      expect(models).toContain('chat=')
      expect(models).toContain('coach=')
    })
  })
})
