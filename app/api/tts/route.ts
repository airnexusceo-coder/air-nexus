import { NextResponse } from 'next/server'
import { cleanTextForSpeech } from '@/lib/voice/clean-text-for-speech'
import { GROQ_MODEL_ROLES } from '@/lib/ai/model-router'

export const runtime = 'nodejs'
export const maxDuration = 60

const GROQ_SPEECH_URL = 'https://api.groq.com/openai/v1/audio/speech'
export const GROQ_TTS_MODEL = GROQ_MODEL_ROLES.speech
const DEFAULT_VOICE = process.env.GROQ_TTS_VOICE ?? 'autumn'
const MAX_TEXT_LENGTH = 5_000
const MAX_ATTEMPTS = 2

type TtsRequestBody = {
  text?: unknown
  voice?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function publicProviderError(status: number) {
  if (status === 401 || status === 403) return 'Speech service authentication failed. Check the server configuration.'
  if (status === 429) return 'Speech service is busy. Please try again in a moment.'
  if (status >= 500) return 'Speech service is temporarily unavailable.'
  return 'The configured speech model or voice was rejected.'
}

async function requestSpeech(apiKey: string, input: string, voice: string) {
  let lastResponse: Response | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(GROQ_SPEECH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_TTS_MODEL,
          input,
          voice,
          response_format: 'wav',
        }),
        signal: AbortSignal.timeout(45_000),
      })
      lastResponse = response
      if (response.ok || (response.status !== 429 && response.status < 500)) return response
    } catch (error) {
      lastError = error
    }

    if (attempt + 1 < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
  }

  if (lastResponse) return lastResponse
  throw lastError instanceof Error ? lastError : new Error('Speech request failed')
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Text-to-speech is not configured. Add GROQ_API_KEY to the server environment.' },
      { status: 503 },
    )
  }

  let body: TtsRequestBody
  try {
    const value: unknown = await request.json()
    if (!isRecord(value)) throw new Error('Invalid body')
    body = value
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const text = cleanTextForSpeech(body.text)
  const voice = typeof body.voice === 'string' && body.voice.trim()
    ? body.voice.trim()
    : DEFAULT_VOICE

  if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: 'Text is too long' }, { status: 413 })

  try {
    const response = await requestSpeech(apiKey, text, voice)
    if (!response.ok) {
      const providerDetail = (await response.text()).slice(0, 500)
      console.error('Groq TTS request failed', { status: response.status, detail: providerDetail })
      return NextResponse.json(
        { error: publicProviderError(response.status) },
        { status: response.status === 429 ? 429 : response.status >= 500 ? 502 : 400 },
      )
    }

    const audio = await response.arrayBuffer()
    if (audio.byteLength === 0) return NextResponse.json({ error: 'Speech service returned empty audio.' }, { status: 502 })
    return new Response(audio, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'audio/wav',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Groq TTS error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Speech service could not be reached.' }, { status: 502 })
  }
}