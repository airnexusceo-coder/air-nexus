import { sanitizeResponse } from '@/lib/ai/sanitize-response'
import type { TutorAction, TutorHistoryMessage, TutorMode } from '@/lib/ai/tutor-types'
import { executeStudyTool, studyToolDefinitions, type GroqToolCall } from '@/lib/ai/study-tools'
import { selectGroqTextModel, type GroqTextPurpose } from '@/lib/ai/model-router'
import { actionInstruction, automaticToolPrompt, modeInstruction, toolResultPrompt, tutorSystemPrompt } from '@/lib/ai/prompts'

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'


export type TutorTier = 'free' | 'plus'

type GroqRole = 'system' | 'user' | 'assistant'

type GroqMessage = {
  role: GroqRole | 'tool'
  content: string | null
  tool_calls?: GroqToolCall[]
  tool_call_id?: string
  name?: string
}

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
      tool_calls?: GroqToolCall[]
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

export type TutorReplyStream = {
  stream: ReadableStream<Uint8Array>
  model: string
  tools: string[]
}

export type CreateTutorReplyInput = {
  message: string
  documents?: Array<{ name: string; text: string }>
  history?: TutorHistoryMessage[]
  mode?: TutorMode
  purpose?: GroqTextPurpose
  action?: TutorAction
  tier?: TutorTier
  memoryContext?: string
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

function getGroqApiKey() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new GroqConfigurationError('Missing GROQ_API_KEY')
  return apiKey
}

function getTutorModel(action: TutorAction, purpose: GroqTextPurpose, documents: Array<{ name: string; text: string }>) {
  return selectGroqTextModel({ action, purpose, hasDocuments: documents.length > 0 })
}

function parseGroqResponse(value: unknown): GroqChatCompletionResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return value as GroqChatCompletionResponse
}

async function readGroqJson(response: Response) {
  const responseText = await response.text()
  if (!responseText.trim()) return {}
  try {
    return JSON.parse(responseText) as unknown
  } catch {
    throw new GroqApiError('Groq returned a non-JSON response', response.status)
  }
}

async function fetchGroq(init: RequestInit) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, init)
    if (response.status !== 429 || attempt === 1) return response
    const retryAfterSeconds = Number(response.headers.get('retry-after'))
    const retryAfterMs = Number.isFinite(retryAfterSeconds)
      ? Math.min(5_000, Math.max(250, retryAfterSeconds * 1_000))
      : 1_500
    await response.body?.cancel()
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs))
  }
  throw new GroqApiError('Groq request failed after retry', 429)
}

export async function createTutorReply({
  message,
  documents = [],
  history = [],
  mode = 'auto',
  purpose = 'conversation',
  action = 'teach',
  memoryContext = '',
  signal,
}: CreateTutorReplyInput): Promise<TutorReply> {
  const model = getTutorModel(action, purpose, documents)
  const documentContext = documents.length
    ? '\n\nUploaded reference documents:\n' + documents.map((document, index) =>
      '<document index="' + (index + 1) + '" name="' + document.name.replace(/[<>]/g, '') + '">\n' + document.text + '\n</document>',
    ).join('\n\n')
    : ''
  const memoryInstruction = memoryContext ? `\n${memoryContext}` : ''
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: `${tutorSystemPrompt}\n${modeInstruction(mode)}\n${actionInstruction(action, purpose)}${memoryInstruction}`,
    },
    ...history.map((historyMessage) => ({ role: historyMessage.role, content: historyMessage.content })),
    {
      role: 'user',
      content: message + documentContext,
    },
  ]

  const response = await fetchGroq({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getGroqApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: action === 'flashcards' || action === 'study-coach' || action === 'writing-suggestions' || action === 'notes' || action === 'draft' || action.startsWith('assignment-') ? 0.25 : 0.5,
      max_completion_tokens: action.startsWith('assignment-') ? 6_000 : action === 'flashcards' || action === 'study-coach' || action === 'notes' || action === 'draft' ? 4_096 : 2_048,
      stream: false,
    }),
    signal,
  })

  const data = parseGroqResponse(await readGroqJson(response))
  if (!response.ok) {
    throw new GroqApiError(data.error?.message || `Groq request failed with HTTP ${response.status}`, response.status)
  }

  const reply = sanitizeResponse(data.choices?.[0]?.message?.content)
  if (!reply) throw new GroqApiError('Groq returned no message content', 502)
  return { reply, model }
}

export async function createTutorReplyStream({
  message,
  documents = [],
  history = [],
  mode = 'auto',
  action = 'teach',
  purpose = 'conversation',
  memoryContext = '',
  signal,
}: CreateTutorReplyInput): Promise<TutorReplyStream> {
  const model = getTutorModel(action, purpose, documents)
  const documentContext = documents.length
    ? '\n\nUploaded reference documents:\n' + documents.map((document, index) =>
      '<document index="' + (index + 1) + '" name="' + document.name.replace(/[<>]/g, '') + '">\n' + document.text + '\n</document>',
    ).join('\n\n')
    : ''
  const memoryInstruction = memoryContext ? `\n${memoryContext}` : ''
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: `${tutorSystemPrompt}\n${modeInstruction(mode)}\n${actionInstruction(action, purpose)}${memoryInstruction}`,
    },
    ...history.map((historyMessage) => ({ role: historyMessage.role, content: historyMessage.content })),
    {
      role: 'user',
      content: message + documentContext,
    },
  ]

  let usedTools: string[] = []
  if (action === 'teach') {
    const toolResponse = await fetchGroq({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getGroqApiKey()}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: `${tutorSystemPrompt}\n${modeInstruction(mode)}\n${automaticToolPrompt}${memoryInstruction}` }, ...messages.slice(1)], tools: studyToolDefinitions, tool_choice: 'auto', temperature: 0.2, max_completion_tokens: 700, stream: false }),
      signal,
    })
    const toolData = parseGroqResponse(await readGroqJson(toolResponse))
    if (!toolResponse.ok) throw new GroqApiError(toolData.error?.message || `Groq tool selection failed with HTTP ${toolResponse.status}`, toolResponse.status)
    const toolCalls = toolData.choices?.[0]?.message?.tool_calls?.slice(0, 4) ?? []
    if (toolCalls.length > 0) {
      const executions = toolCalls.map((call) => executeStudyTool(call, documents))
      usedTools = [...new Set(executions.map((execution) => execution.label))]
      messages[0] = { role: 'system', content: `${tutorSystemPrompt}\n${modeInstruction(mode)}\n${toolResultPrompt}${memoryInstruction}` }
      messages.push({ role: 'assistant', content: null, tool_calls: toolCalls })
      messages.push(...executions.map((execution) => ({ role: 'tool' as const, name: execution.name, tool_call_id: execution.id, content: execution.content })))
    }
  }

  const response = await fetchGroq({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getGroqApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: action === 'flashcards' || action === 'study-coach' || action === 'writing-suggestions' || action === 'notes' || action === 'draft' || action.startsWith('assignment-') ? 0.25 : 0.5,
      max_completion_tokens: action.startsWith('assignment-') ? 6_000 : action === 'flashcards' || action === 'study-coach' || action === 'notes' || action === 'draft' ? 4_096 : 2_048,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const data = parseGroqResponse(await readGroqJson(response))
    throw new GroqApiError(data.error?.message || `Groq request failed with HTTP ${response.status}`, response.status)
  }
  if (!response.body) throw new GroqApiError('Groq returned no response stream', 502)
  return { stream: response.body, model, tools: usedTools }
}
