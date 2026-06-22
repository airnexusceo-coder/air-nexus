import { sanitizeResponse } from '@/lib/ai/sanitize-response'

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'

export const GROQ_TUTOR_MODELS = {
  free: process.env.GROQ_FREE_TUTOR_MODEL ?? 'qwen/qwen3.6-27b',
  plus: process.env.GROQ_PLUS_TUTOR_MODEL ?? 'qwen/qwen3.6-27b',
  fallback: process.env.GROQ_FALLBACK_TUTOR_MODEL ?? 'llama-3.1-8b-instant',
} as const

export type TutorTier = 'free' | 'plus'

type GroqRole = 'system' | 'user' | 'assistant'

type GroqMessage = {
  role: GroqRole
  content: string
}

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  error?: {
    message?: string
  }
}

export type TutorReply = {
  reply: string
  model: string
}

export type CreateTutorReplyInput = {
  message: string
  tier?: TutorTier
  signal?: AbortSignal
}

export class GroqConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GroqConfigurationError'
  }
}

export class GroqApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GroqApiError'
    this.status = status
  }
}

const tutorSystemPrompt = `
You are AirGPT, a world-class AI teacher for students and teachers.
You explain clearly, patiently, and analytically.
Never reveal private reasoning, chain-of-thought, scratchpad content, or reasoning tags. Return only the final user-facing response.

Structure your answers:
1. Simple explanation first
2. Deeper breakdown
3. Examples when useful
4. Quick recap or a helpful follow-up question

Be educational, structured, supportive, and accurate. If the learner's request is unclear, ask one concise clarifying question.
`

function getGroqApiKey() {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    throw new GroqConfigurationError('Missing GROQ_API_KEY')
  }

  return apiKey
}

function getTutorModel(tier: TutorTier) {
  return tier === 'plus' ? GROQ_TUTOR_MODELS.plus : GROQ_TUTOR_MODELS.free
}

function parseGroqResponse(value: unknown): GroqChatCompletionResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  return value as GroqChatCompletionResponse
}

async function readGroqJson(response: Response) {
  const responseText = await response.text()

  if (!responseText.trim()) {
    return {}
  }

  try {
    return JSON.parse(responseText) as unknown
  } catch {
    throw new GroqApiError('Groq returned a non-JSON response', response.status)
  }
}

export async function createTutorReply({
  message,
  tier = 'free',
  signal,
}: CreateTutorReplyInput): Promise<TutorReply> {
  const model = getTutorModel(tier)
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: tutorSystemPrompt,
    },
    {
      role: 'user',
      content: message,
    },
  ]

  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getGroqApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.5,
      max_completion_tokens: 2048,
      stream: false,
    }),
    signal,
  })

  const data = parseGroqResponse(await readGroqJson(response))

  if (!response.ok) {
    throw new GroqApiError(
      data.error?.message || `Groq request failed with HTTP ${response.status}`,
      response.status,
    )
  }

  const reply = sanitizeResponse(data.choices?.[0]?.message?.content)

  return {
    reply: reply || 'No response generated.',
    model,
  }
}