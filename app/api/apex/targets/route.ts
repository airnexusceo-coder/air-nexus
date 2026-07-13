import { NextResponse } from 'next/server'
import { listApexBotTargets } from '@/lib/apex/vault/bots'
import type { ApexTarget } from '@/lib/apex/vault/types'
import { isApexBackendMissingSchema, handleApexError } from '@/lib/apex/vault/errors'
import { listApexTargets } from '@/lib/apex/vault/targets'
import { requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    let playerTargets: ApexTarget[] = []
    try {
      playerTargets = await listApexTargets(auth)
    } catch (error) {
      if (!isApexBackendMissingSchema(error)) throw error
    }
    return NextResponse.json({ targets: [...playerTargets, ...listApexBotTargets()] })
  } catch (error) {
    return handleApexError(error)
  }
}