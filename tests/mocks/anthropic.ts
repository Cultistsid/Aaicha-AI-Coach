import { vi } from 'vitest'

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
