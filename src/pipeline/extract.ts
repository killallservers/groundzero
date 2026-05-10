import Anthropic from '@anthropic-ai/sdk'
import type { PipelineState } from './types'

const client = new Anthropic()

export async function extract(idea: string): Promise<PipelineState['extracted']> {
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyse this project idea and identify what information is present and what is missing.

Idea: ${idea}

Respond with JSON in this exact shape:
{
  "present": ["things we already know from the idea"],
  "gaps": ["things we need to ask about before generating a workspace"]
}

Be specific. "gaps" should only include things that genuinely affect the generated workspace — stack choices, auth requirements, deployment target, etc. Don't ask about things that can be inferred or defaulted.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(text)
}
