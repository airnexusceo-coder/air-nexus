import { NextResponse } from 'next/server'
import { repairVault } from '@/lib/apex/vault/vault'
import { handleApexError } from '@/lib/apex/vault/errors'
import { readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const overview = await repairVault(auth, Number(body.restorePercent))
    return NextResponse.json(overview)
  } catch (error) {
    return handleApexError(error)
  }
}