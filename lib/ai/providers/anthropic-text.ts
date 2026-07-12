import {
  ProviderApiError,
  ProviderConfigurationError,
  type ProviderCompleteInput,
  type ProviderTextResult,
  type ProviderTextStreamResult,
} from '@/lib/ai/providers/types'

/**
 * Anthropic fallback text provider — used only when Groq (and OpenAI) are
 * unavailable. Raw fetch against the Messages API, matching this codebase's
 * existing zero-SDK convention for every other AI provider.
 *
 * Anthropic's wire format differs from Groq/OpenAI: `system` is a separate
 * top-level field (not a message), and streaming uses `content_block_delta`
 * events rather than `choices[0].delta.content`. The streaming path below
 * adapts Anthropic's SSE into the OpenAI-shaped delta chunks the chat
 * route's existing stream parser already expects, so no parser changes are
 * needed there.
 */

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
export const ANTHROPIC_FALLBACK_MODEL = process.env.ANTHROPIC_FALLBACK_MODEL || 'claude-haiku-4-5'
const PROVIDER_NAME = 'Anthropic'

type AnthropicContentBlock = { type: string; text?: string }
type AnthropicMessageResponse = {
  content?: AnthropicContentBlock[]
  stop_reason?: string
  error?: { message?: string }
}

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function getApiKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new ProviderConfigurationError(PROVIDER_NAME, 'Missing ANTHROPIC_API_KEY')
  return apiKey
}

function toAnthropicRequest(messages: ProviderCompleteInput['messages'], temperature: number, maxTokens: number, stream: boolean) {
  const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n')
  const conversation = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content }))
  return {
    model: ANTHROPIC_FALLBACK_MODEL,
    max_tokens: maxTokens,
    temperature,
    system: system || undefined,
    messages: conversation,
    stream,
  }
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': getApiKey(),
    'anthropic-version': ANTHROPIC_VERSION,
  }
}

async function readJson(response: Response) {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ProviderApiError(PROVIDER_NAME, 'Anthropic returned a non-JSON response', response.status)
  }
}

function parseResponse(value: unknown): AnthropicMessageResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return value as AnthropicMessageResponse
}

export async function createAnthropicTextReply({ messages, temperature, maxTokens, signal }: ProviderCompleteInput): Promise<ProviderTextResult> {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(toAnthropicRequest(messages, temperature, maxTokens, false)),
    signal,
  })
  const data = parseResponse(await readJson(response))
  if (!response.ok) {
    throw new ProviderApiError(PROVIDER_NAME, data.error?.message || `Anthropic request failed with HTTP ${response.status}`, response.status)
  }
  const reply = (data.content ?? []).filter((block) => block.type === 'text').map((block) => block.text ?? '').join('')
  if (!reply.trim()) throw new ProviderApiError(PROVIDER_NAME, 'Anthropic returned no message content', 502)
  return { reply, model: ANTHROPIC_FALLBACK_MODEL, provider: PROVIDER_NAME }
}

type AnthropicStreamEvent = {
  type?: string
  delta?: { type?: string; text?: string }
}

/** Adapts Anthropic's `content_block_delta` SSE events into Groq/OpenAI-shaped delta chunks so the existing chat-route stream parser (which reads `choices[0].delta.content`) works unchanged. */
function adaptAnthropicStreamToOpenAiShape(source: ReadableStream<Uint8Array>) {
  const reader = source.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const payload = line.trim().startsWith('data:') ? line.trim().slice(5).trim() : ''
            if (!payload) continue
            try {
              const event = JSON.parse(payload) as AnthropicStreamEvent
              if (event.type !== 'content_block_delta' || event.delta?.type !== 'text_delta') continue
              const text = event.delta.text
              if (!text) continue
              const chunk = { choices: [{ delta: { content: text } }] }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            } catch {
              // Ignore malformed provider event lines while preserving the stream.
            }
          }
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
    async cancel() {
      await reader.cancel()
    },
  })
}

export async function createAnthropicTextReplyStream({ messages, temperature, maxTokens, signal }: ProviderCompleteInput): Promise<ProviderTextStreamResult> {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(toAnthropicRequest(messages, temperature, maxTokens, true)),
    signal,
  })
  if (!response.ok) {
    const data = parseResponse(await readJson(response))
    throw new ProviderApiError(PROVIDER_NAME, data.error?.message || `Anthropic request failed with HTTP ${response.status}`, response.status)
  }
  if (!response.body) throw new ProviderApiError(PROVIDER_NAME, 'Anthropic returned no response stream', 502)
  return { stream: adaptAnthropicStreamToOpenAiShape(response.body), model: ANTHROPIC_FALLBACK_MODEL, provider: PROVIDER_NAME }
}
