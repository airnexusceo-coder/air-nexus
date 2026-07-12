import { NextResponse } from 'next/server'
import { startBreach } from '@/lib/apex/vault/breach'
import { handleApexError } from '@/lib/apex/vault/errors'
import { readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const session = await startBreach(
      auth,
      String(body.defenderId ?? ''),
      Number(body.breachBudget),
      Array.isArray(body.loadoutSlugs) ? body.loadoutSlugs.map(String) : [],
    )
    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    return handleApexError(error)
  }
}