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

export const mockSpeechClient = new MockSpeechClient()
