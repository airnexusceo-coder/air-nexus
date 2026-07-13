import { NextResponse } from 'next/server'
import { createCalendarEvent, listCalendarEvents } from '@/lib/calendar/calendar'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const events = await listCalendarEvents(auth)
    return NextResponse.json({ events })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const event = await createCalendarEvent(auth, body)
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
