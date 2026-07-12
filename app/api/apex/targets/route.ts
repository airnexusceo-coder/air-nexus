import { NextResponse } from 'next/server'
import { listApexTargets } from '@/lib/apex/vault/targets'
import { handleApexError } from '@/lib/apex/vault/errors'
import { requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const targets = await listApexTargets(auth)
    return NextResponse.json({ targets })
  } catch (error) {
    return handleApexError(error)
  }
}