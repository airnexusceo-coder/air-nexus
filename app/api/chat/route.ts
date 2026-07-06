import { NextResponse } from 'next/server'
import {
  createTutorReply,
  createTutorReplyStream,
  GroqApiError,
  GroqConfigurationError,
} from '@/lib/ai/groq'
import { isGroqTextPurpose } from '@/lib/ai/model-router'
import { sanitizeResponse } from '@/lib/ai/sanitize-response'
import {
  isTutorAction,
  isTutorMode,
  type TutorHistoryMessage,
} from '@/lib/ai/tutor-types'

export const runtime = 'nodejs'
export const maxDuration = 60

const REQUEST_TIMEOUT_MS = 45_000
const MAX_MESSAGE_LENGTH = 12_000
const MAX_DOCUMENTS = 5
const MAX_DOCUMENT_CHARACTERS = 40_000
const MAX_TOTAL_DOCUMENT_CHARACTERS = 80_000
const MAX_HISTORY_MESSAGES = 16
const MAX_HISTORY_MESSAGE_CHARACTERS = 4_000
const MAX_TOTAL_HISTORY_CHARACTERS = 24_000

type ChatRequestBody = {
  message?: unknown
  isPlus?: unknown
  documents?: unknown
  history?: unknown
  mode?: unknown
  action?: unknown
  purpose?: unknown
  stream?: unknown
}

type ChatDocument = { name: string; text: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readRequestBody(req: Request): Promise<ChatRequestBody | null> {
  try {
    const body: unknown = await req.json()
    return isRecord(body) ? body : null
  } catch {
    return null
  }
}

function getMessageFromBody(body: ChatRequestBody | null) {
  if (!body || typeof body.message !== 'string') return null
  const message = body.message.trim()
  return message || null
}

function getDocumentsFromBody(body: ChatRequestBody | null): ChatDocument[] | null {
  if (body?.documents === undefined) return []
  if (!Array.isArray(body.documents) || body.documents.length > MAX_DOCUMENTS) return null

  let totalCharacters = 0
  const documents: ChatDocument[] = []
  for (const value of body.documents) {
    if (!isRecord(value) || typeof value.name !== 'string' || typeof value.text !== 'string') return null
    const name = value.name.trim().slice(0, 180)
    const text = value.text.trim()
    if (!name || !text || text.length > MAX_DOCUMENT_CHARACTERS) return null
    totalCharacters += text.length
    if (totalCharacters > MAX_TOTAL_DOCUMENT_CHARACTERS) return null
    documents.push({ name, text })
  }
  return documents
}

function getHistoryFromBody(body: ChatRequestBody | null): TutorHistoryMessage[] | null {
  if (body?.history === undefined) return []
  if (!Array.isArray(body.history) || body.history.length > MAX_HISTORY_MESSAGES) return null

  let totalCharacters = 0
  const history: TutorHistoryMessage[] = []
  for (const value of body.history) {
    if (!isRecord(value) || (value.role !== 'user' && value.role !== 'assistant') || typeof value.content !== 'string') return null
    const content = value.content.trim()
    if (!content || content.length > MAX_HISTORY_MESSAGE_CHARACTERS) return null
    totalCharacters += content.length
    if (totalCharacters > MAX_TOTAL_HISTORY_CHARACTERS) return null
    history.push({ role: value.role, content })
  }
  return history
}

function createTimeoutSignal() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return { controller, timeoutId }
}

type GroqStreamEvent = {
  choices?: Array<{ delta?: { content?: unknown } }>
}

