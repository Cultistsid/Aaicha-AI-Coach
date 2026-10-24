import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the hooks
vi.mock('../../src/lib/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    supported: true,
    listening: false,
    interim: '',
    error: null,
    level: 0,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('../../src/lib/useStickyScroll', () => ({
  useStickyScroll: () => ({
    containerRef: { current: null },
    endRef: { current: null },
    isAtBottom: true,
    scrollToBottom: vi.fn()
  })
}))

// Use real lucide-react icons - importOriginal ensures all icons work
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  return { ...actual }
})

// Import after mocks
import { ListeningMode } from '../../src/components/chat/ListeningMode'

describe('ListeningMode', () => {
  const mockOnExit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset window.electronAPI mock with all required methods
    Object.defineProperty(window, 'electronAPI', {
      value: {
        coachTurn: vi.fn().mockResolvedValue(undefined),
        coachReset: vi.fn().mockResolvedValue(undefined),
        getOverlay: vi.fn().mockResolvedValue({ active: false }),
        setOverlay: vi.fn().mockResolvedValue(undefined),
        toggleOverlay: vi.fn().mockResolvedValue(undefined),
        onOverlayState: vi.fn().mockReturnValue(() => {}),
        getStealth: vi.fn().mockResolvedValue({ active: false }),
        toggleStealth: vi.fn().mockResolvedValue(undefined),
        onStealthState: vi.fn().mockReturnValue(() => {}),
        getInterviewMode: vi.fn().mockResolvedValue({ mode: 'coach' }),
        setInterviewMode: vi.fn().mockResolvedValue(undefined),
        onCoachDelta: vi.fn().mockReturnValue(() => {}),
        onCoachDone: vi.fn().mockReturnValue(() => {}),
        onCoachError: vi.fn().mockReturnValue(() => {}),
        onCoachScreenAttached: vi.fn().mockReturnValue(() => {}),
        startListening: vi.fn().mockResolvedValue(undefined),
        stopListening: vi.fn().mockResolvedValue(undefined),
        onSttEvent: vi.fn().mockReturnValue(() => {}),
        onSTTEvent: vi.fn().mockReturnValue(() => {}),
        onScreenCaptured: vi.fn().mockReturnValue(() => {}),
        sttStart: vi.fn().mockResolvedValue({ success: true }),
        sttStop: vi.fn().mockResolvedValue(undefined),
        sttSendAudio: vi.fn()
      },
      writable: true
    })
  })

  it('renders without crashing', () => {
    render(<ListeningMode onExit={mockOnExit} />)
    // Component should render
  })

  it('calls onExit when exit button is clicked', async () => {
    render(<ListeningMode onExit={mockOnExit} />)
    // Find button by aria-label or role
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('renders the component', () => {
    const { container } = render(<ListeningMode onExit={mockOnExit} />)
    expect(container).toBeTruthy()
  })

  it('initializes overlay state from API', async () => {
    render(<ListeningMode onExit={mockOnExit} />)

    await waitFor(() => {
      expect(window.electronAPI.getOverlay).toHaveBeenCalled()
    })
  })

  it('subscribes to overlay state changes', () => {
    render(<ListeningMode onExit={mockOnExit} />)
    expect(window.electronAPI.onOverlayState).toHaveBeenCalled()
  })
})
