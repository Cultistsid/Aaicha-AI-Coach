import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface ValidationResult {
  valid: boolean
  score: number
  issues: string[]
  suggestions: string[]
}

export async function validateCoachResponse(
  interviewQuestion: string,
  coachResponse: string,
  candidateBackground?: string
): Promise<ValidationResult> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5-20250514',
    max_tokens: 2048,
    system: `You are evaluating interview coaching responses for quality.

Score on these criteria (0-100 total):
1. Authenticity (25pts): Does it sound like a human candidate, not AI?
2. Relevance (25pts): Does it answer the actual question?
3. Conciseness (20pts): Is it appropriately brief for live delivery?
4. Technical accuracy (15pts): For coding questions, is the solution correct?
5. STAR compliance (15pts): For behavioral, does it follow STAR format?

Red flags that should fail validation:
- Type hints in Python code
- Docstrings or "Solution" class wrappers
- Bulleted lists for code explanations (should be spoken)
- Closers like "Does that make sense?" or "Let me know if..."
- Over-engineered variable names like "frequency_map"

Output JSON: { valid: boolean, score: number, issues: string[], suggestions: string[] }`,
    messages: [{
      role: 'user',
      content: `Interview Question: ${interviewQuestion}

Coach Response:
${coachResponse}

${candidateBackground ? `Candidate Background:\n${candidateBackground}` : ''}`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{"valid":false,"score":0,"issues":["Parse error"],"suggestions":[]}')
}

export async function validateCoachResponseBatch(
  testCases: Array<{ question: string; response: string; background?: string }>
): Promise<Map<number, ValidationResult>> {
  const results = new Map<number, ValidationResult>()

  const batchSize = 5
  for (let i = 0; i < testCases.length; i += batchSize) {
    const batch = testCases.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(tc => validateCoachResponse(tc.question, tc.response, tc.background))
    )
    batchResults.forEach((result, idx) => results.set(i + idx, result))
  }

  return results
}