function createSanitizedTextStream(source: ReadableStream<Uint8Array>, onDone: () => void) {
  const reader = source.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let finished = false

  const finish = () => {
    if (finished) return
    finished = true
    onDone()
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = ''
      let accumulated = ''
      let emitted = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const payload = line.trim().startsWith('data:') ? line.trim().slice(5).trim() : ''
            if (!payload || payload === '[DONE]') continue
            try {
              const event = JSON.parse(payload) as GroqStreamEvent
              const content = event.choices?.[0]?.delta?.content
              if (typeof content !== 'string' || !content) continue
              accumulated += content
              const safe = sanitizeResponse(accumulated)
              if (!safe.startsWith(emitted)) continue
              const next = safe.slice(emitted.length)
              if (next) controller.enqueue(encoder.encode(next))
              emitted = safe
            } catch {
              // Ignore malformed provider event lines while preserving the stream.
            }
          }
        }
        if (!emitted) throw new Error('AI stream returned no message content')
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        finish()
        reader.releaseLock()
      }
    },
    async cancel() {
      finish()
      await reader.cancel()
    },
  })
}

export async function POST(req: Request) {
  const body = await readRequestBody(req)
  const message = getMessageFromBody(body)
  const documents = getDocumentsFromBody(body)
  const history = getHistoryFromBody(body)

  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  if (message.length > MAX_MESSAGE_LENGTH) return NextResponse.json({ error: 'Message is too long' }, { status: 413 })
  if (!documents) return NextResponse.json({ error: 'Invalid document context. Attach up to five readable documents.' }, { status: 400 })
  if (!history) return NextResponse.json({ error: 'Invalid tutor conversation history.' }, { status: 400 })
  if (body?.mode !== undefined && !isTutorMode(body.mode)) return NextResponse.json({ error: 'Invalid tutor mode.' }, { status: 400 })
  if (body?.action !== undefined && !isTutorAction(body.action)) return NextResponse.json({ error: 'Invalid tutor action.' }, { status: 400 })
  if (body?.purpose !== undefined && !isGroqTextPurpose(body.purpose)) return NextResponse.json({ error: 'Invalid AI model purpose.' }, { status: 400 })
  if (body?.stream !== undefined && typeof body.stream !== 'boolean') return NextResponse.json({ error: 'Invalid stream option.' }, { status: 400 })

  const { controller, timeoutId } = createTimeoutSignal()
  let streamOwnsTimeout = false
  try {
    const input = {
      message,
      documents,
      history,
      mode: isTutorMode(body?.mode) ? body.mode : 'auto' as const,
      action: isTutorAction(body?.action) ? body.action : 'teach' as const,
      purpose: isGroqTextPurpose(body?.purpose) ? body.purpose : documents.length > 0 ? 'document-analysis' as const : 'conversation' as const,
      tier: body?.isPlus === true ? 'plus' as const : 'free' as const,
      signal: controller.signal,
    }
    if (body?.stream === true) {
      const result = await createTutorReplyStream(input)
      streamOwnsTimeout = true
      return new Response(createSanitizedTextStream(result.stream, () => clearTimeout(timeoutId)), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-AirNexus-Model': result.model, 'X-AirNexus-Tools': result.tools.map(encodeURIComponent).join('|') },
      })
    }
    const result = await createTutorReply({
      ...input,
    })
    return NextResponse.json({ ...result, reply: sanitizeResponse(result.reply) })
  } catch (error) {
    if (error instanceof GroqConfigurationError) {
      console.error('AI configuration error:', error.message)
      return NextResponse.json({ error: 'AI service is not configured' }, { status: 500 })
    }
    if (error instanceof GroqApiError) {
      console.error('Groq API error:', error.message)
      const status = error.status === 429 ? 429 : error.status >= 500 ? 502 : 400
      const message = error.status === 429 ? 'AI service is busy. Please retry in a few seconds.' : 'Groq request failed'
      const headers: Record<string, string> = status === 429 ? { 'Retry-After': '3', 'Cache-Control': 'no-store' } : { 'Cache-Control': 'no-store' }
      return NextResponse.json({ error: message }, { status, headers })
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'AI request timed out' }, { status: 504 })
    }
    console.error('AI API error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  } finally {
    if (!streamOwnsTimeout) clearTimeout(timeoutId)
  }
}
