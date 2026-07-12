import { ProviderApiError, ProviderConfigurationError } from '@/lib/ai/providers/types'

const OPENAI_TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions'
export const OPENAI_TRANSCRIBE_MODEL = 'whisper-1'
const PROVIDER_NAME = 'OpenAI'

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY)
}

export async function transcribeWithOpenAi(file: File): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new ProviderConfigurationError(PROVIDER_NAME, 'Missing OPENAI_API_KEY')

  const body = new FormData()
  body.set('file', file, file.name || 'voice-input.webm')
  body.set('model', OPENAI_TRANSCRIBE_MODEL)
  body.set('response_format', 'json')

  const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new ProviderApiError(PROVIDER_NAME, detail.slice(0, 300) || `OpenAI transcription failed with HTTP ${response.status}`, response.status)
  }
  const result = (await response.json()) as { text?: unknown }
  const text = typeof result.text === 'string' ? result.text.trim() : ''
  if (!text) throw new ProviderApiError(PROVIDER_NAME, 'OpenAI returned no speech text', 422)
  return { text, model: OPENAI_TRANSCRIBE_MODEL }
}
