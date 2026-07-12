import { NextResponse } from 'next/server'
import { syncMotivationStats } from '@/lib/motivation-sync'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    await syncMotivationStats(auth, {
      lifetimeXp: Number(body.lifetimeXp),
      currentStreakDays: Number(body.currentStreakDays),
      longestStreakDays: Number(body.longestStreakDays),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
