import { NextResponse } from 'next/server'
import { requireAuth, handleAirnexusError } from '@/lib/airnexus/http'
import { claimNexusPointGrants } from '@/lib/nexus-grants'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const auth = await requireAuth()
    const grants = await claimNexusPointGrants(auth.user.id)
    const total = grants.reduce((sum, grant) => sum + grant.amount, 0)
    return NextResponse.json({ grants, total })
  } catch (error) {
    return handleAirnexusError(error)
  }
}