import { NextResponse } from 'next/server'
import { getPublicProfile } from '@/lib/airnexus/social'
import { listPublicAchievements } from '@/lib/apex/vault/achievements'
import { handleAirnexusError, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const [profile, achievements] = await Promise.all([
      getPublicProfile(auth, id),
      listPublicAchievements(id),
    ])
    return NextResponse.json({ profile, achievements })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
