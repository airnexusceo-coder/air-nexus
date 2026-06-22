import { NextResponse } from 'next/server'
import { sanitizeResponse } from '@/lib/ai/sanitize-response'

export const runtime = 'nodejs'

const MAX_MESSAGE_LENGTH = 12_000

type CollabRequestBody = {
  message?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readRequestBody(req: Request): Promise<CollabRequestBody | null> {
  try {
    const body: unknown = await req.json()
    return isRecord(body) ? body : null
  } catch {
    return null
  }
}

function getMessageFromBody(body: CollabRequestBody | null) {
  if (!body || typeof body.message !== 'string') {
    return null
  }

  const message = body.message.trim()

  if (!message) {
    return null
  }

  return message
}

export async function POST(req: Request) {
  try {
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

    const reply = `Collaborator reply: ${message}`

    return NextResponse.json({ reply: sanitizeResponse(reply) })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    console.error('Collab API error:', errorMessage)

    return NextResponse.json(
      { error: 'Failed to get collaboration response' },
      { status: 500 },
    )
  }
}