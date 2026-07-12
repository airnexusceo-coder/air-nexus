/** Shared shapes for fallback text providers (OpenAI, Anthropic) — mirrors lib/ai/groq.ts's public shape so callers don't care which provider answered. */

export type SimpleChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type ProviderTextResult = { reply: string; model: string; provider: string }
export type ProviderTextStreamResult = { stream: ReadableStream<Uint8Array>; model: string; provider: string }

export type ProviderCompleteInput = {
  messages: SimpleChatMessage[]
  temperature: number
  maxTokens: number
  signal?: AbortSignal
}

export class ProviderConfigurationError extends Error {
  provider: string
  constructor(provider: string, message: string) {
    super(message)
    this.name = 'ProviderConfigurationError'
    this.provider = provider
  }
}

export class ProviderApiError extends Error {
  provider: string
  status: number
  constructor(provider: string, message: string, status: number) {
    super(message)
    this.name = 'ProviderApiError'
    this.provider = provider
    this.status = status
  }
}

/** Whether a failure should trigger falling through to the next provider in the chain, rather than failing the whole request immediately. */
export function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof ProviderConfigurationError) return true
  if (error instanceof ProviderApiError) return error.status === 429 || error.status >= 500
  if (error instanceof DOMException && error.name === 'AbortError') return false
  if (error instanceof TypeError) return true // network/fetch failure
  return false
}
