import { NextResponse } from 'next/server'
import { takeBreachAction } from '@/lib/apex/vault/breach'
import { isApexBotSessionId, takeBotBreachAction } from '@/lib/apex/vault/bots'
import { handleApexError } from '@/lib/apex/vault/errors'
import { readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

/**
 * Takes one breach decision (scan / probe / use_tool / overload / retreat).
 * Real player sessions are resolved by the Supabase SQL resolver; practice bot
 * sessions use the Apex backend simulator and never mutate another player.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const body = await readBody(request)
    const action = typeof body.action === 'string' ? body.action : ''
    const technologySlug = typeof body.technologySlug === 'string' ? body.technologySlug : null
    const state = isApexBotSessionId(id)
      ? await takeBotBreachAction(auth, id, action, technologySlug)
      : await takeBreachAction(auth, id, action, technologySlug)
    return NextResponse.json(state)
  } catch (error) {
    return handleApexError(error)
  }
}