import {
  createTutorReply,
  createTutorReplyStream,
  GroqApiError,
  GroqConfigurationError,
  type CreateTutorReplyInput,
  type TutorReply,
  type TutorReplyStream,
} from '@/lib/ai/groq'
import { actionInstruction, modeInstruction, tutorSystemPrompt } from '@/lib/ai/prompts'
import { createAnthropicTextReply, createAnthropicTextReplyStream, isAnthropicConfigured } from '@/lib/ai/providers/anthropic-text'
import { createOpenAiTextReply, createOpenAiTextReplyStream, isOpenAiConfigured } from '@/lib/ai/providers/openai-text'
import { ProviderApiError, ProviderConfigurationError, type ProviderCompleteInput, type SimpleChatMessage } from '@/lib/ai/providers/types'

/**
 * Reliability layer over lib/ai/groq.ts: tries Groq first (full feature set,
 * incl. automatic study tools), and on an outage falls through to OpenAI
 * then Anthropic with the same tutor prompt. Fallback replies are plain
 * completions — no automatic tool-calling — since Groq's tool-selection
 * pass is Groq-specific. If no fallback keys are configured, behavior is
 * byte-identical to calling lib/ai/groq.ts directly (same errors surface).
 */

export type TutorReplyWithProvider = TutorReply & { provider: string }
export type TutorReplyStreamWithProvider = TutorReplyStream & { provider: string }

const FALLBACK_TEMPERATURE = 0.5
const FALLBACK_MAX_TOKENS = 2048

function isRetryable(error: unknown): boolean {
  if (error instanceof GroqConfigurationError || error instanceof ProviderConfigurationError) return true
  if (error instanceof GroqApiError || error instanceof ProviderApiError) return error.status === 429 || error.status >= 500
  if (error instanceof DOMException && error.name === 'AbortError') return false
  if (error instanceof TypeError) return true // network/fetch failure
  return false
}

function buildFallbackMessages(input: CreateTutorReplyInput): SimpleChatMessage[] {
  const { message, documents = [], history = [], mode = 'auto', action = 'teach', purpose = 'conversation', memoryContext = '' } = input
  const documentContext = documents.length
    ? '\n\nUploaded reference documents:\n' + documents.map((document, index) =>
      '<document index="' + (index + 1) + '" name="' + document.name.replace(/[<>]/g, '') + '">\n' + document.text + '\n</document>',
    ).join('\n\n')
    : ''
  const memoryInstruction = memoryContext ? `\n${memoryContext}` : ''
  return [
    { role: 'system', content: `${tutorSystemPrompt}\n${modeInstruction(mode)}\n${actionInstruction(action, purpose)}${memoryInstruction}` },
    ...history.map((historyMessage) => ({ role: historyMessage.role, content: historyMessage.content })),
    { role: 'user', content: message + documentContext },
  ]
}

function fallbackParams(input: CreateTutorReplyInput): ProviderCompleteInput {
  return {
    messages: buildFallbackMessages(input),
    temperature: FALLBACK_TEMPERATURE,
    maxTokens: FALLBACK_MAX_TOKENS,
    signal: input.signal,
  }
}

type Attempt<T> = { provider: string; run: () => Promise<T> }

async function runWithFallback<T>(attempts: Attempt<T>[]): Promise<T> {
  let lastError: unknown = null
  for (const attempt of attempts) {
    try {
      return await attempt.run()
    } catch (error) {
      lastError = error
      if (!isRetryable(error)) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All AI providers failed')
}

export async function createTutorReplyWithFallback(input: CreateTutorReplyInput): Promise<TutorReplyWithProvider> {
  const attempts: Attempt<TutorReplyWithProvider>[] = [
    { provider: 'Groq', run: async () => ({ ...(await createTutorReply(input)), provider: 'Groq' }) },
  ]
  if (isOpenAiConfigured()) attempts.push({ provider: 'OpenAI', run: () => createOpenAiTextReply(fallbackParams(input)) })
  if (isAnthropicConfigured()) attempts.push({ provider: 'Anthropic', run: () => createAnthropicTextReply(fallbackParams(input)) })
  return runWithFallback(attempts)
}

export async function createTutorReplyStreamWithFallback(input: CreateTutorReplyInput): Promise<TutorReplyStreamWithProvider> {
  const attempts: Attempt<TutorReplyStreamWithProvider>[] = [
    { provider: 'Groq', run: async () => ({ ...(await createTutorReplyStream(input)), provider: 'Groq' }) },
  ]
  if (isOpenAiConfigured()) {
    attempts.push({ provider: 'OpenAI', run: async () => ({ ...(await createOpenAiTextReplyStream(fallbackParams(input))), tools: [] }) })
  }
  if (isAnthropicConfigured()) {
    attempts.push({ provider: 'Anthropic', run: async () => ({ ...(await createAnthropicTextReplyStream(fallbackParams(input))), tools: [] }) })
  }
  return runWithFallback(attempts)
}
