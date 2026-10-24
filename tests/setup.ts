import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Use real lucide-react icons - importOriginal ensures all icons work
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  return { ...actual }
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

// Global window.electronAPI mock
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    coachTurn: vi.fn(),
    getOverlay: vi.fn().mockResolvedValue({ active: false }),
    onOverlayState: vi.fn().mockReturnValue(() => {}),
    onCoachDelta: vi.fn().mockReturnValue(() => {}),
    onCoachDone: vi.fn().mockReturnValue(() => {}),
    startListening: vi.fn().mockResolvedValue(undefined),
    stopListening: vi.fn().mockResolvedValue(undefined),
    onSttEvent: vi.fn().mockReturnValue(() => {})
  },
  writable: true
})
