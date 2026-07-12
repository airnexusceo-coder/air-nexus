import { NextResponse } from 'next/server'
import { listDefenderActivity } from '@/lib/apex/vault/breach'
import { handleApexError } from '@/lib/apex/vault/errors'
import { requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

/** The defender's activity feed - breach attempts against their Vault, useful even though they were offline when it happened. */
export async function GET() {
  try {
    const auth = await requireAuth()
    const activity = await listDefenderActivity(auth)
    return NextResponse.json({ activity })
  } catch (error) {
    return handleApexError(error)
  }
}