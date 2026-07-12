import { NextResponse } from 'next/server'
import { listBreachHistory } from '@/lib/apex/vault/breach'
import { handleApexError } from '@/lib/apex/vault/errors'
import { requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const history = await listBreachHistory(auth)
    return NextResponse.json({ history })
  } catch (error) {
    return handleApexError(error)
  }
}