import { NextResponse } from 'next/server'
import { GROQ_MODEL_ROLES } from '@/lib/ai/model-router'

export const runtime = 'nodejs'
export const maxDuration = 60

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MAX_AUDIO_BYTES = 20 * 1024 * 1024

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Voice transcription is not configured.' }, { status: 503 })

  let formData: FormData
  try { formData = await request.formData() } catch { return NextResponse.json({ error: 'Invalid audio upload.' }, { status: 400 }) }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Audio is required.' }, { status: 400 })
  if (file.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: 'Audio must be 20 MB or smaller.' }, { status: 413 })

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
  if (!response?.ok) return NextResponse.json({ error: response?.status === 429 ? 'Voice transcription is busy. Try again shortly.' : 'Voice transcription failed.' }, { status: response?.status === 429 ? 429 : 502 })
  const result = await response.json() as { text?: unknown }
  const text = typeof result.text === 'string' ? result.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'No speech was detected.' }, { status: 422 })
  return NextResponse.json({ text, model: GROQ_MODEL_ROLES.transcription }, { headers: { 'Cache-Control': 'no-store' } })
}
