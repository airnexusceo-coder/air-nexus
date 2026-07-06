import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 20

const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models'
const CHECK_TIMEOUT_MS = 10_000

type ProviderCheck = {
  ok: boolean
  status?: number
  message: string
}
const PROVIDER_CACHE_MS = 30_000
let providerCache: { expiresAt: number; value: ProviderCheck } | null = null


function isNetworkFailure(error: unknown) {
  if (!(error instanceof Error)) return true
  return ['fetch failed', 'network', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].some((part) => error.message.toLowerCase().includes(part.toLowerCase()))
}

async function checkGroqProvider(): Promise<ProviderCheck> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      message: 'GROQ_API_KEY is missing on the server. Chat and Orpheus speech cannot run until it is configured.',
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)

  try {
    const response = await fetch(GROQ_MODELS_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (response.ok) {
      return { ok: true, status: response.status, message: 'Groq is reachable from this server.' }
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: response.status, message: 'Groq is reachable, but the server API key was rejected.' }
    }

    if (response.status === 429) {
      return { ok: true, status: response.status, message: 'Groq is reachable, but the account is rate limited right now.' }
    }

    return { ok: false, status: response.status, message: `Groq responded with HTTP ${response.status}.` }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, message: 'The Groq check timed out. A school firewall or proxy may be blocking api.groq.com.' }
    }

    return {
      ok: false,
      message: isNetworkFailure(error)
        ? 'The server could not reach api.groq.com. A school firewall, DNS filter, or proxy is probably blocking the AI provider.'
        : 'The Groq connection check failed before reaching the provider.',
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function getCachedProviderCheck() {
  if (providerCache && providerCache.expiresAt > Date.now()) return providerCache.value
  const value = await checkGroqProvider()
  providerCache = { value, expiresAt: Date.now() + PROVIDER_CACHE_MS }
  return value
}

export async function GET() {
  const groq = await getCachedProviderCheck()

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    server: {
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
      localHttps: process.env.LOCAL_HTTPS === 'true',
      apiUrlConfigured: Boolean(process.env.API_URL),
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      ttsModelConfigured: Boolean(process.env.GROQ_TTS_MODEL),
    },
    checks: {
      groq,
    },
    guidance: groq.ok
      ? 'Server-side AI connectivity looks healthy. If microphone still fails, check browser/site permissions or school-managed device policy.'
      : 'If this only fails at school, run the app from a network that allows api.groq.com, deploy the server outside the school network, or ask IT to allow the Groq API domain.',
  }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } })
}