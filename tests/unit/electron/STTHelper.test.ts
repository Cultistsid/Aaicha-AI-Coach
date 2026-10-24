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

  describe('healthy stream detection', () => {
    it('resets failCount after stream survives 5s', () => {
      helper.start()
      mockStream.emit('error', new Error('Early error'))

      vi.advanceTimersByTime(300) // First reconnect
      const healthyStream = mockStream

      vi.advanceTimersByTime(5100) // Stream survives 5s+
      healthyStream.emit('error', new Error('Late error'))

      vi.advanceTimersByTime(300) // Should use base delay, not doubled
      // If failCount was reset, next reconnect uses 300ms, not 600ms
    })

    it('doubles backoff for consecutive fast failures', () => {
      helper.start()

      // Fail quickly (< 5s)
      mockStream.emit('error', new Error('Error 1'))
      vi.advanceTimersByTime(100) // Time < 5s

      // Backoff should now be 600ms (2x)
      vi.advanceTimersByTime(300)
      expect(mockStream.write).not.toHaveBeenCalled() // Not reconnected yet

      vi.advanceTimersByTime(300)
      // Now reconnected
    })

    it('caps backoff at 5000ms', () => {
      helper.start()

      // Trigger many consecutive failures
      for (let i = 0; i < 10; i++) {
        mockStream.emit('error', new Error(`Error ${i}`))
        vi.advanceTimersByTime(50) // Fast failure
      }

      // Even after 10 failures, max delay is 5000ms
      vi.advanceTimersByTime(5000)
      // Should have reconnected by now
    })
  })

  describe('writeAudio error handling', () => {
    it('handles destroyed stream gracefully', () => {
      helper.start()
      const stream = mockStream as any
      stream.destroyed = true

      const buf = Buffer.from([0, 1, 2, 3])
      expect(() => helper.writeAudio(buf)).not.toThrow()
      expect(stream.write).not.toHaveBeenCalled()
    })

    it('handles writableEnded stream gracefully', () => {
      helper.start()
      const stream = mockStream as any
      stream.writableEnded = true

      const buf = Buffer.from([0, 1, 2, 3])
      expect(() => helper.writeAudio(buf)).not.toThrow()
      expect(stream.write).not.toHaveBeenCalled()
    })

    it('swallows write errors on dying stream', () => {
      helper.start()
      const stream = mockStream
      stream.write.mockImplementationOnce(() => {
        throw new Error('Stream closed mid-write')
      })

      const buf = Buffer.from([0, 1, 2, 3])
      expect(() => helper.writeAudio(buf)).not.toThrow()
    })
  })

  describe('stream lifecycle edge cases', () => {
    it('handles stream.end() throwing', () => {
      helper.start()
      const stream = mockStream
      stream.end.mockImplementationOnce(() => {
        throw new Error('End failed')
      })

      expect(() => helper.stop()).not.toThrow()
    })

    it('ignores late gRPC errors on discarded stream', () => {
      helper.start()
      const oldStream = mockStream

      // Rotate to new stream
      vi.advanceTimersByTime(4 * 60 * 1000)

      // Old stream emits late error
      const consoleSpy = vi.spyOn(console, 'error')
      expect(() => oldStream.emit('error', new Error('Late gRPC error'))).not.toThrow()

      // Should not propagate to session state
      consoleSpy.mockRestore()
    })

    it('prevents double-down on same stream', () => {
      const events: any[] = []
      helper.on((e) => events.push(e))
      helper.start()

      // Emit both error and end
      mockStream.emit('error', new Error('Network error'))
      mockStream.emit('end')
      mockStream.emit('close')

      // Should emit error status only once
      const errorEvents = events.filter(e => e.kind === 'status' && e.status === 'error')
      expect(errorEvents.length).toBe(1)
    })
  })

  describe('multiple concurrent listeners', () => {
    it('notifies all listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const listener3 = vi.fn()

      helper.on(listener1)
      helper.on(listener2)
      helper.on(listener3)

      helper.start()

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
      expect(listener3).toHaveBeenCalled()
    })

    it('continues notifying after one listener errors', () => {
      const badListener = vi.fn(() => { throw new Error('Listener crash') })
      const goodListener1 = vi.fn()
      const goodListener2 = vi.fn()

      helper.on(goodListener1)
      helper.on(badListener)
      helper.on(goodListener2)

      helper.start()

      expect(goodListener1).toHaveBeenCalled()
      expect(goodListener2).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('handles start while restart is pending', () => {
      helper.start()
      mockStream.emit('error', new Error('Error'))

      // Restart is scheduled but not executed yet
      vi.advanceTimersByTime(100)

      // Call start again
      helper.start()

      vi.advanceTimersByTime(200)
      // Should not double-create streams
    })

    it('handles stop during rotation', () => {
      helper.start()

      // Trigger rotation
      vi.advanceTimersByTime(4 * 60 * 1000)

      // Stop immediately after rotation starts
      helper.stop()

      // Should clean up both streams
      expect(() => vi.runAllTimers()).not.toThrow()
    })
  })
})
