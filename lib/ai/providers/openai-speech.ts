import { ProviderApiError, ProviderConfigurationError } from '@/lib/ai/providers/types'

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech'
export const OPENAI_TTS_MODEL = 'tts-1'
const OPENAI_FALLBACK_VOICE = 'alloy'
const PROVIDER_NAME = 'OpenAI'

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY)
}

/** Groq voice names (e.g. "autumn") aren't valid OpenAI voices, so the fallback always speaks in a fixed backup voice rather than passing the caller's choice through. */
export async function synthesizeWithOpenAi(text: string): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new ProviderConfigurationError(PROVIDER_NAME, 'Missing OPENAI_API_KEY')

  const response = await fetch(OPENAI_SPEECH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_TTS_MODEL, input: text, voice: OPENAI_FALLBACK_VOICE, response_format: 'wav' }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new ProviderApiError(PROVIDER_NAME, detail.slice(0, 300) || `OpenAI speech failed with HTTP ${response.status}`, response.status)
  }
  return response
}
