import { NextResponse } from 'next/server'
import { listAchievements } from '@/lib/apex/vault/achievements'
import { handleApexError } from '@/lib/apex/vault/errors'
import { requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const achievements = await listAchievements(auth)
    return NextResponse.json({ achievements })
  } catch (error) {
    return handleApexError(error)
  }
}