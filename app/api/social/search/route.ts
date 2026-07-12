import { NextResponse } from 'next/server'
import { searchProfiles } from '@/lib/airnexus/social'
import { handleAirnexusError, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    const query = new URL(request.url).searchParams.get('q') ?? ''
    const results = await searchProfiles(auth, query)
    return NextResponse.json({ results })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
