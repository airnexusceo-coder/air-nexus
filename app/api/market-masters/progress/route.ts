import { NextResponse } from 'next/server'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'
import { assertValidProgressInput, syncMarketMastersProgress } from '@/lib/market-masters/progress-sync'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const input = assertValidProgressInput(body)
    await syncMarketMastersProgress(auth, input)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
