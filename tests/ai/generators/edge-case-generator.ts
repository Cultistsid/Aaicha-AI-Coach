import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface EdgeCase {
  input: string
  expectedBehavior: string
  category: 'boundary' | 'malformed' | 'unicode' | 'injection' | 'timing'
}

export async function generateEdgeCases(
  componentDescription: string,
  inputSchema: string,
  count: number = 10
): Promise<EdgeCase[]> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 4096,
    system: `You are a senior QA engineer specializing in edge case generation.
Generate edge cases that are:
1. Realistic (could happen in production)
2. Diverse (cover different failure modes)
3. Testable (clear expected behavior)

Output JSON array of EdgeCase objects.`,
    messages: [{
      role: 'user',
      content: `Generate ${count} edge cases for:

Component: ${componentDescription}
Input Schema: ${inputSchema}

Categories to cover:
- boundary: min/max values, empty inputs, single elements
- malformed: invalid types, missing fields, extra fields
- unicode: emoji, RTL text, zero-width chars, combining chars
- injection: script tags, SQL-like strings, shell metacharacters
- timing: rapid inputs, delayed responses, concurrent operations`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]')
}

export async function generateSTTEdgeCases(): Promise<EdgeCase[]> {
  return generateEdgeCases(
    'Speech-to-text helper that processes audio buffers and emits transcript events',
    `{
      input: Buffer (PCM 16-bit, 16kHz),
      events: 'interim' | 'final' | 'status',
      methods: start(), stop(), writeAudio(buf)
    }`,
    15
  )
}
