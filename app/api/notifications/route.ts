import { NextResponse } from 'next/server'
import { listNotifications } from '@/lib/notifications/notifications'
import { handleAirnexusError, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const notifications = await listNotifications(auth)
    return NextResponse.json({ notifications })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
