import { NextResponse } from 'next/server'
import { getBreachState } from '@/lib/apex/vault/breach'
import { handleApexError } from '@/lib/apex/vault/errors'
import { requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const state = await getBreachState(auth, id)
    return NextResponse.json(state)
  } catch (error) {
    return handleApexError(error)
  }
}