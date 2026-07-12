import { NextResponse } from 'next/server'
import { GROQ_MODEL_ROLES } from '@/lib/ai/model-router'
import { isOpenAiConfigured, transcribeWithOpenAi } from '@/lib/ai/providers/openai-transcribe'

export const runtime = 'nodejs'
export const maxDuration = 60

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MAX_AUDIO_BYTES = 20 * 1024 * 1024

async function transcribeWithGroq(apiKey: string, file: File): Promise<{ text: string; model: string } | { retryable: boolean }> {
  const providerBody = new FormData()
  providerBody.set('file', file, file.name || 'voice-input.webm')
  providerBody.set('model', GROQ_MODEL_ROLES.transcription)
  providerBody.set('response_format', 'json')

  let response: Response | null = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(GROQ_TRANSCRIPTION_URL, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: providerBody, signal: AbortSignal.timeout(45_000) })
    if (response.ok || (response.status !== 429 && response.status < 500)) break
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 600))
  }
  if (!response?.ok) return { retryable: response?.status === 429 || (response?.status ?? 0) >= 500 }
  const result = (await response.json()) as { text?: unknown }
  const text = typeof result.text === 'string' ? result.text.trim() : ''
  if (!text) return { retryable: false }
  return { text, model: GROQ_MODEL_ROLES.transcription }
}

export async function POST(request: Request) {
  let formData: FormData
  try { formData = await request.formData() } catch { return NextResponse.json({ error: 'Invalid audio upload.' }, { status: 400 }) }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Audio is required.' }, { status: 400 })
  if (file.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: 'Audio must be 20 MB or smaller.' }, { status: 413 })

  const groqApiKey = process.env.GROQ_API_KEY
  if (groqApiKey) {
    const result = await transcribeWithGroq(groqApiKey, file)
    if ('text' in result) return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
    if (!result.retryable && !isOpenAiConfigured()) return NextResponse.json({ error: 'No speech was detected.' }, { status: 422 })
  }

  if (isOpenAiConfigured()) {
    try {
      const result = await transcribeWithOpenAi(file)
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return NextResponse.json({ error: 'Voice transcription failed.' }, { status: 502 })
    }
  }

  if (!groqApiKey) return NextResponse.json({ error: 'Voice transcription is not configured.' }, { status: 503 })
  return NextResponse.json({ error: 'Voice transcription failed.' }, { status: 502 })
}
