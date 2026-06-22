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
}

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

  if (!message) {
    return NextResponse.json(
      { error: 'Message is required' },
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