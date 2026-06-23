import { NextResponse } from 'next/server'
import {
  createTutorReply,
  GroqApiError,
  GroqConfigurationError,
} from '@/lib/ai/groq'
import { sanitizeResponse } from '@/lib/ai/sanitize-response'

export const runtime = 'nodejs'
export const maxDuration = 60

const REQUEST_TIMEOUT_MS = 45_000
const MAX_MESSAGE_LENGTH = 12_000

type ChatRequestBody = {
  message?: unknown
  isPlus?: unknown
  documents?: unknown
}

type ChatDocument = { name: string; text: string }

const MAX_DOCUMENTS = 5
const MAX_DOCUMENT_CHARACTERS = 40_000
const MAX_TOTAL_DOCUMENT_CHARACTERS = 80_000

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
  if (!body || typeof body.message !== 'string') {
    return null
  }

  const message = body.message.trim()

  if (!message) {
    return null
  }

  return message
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
function createTimeoutSignal() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  return { controller, timeoutId }
}

export async function POST(req: Request) {
  const body = await readRequestBody(req)
  const message = getMessageFromBody(body)
  const documents = getDocumentsFromBody(body)

  if (!message) {
    return NextResponse.json(
      { error: 'Message is required' },
      { status: 400 },
    )
  }

  if (!documents) {
    return NextResponse.json(
      { error: 'Invalid document context. Attach up to five readable documents.' },
      { status: 400 },
    )
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: 'Message is too long' },
      { status: 413 },
    )
  }

  const { controller, timeoutId } = createTimeoutSignal()

  try {
    const result = await createTutorReply({
      message,
      documents,
      tier: body?.isPlus === true ? 'plus' : 'free',
      signal: controller.signal,
    })

    return NextResponse.json({ ...result, reply: sanitizeResponse(result.reply) })
  } catch (error) {
    if (error instanceof GroqConfigurationError) {
      console.error('AI configuration error:', error.message)
      return NextResponse.json(
        { error: 'AI service is not configured' },
        { status: 500 },
      )
    }

    if (error instanceof GroqApiError) {
      console.error('Groq API error:', error.message)
      return NextResponse.json(
        { error: 'Groq request failed' },
        { status: error.status >= 500 ? 502 : 400 },
      )
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'AI request timed out' },
        { status: 504 },
      )
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    console.error('AI API error:', errorMessage)

    return NextResponse.json(
      { error: 'AI request failed' },
      { status: 500 },
    )
  } finally {
    clearTimeout(timeoutId)
  }
}