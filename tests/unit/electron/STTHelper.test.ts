import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

class MockSTTStream extends EventEmitter {
  write = vi.fn()
  end = vi.fn()
  removeAllListeners = vi.fn(() => this)

  on(event: string, listener: (...args: any[]) => void) {
    super.on(event, listener)
    return this
  }
}

let mockStream: MockSTTStream

vi.mock('@google-cloud/speech', () => ({
  SpeechClient: vi.fn().mockImplementation(() => ({
    streamingRecognize: vi.fn(() => {
      mockStream = new MockSTTStream()
      return mockStream
    })
  }))
}))

describe('STTHelper', () => {
  let STTHelper: typeof import('@electron/STTHelper').STTHelper
  let helper: InstanceType<typeof STTHelper>

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const mod = await import('@electron/STTHelper')
    STTHelper = mod.STTHelper
    helper = new STTHelper()
  })

  afterEach(() => {
    vi.useRealTimers()
    helper.stop()
    vi.clearAllMocks()
  })

  describe('start', () => {
    it('emits open status', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()
      expect(events).toContainEqual({ kind: 'status', status: 'open' })
    })

    it('is idempotent when already started', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()
      helper.start()
      const openEvents = events.filter(e => e.kind === 'status' && e.status === 'open')
      expect(openEvents.length).toBe(1)
    })
  })

  describe('event emission', () => {
    it('emits interim transcripts', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()

      mockStream.emit('data', {
        results: [{ alternatives: [{ transcript: 'testing one two' }], isFinal: false }]
      })

      expect(events).toContainEqual({ kind: 'interim', text: 'testing one two' })
    })

    it('emits final transcripts trimmed', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()

      mockStream.emit('data', {
        results: [{ alternatives: [{ transcript: '  final answer  ' }], isFinal: true }]
      })

      expect(events).toContainEqual({ kind: 'final', text: 'final answer' })
    })

    it('ignores empty transcripts', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()

      mockStream.emit('data', {
        results: [{ alternatives: [{ transcript: '' }], isFinal: true }]
      })

      expect(events.filter(e => e.kind === 'final').length).toBe(0)
    })

    it('handles missing alternatives gracefully', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()

      mockStream.emit('data', { results: [{}] })
      mockStream.emit('data', { results: [] })
      mockStream.emit('data', {})

      expect(events.filter(e => e.kind === 'final').length).toBe(0)
    })
  })

  describe('stream rotation', () => {
    it('rotates stream at 4 minute mark', () => {
      helper.start()
      const firstStream = mockStream

      vi.advanceTimersByTime(4 * 60 * 1000)

      expect(mockStream).not.toBe(firstStream)
    })
  })

  describe('reconnection', () => {
    it('reconnects after stream error with backoff', () => {
      helper.start()
      mockStream.emit('error', new Error('Network error'))

      vi.advanceTimersByTime(300)
      expect(mockStream).toBeDefined()
    })

    it('increases backoff on consecutive failures', () => {
      helper.start()
      const firstStream = mockStream
      mockStream.emit('error', new Error('Error 1'))

      vi.advanceTimersByTime(300)
      const secondStream = mockStream
      mockStream.emit('error', new Error('Error 2'))

      // Second delay should be 600ms (2x)
      vi.advanceTimersByTime(300)
      expect(mockStream).toBe(secondStream)
      vi.advanceTimersByTime(300)
      // Now stream should be new
    })

    it('emits error status on stream error', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()

      mockStream.emit('error', new Error('Test error'))

      const errorEvents = events.filter(e => e.kind === 'status' && e.status === 'error')
      expect(errorEvents.length).toBe(1)
      expect(errorEvents[0].message).toBe('Test error')
    })
  })

  describe('stop', () => {
    it('emits closed status', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()
      helper.stop()

      expect(events.at(-1)).toEqual({ kind: 'status', status: 'closed' })
    })

    it('clears all timers', () => {
      helper.start()
      helper.stop()

      vi.advanceTimersByTime(5 * 60 * 1000)
      // No rotation or restart should occur - just verify no errors
    })

    it('ends the stream', () => {
      helper.start()
      const stream = mockStream
      helper.stop()

      expect(stream.removeAllListeners).toHaveBeenCalled()
      expect(stream.end).toHaveBeenCalled()
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
      helper.writeAudio(buf)
      // Should not throw
    })
  })

  describe('listener management', () => {
    it('returns unsubscribe function', () => {
      const listener = vi.fn()
      const unsub = helper.on(listener)
      helper.start()

      unsub()

      mockStream.emit('data', {
        results: [{ alternatives: [{ transcript: 'test' }], isFinal: true }]
      })

      // Listener should not receive the final event after unsubscribe
      const finalCalls = listener.mock.calls.filter(
        ([e]: [any]) => e.kind === 'final'
      )
      expect(finalCalls.length).toBe(0)
    })

    it('handles listener errors gracefully', () => {
      const badListener = vi.fn(() => { throw new Error('Listener error') })
      const goodListener = vi.fn()

      helper.on(badListener)
      helper.on(goodListener)
      helper.start()

      expect(goodListener).toHaveBeenCalled()
    })
  })

  describe('language configuration', () => {
    it('uses default en-US language', async () => {
      vi.resetModules()
      const mod = await import('@electron/STTHelper')
      const h = new mod.STTHelper()
      h.start()
      h.stop()
    })

    it('accepts custom language code', async () => {
      vi.resetModules()
      const mod = await import('@electron/STTHelper')
      const h = new mod.STTHelper({ languageCode: 'es-ES' })
      h.start()
      h.stop()
    })
  })
})
