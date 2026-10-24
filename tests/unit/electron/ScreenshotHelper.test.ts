import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userdata')
  }
}))

vi.mock('screenshot-desktop', () => ({
  default: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    promises: {
      unlink: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data'))
    }
  }
}))

describe('ScreenshotHelper', () => {
  let ScreenshotHelper: typeof import('@electron/ScreenshotHelper').ScreenshotHelper
  let helper: InstanceType<typeof ScreenshotHelper>
  let screenshot: any

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    const screenshotMod = await import('screenshot-desktop')
    screenshot = screenshotMod.default

    const mod = await import('@electron/ScreenshotHelper')
    ScreenshotHelper = mod.ScreenshotHelper
    helper = new ScreenshotHelper()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('creates screenshot directories if missing', () => {
      // Default mock has existsSync return false
      expect(helper.getScreenshotQueue()).toBeDefined()
      expect(helper.getExtraScreenshotQueue()).toBeDefined()
    })

    it('skips directory creation if they exist', async () => {
      vi.clearAllMocks()
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.resetModules()
      const mod = await import('@electron/ScreenshotHelper')
      new mod.ScreenshotHelper()

      expect(fs.mkdirSync).not.toHaveBeenCalled()
    })

    it('accepts view parameter', async () => {
      vi.resetModules()
      const mod = await import('@electron/ScreenshotHelper')
      const h = new mod.ScreenshotHelper('solutions')
      expect(h.getView()).toBe('solutions')
    })
  })

  describe('view management', () => {
    it('defaults to queue view', () => {
      expect(helper.getView()).toBe('queue')
    })

    it('allows changing view', () => {
      helper.setView('solutions')
      expect(helper.getView()).toBe('solutions')
    })
  })

  describe('takeScreenshot', () => {
    const mockHide = vi.fn()
    const mockShow = vi.fn()

    beforeEach(() => {
      vi.mocked(screenshot).mockResolvedValue(undefined)
    })

    it('hides window before capture and shows after', async () => {
      await helper.takeScreenshot(mockHide, mockShow)

      expect(mockHide).toHaveBeenCalled()
      expect(mockShow).toHaveBeenCalled()
    })

    it('adds to queue view by default', async () => {
      const screenshotPath = await helper.takeScreenshot(mockHide, mockShow)

      expect(screenshotPath).toContain('screenshots')
      expect(helper.getScreenshotQueue()).toHaveLength(1)
      expect(helper.getExtraScreenshotQueue()).toHaveLength(0)
    })

    it('adds to extra queue when in solutions view', async () => {
      helper.setView('solutions')
      const screenshotPath = await helper.takeScreenshot(mockHide, mockShow)

      expect(screenshotPath).toContain('extra_screenshots')
      expect(helper.getScreenshotQueue()).toHaveLength(0)
      expect(helper.getExtraScreenshotQueue()).toHaveLength(1)
    })

    it('enforces MAX_SCREENSHOTS limit', async () => {
      // Take 6 screenshots (max is 5)
      for (let i = 0; i < 6; i++) {
        await helper.takeScreenshot(mockHide, mockShow)
      }

      expect(helper.getScreenshotQueue()).toHaveLength(5)
      expect(fs.promises.unlink).toHaveBeenCalled()
    })

    it('ensures window shows even on error', async () => {
      vi.mocked(screenshot).mockRejectedValueOnce(new Error('Capture failed'))

      await expect(
        helper.takeScreenshot(mockHide, mockShow)
      ).rejects.toThrow('Failed to take screenshot')

      expect(mockShow).toHaveBeenCalled()
    })

    it('waits 100ms after hiding window', async () => {
      const startTime = Date.now()
      await helper.takeScreenshot(mockHide, mockShow)
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(90) // Allow some timing tolerance
    })
  })

  describe('clearQueues', () => {
    it('deletes all screenshots from both queues', async () => {
      // Add some screenshots
      await helper.takeScreenshot(vi.fn(), vi.fn())
      helper.setView('solutions')
      await helper.takeScreenshot(vi.fn(), vi.fn())

      await helper.clearQueues()

      expect(helper.getScreenshotQueue()).toHaveLength(0)
      expect(helper.getExtraScreenshotQueue()).toHaveLength(0)
    })

    it('handles deletion errors gracefully', async () => {
      vi.mocked(fs.promises.unlink).mockRejectedValueOnce(new Error('ENOENT'))

      await helper.takeScreenshot(vi.fn(), vi.fn())
      await expect(helper.clearQueues()).resolves.toBeUndefined()
    })
  })

  describe('getImagePreview', () => {
    it('returns base64 data URI', async () => {
      const preview = await helper.getImagePreview('/path/to/image.png')

      expect(preview).toMatch(/^data:image\/png;base64,/)
      expect(fs.promises.readFile).toHaveBeenCalledWith('/path/to/image.png')
    })

    it('propagates read errors', async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('ENOENT'))

      await expect(
        helper.getImagePreview('/missing.png')
      ).rejects.toThrow()
    })
  })

  describe('deleteScreenshot', () => {
    it('removes from queue and filesystem', async () => {
      const path = await helper.takeScreenshot(vi.fn(), vi.fn())
      const result = await helper.deleteScreenshot(path)

      expect(result.success).toBe(true)
      expect(helper.getScreenshotQueue()).toHaveLength(0)
      expect(fs.promises.unlink).toHaveBeenCalledWith(path)
    })

    it('removes from extra queue when in solutions view', async () => {
      helper.setView('solutions')
      const path = await helper.takeScreenshot(vi.fn(), vi.fn())

      const result = await helper.deleteScreenshot(path)

      expect(result.success).toBe(true)
      expect(helper.getExtraScreenshotQueue()).toHaveLength(0)
    })

    it('returns error on deletion failure', async () => {
      vi.mocked(fs.promises.unlink).mockRejectedValueOnce(new Error('EPERM'))

      const path = await helper.takeScreenshot(vi.fn(), vi.fn())
      const result = await helper.deleteScreenshot(path)

      expect(result.success).toBe(false)
      expect(result.error).toBe('EPERM')
    })

    it('handles non-existent paths', async () => {
      vi.mocked(fs.promises.unlink).mockRejectedValueOnce(new Error('ENOENT: no such file'))
      const result = await helper.deleteScreenshot('/nonexistent.png')
      expect(result.success).toBe(false)
      expect(result.error).toContain('ENOENT')
    })
  })
})
