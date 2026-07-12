import {
  ProviderApiError,
  ProviderConfigurationError,
  type ProviderCompleteInput,
  type ProviderTextResult,
  type ProviderTextStreamResult,
} from '@/lib/ai/providers/types'

/**
 * OpenAI fallback text provider. OpenAI's chat-completions wire format is
 * the same shape Groq uses (both are OpenAI-compatible APIs), so the
 * streaming SSE this returns can reuse the exact same parser the chat route
 * already has for Groq — no adapter needed.
 */

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
export const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini'
const PROVIDER_NAME = 'OpenAI'

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
  error?: { message?: string }
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY)
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new ProviderConfigurationError(PROVIDER_NAME, 'Missing OPENAI_API_KEY')
  return apiKey
}

async function readJson(response: Response) {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ProviderApiError(PROVIDER_NAME, 'OpenAI returned a non-JSON response', response.status)
  }
}

function parseResponse(value: unknown): OpenAiChatResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return value as OpenAiChatResponse
}

export async function createOpenAiTextReply({ messages, temperature, maxTokens, signal }: ProviderCompleteInput): Promise<ProviderTextResult> {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getApiKey()}` },
    body: JSON.stringify({ model: OPENAI_FALLBACK_MODEL, messages, temperature, max_tokens: maxTokens, stream: false }),
    signal,
  })
  const data = parseResponse(await readJson(response))
  if (!response.ok) {
    throw new ProviderApiError(PROVIDER_NAME, data.error?.message || `OpenAI request failed with HTTP ${response.status}`, response.status)
  }
  const reply = data.choices?.[0]?.message?.content
  if (typeof reply !== 'string' || !reply.trim()) throw new ProviderApiError(PROVIDER_NAME, 'OpenAI returned no message content', 502)
  return { reply, model: OPENAI_FALLBACK_MODEL, provider: PROVIDER_NAME }
}

export async function createOpenAiTextReplyStream({ messages, temperature, maxTokens, signal }: ProviderCompleteInput): Promise<ProviderTextStreamResult> {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getApiKey()}` },
    body: JSON.stringify({ model: OPENAI_FALLBACK_MODEL, messages, temperature, max_tokens: maxTokens, stream: true }),
    signal,
  })
  if (!response.ok) {
    const data = parseResponse(await readJson(response))
    throw new ProviderApiError(PROVIDER_NAME, data.error?.message || `OpenAI request failed with HTTP ${response.status}`, response.status)
  }
  if (!response.body) throw new ProviderApiError(PROVIDER_NAME, 'OpenAI returned no response stream', 502)
  return { stream: response.body, model: OPENAI_FALLBACK_MODEL, provider: PROVIDER_NAME }
}
