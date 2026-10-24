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

  describe('analyzeImageFile (vision)', () => {
    beforeEach(() => {
      vi.mock('fs', () => ({
        default: {
          promises: {
            readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data'))
          }
        }
      }))
    })

    it('analyzes image with default prompt', async () => {
      const result = await helper.analyzeImageFile('/path/to/screen.png')

      expect(result.text).toBe('Mock response')
      expect(result.timestamp).toBeGreaterThan(0)
    })

    it('analyzes image with custom prompt', async () => {
      const result = await helper.analyzeImageFile(
        '/path/to/screen.png',
        'What error do you see?'
      )

      expect(result.text).toBeDefined()
      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const userMsg = lastCall?.messages?.[0]
      expect(Array.isArray(userMsg?.content)).toBe(true)
    })

    it('infers MIME type from file extension', async () => {
      await helper.analyzeImageFile('/screen.jpg')
      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const content = lastCall?.messages?.[0]?.content as any[]
      expect(content?.[0]?.source?.media_type).toBe('image/jpeg')
    })

    it('handles .jpeg extension', async () => {
      await helper.analyzeImageFile('/screen.jpeg')
      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const content = lastCall?.messages?.[0]?.content as any[]
      expect(content?.[0]?.source?.media_type).toBe('image/jpeg')
    })

    it('handles .gif extension', async () => {
      await helper.analyzeImageFile('/screen.gif')
      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const content = lastCall?.messages?.[0]?.content as any[]
      expect(content?.[0]?.source?.media_type).toBe('image/gif')
    })

    it('handles .webp extension', async () => {
      await helper.analyzeImageFile('/screen.webp')
      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const content = lastCall?.messages?.[0]?.content as any[]
      expect(content?.[0]?.source?.media_type).toBe('image/webp')
    })

    it('defaults to image/png for unknown extensions', async () => {
      await helper.analyzeImageFile('/screen.bmp')
      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const content = lastCall?.messages?.[0]?.content as any[]
      expect(content?.[0]?.source?.media_type).toBe('image/png')
    })
  })

  describe('coach history trimming', () => {
    it('trims history when it exceeds 38 messages', async () => {
      // Add 40 turns (80 messages: user + assistant each)
      for (let i = 0; i < 40; i++) {
        await helper.coachTurn(`Question ${i}`)
      }

      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const messageCount = lastCall?.messages?.length ?? 0
      expect(messageCount).toBeLessThanOrEqual(38)
    })

    it('keeps recent messages when trimming', async () => {
      for (let i = 0; i < 40; i++) {
        await helper.coachTurn(`Turn ${i}`)
      }

      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const messages = lastCall?.messages ?? []
      const lastUserMsg = messages.at(-1) as any
      expect(lastUserMsg?.content).toContain('Turn 39')
    })
  })

  describe('sales call type integration', () => {
    beforeEach(() => {
      vi.mock('@electron/Settings', () => ({
        getSalesMode: vi.fn().mockReturnValue({ callType: 'objection-handling' })
      }))
    })

    // The selected call type must steer the coach, or switching modes in the
    // UI would silently do nothing.
    it('injects the selected call-type guidance into the system prompt', async () => {
      await helper.coachTurn('That price seems high')

      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const systemBlocks = lastCall?.system ?? []
      const hasCallType = systemBlocks.some(
        (block: any) => block.text?.includes('Call type: Objection Handling')
      )
      expect(hasCallType).toBe(true)
    })
  })

  describe('product docs injection', () => {
    // Suggestions must be grounded in the user's real product facts, not invented.
    it('includes product docs in system prompt when set', async () => {
      helper.setProductDocs('Enterprise plan is $40/seat/month')
      await helper.coachTurn('How much does it cost?')

      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const systemBlocks = lastCall?.system ?? []
      const hasDocs = systemBlocks.some(
        (block: any) => block.text?.includes('$40/seat/month')
      )
      expect(hasDocs).toBe(true)
    })

    it('omits product docs block when not set', async () => {
      const freshHelper = new ClaudeHelper()
      await freshHelper.coachTurn('Question without docs')

      const lastCall = mockClient.messages.stream.mock.calls.at(-1)?.[0]
      const systemBlocks = lastCall?.system ?? []
      const docsBlocks = systemBlocks.filter(
        (block: any) => block.text?.includes('PRODUCT DOCS —')
      )
      expect(docsBlocks.length).toBe(0)
    })
  })

  describe('error handling', () => {
    it('handles stream errors in coachTurn', async () => {
      const mockErrorStream = {
        on: vi.fn((event: string) => mockErrorStream),
        finalMessage: vi.fn().mockRejectedValue(new Error('Stream failed'))
      }
      mockClient.messages.stream.mockReturnValueOnce(mockErrorStream)

      await expect(helper.coachTurn('Test')).rejects.toThrow('Stream failed')
    })

    it('handles empty API responses gracefully', async () => {
      mockClient.messages.stream.mockReturnValueOnce({
        on: vi.fn().mockReturnThis(),
        finalMessage: vi.fn().mockResolvedValue({ content: [] })
      })

      const result = await helper.coachTurn('Test')
      expect(result).toBe('')
    })

    it('extracts text from mixed content blocks', async () => {
      mockClient.messages.stream.mockReturnValueOnce({
        on: vi.fn().mockReturnThis(),
        finalMessage: vi.fn().mockResolvedValue({
          content: [
            { type: 'text', text: 'Part 1 ' },
            { type: 'thinking', text: 'internal thought' },
            { type: 'text', text: 'Part 2' }
          ]
        })
      })

      const result = await helper.coachTurn('Test')
      expect(result).toBe('Part 1 Part 2')
    })
  })
})
