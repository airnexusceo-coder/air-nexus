import { NextResponse } from 'next/server'
import { listFriendRequests } from '@/lib/airnexus/social'
import { handleAirnexusError, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const requests = await listFriendRequests(auth)
    return NextResponse.json({ requests })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
