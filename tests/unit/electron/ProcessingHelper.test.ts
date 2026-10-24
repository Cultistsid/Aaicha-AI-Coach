import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createMockClaude = () => ({
  setBackground: vi.fn(),
  getCurrentModel: vi.fn().mockReturnValue('chat=opus, coach=haiku')
})

vi.mock('@electron/ClaudeHelper', () => ({
  ClaudeHelper: vi.fn().mockImplementation(() => createMockClaude())
}))

vi.mock('@electron/Settings', () => ({
  getBackground: vi.fn().mockReturnValue('Mock resume text')
}))

describe('ProcessingHelper', () => {
  let ProcessingHelper: typeof import('@electron/ProcessingHelper').ProcessingHelper
  let helper: InstanceType<typeof ProcessingHelper>
  let mockAppState: any
  const originalEnv = process.env

  beforeEach(async () => {
    vi.resetModules()
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key' }

    mockAppState = {
      window: null,
      screenshots: null,
      processing: null,
      stt: null
    }

    const mod = await import('@electron/ProcessingHelper')
    ProcessingHelper = mod.ProcessingHelper
    helper = new ProcessingHelper(mockAppState)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('isConfigured', () => {
    it('returns true when API key is set', () => {
      expect(helper.isConfigured()).toBe(true)
    })

    it('returns false when API key is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY
      vi.resetModules()
      const mod = await import('@electron/ProcessingHelper')
      const h = new mod.ProcessingHelper(mockAppState)
      expect(h.isConfigured()).toBe(false)
    })
  })

  describe('getClaude', () => {
    it('lazily initializes Claude helper', () => {
      const claude = helper.getClaude()
      expect(claude).toBeDefined()
      expect(claude.setBackground).toHaveBeenCalledWith('Mock resume text')
    })

    it('returns same instance on subsequent calls', () => {
      const first = helper.getClaude()
      const second = helper.getClaude()
      expect(first).toBe(second)
    })

    it('logs model info on first init', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      helper.getClaude()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ProcessingHelper] Using Claude')
      )
    })
  })

  describe('resetClaude', () => {
    it('clears cached Claude instance', () => {
      const first = helper.getClaude()
      helper.resetClaude()
      const second = helper.getClaude()
      expect(first).not.toBe(second)
    })

    it('allows getClaude after reset', () => {
      helper.getClaude()
      helper.resetClaude()
      expect(() => helper.getClaude()).not.toThrow()
    })
  })

  describe('refreshBackground', () => {
    it('updates background on existing instance', async () => {
      const { getBackground } = await import('@electron/Settings')
      vi.mocked(getBackground).mockReturnValue('Updated resume')

      const claude = helper.getClaude()
      helper.refreshBackground()

      expect(claude.setBackground).toHaveBeenCalledWith('Updated resume')
    })

    it('does nothing if Claude not initialized yet', () => {
      expect(() => helper.refreshBackground()).not.toThrow()
    })
  })

  describe('vestigial methods', () => {
    it('processScreenshots returns immediately', async () => {
      await expect(helper.processScreenshots()).resolves.toBeUndefined()
    })

    it('cancelOngoingRequests does nothing', () => {
      expect(() => helper.cancelOngoingRequests()).not.toThrow()
    })
  })
})
