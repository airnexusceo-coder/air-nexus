import { NextResponse } from 'next/server'
import { markAllNotificationsRead } from '@/lib/notifications/notifications'
import { handleAirnexusError, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const auth = await requireAuth()
    await markAllNotificationsRead(auth)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
