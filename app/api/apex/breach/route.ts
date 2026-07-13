import { NextResponse } from 'next/server'
import { startBreach } from '@/lib/apex/vault/breach'
import { isApexBotTargetId, startBotBreach } from '@/lib/apex/vault/bots'
import { handleApexError } from '@/lib/apex/vault/errors'
import { readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const defenderId = String(body.defenderId ?? '')
    const breachBudget = Number(body.breachBudget)
    const loadoutSlugs = Array.isArray(body.loadoutSlugs) ? body.loadoutSlugs.map(String) : []
    const session = isApexBotTargetId(defenderId)
      ? await startBotBreach(auth, defenderId, breachBudget, loadoutSlugs)
      : await startBreach(auth, defenderId, breachBudget, loadoutSlugs)
    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    return handleApexError(error)
  }
}