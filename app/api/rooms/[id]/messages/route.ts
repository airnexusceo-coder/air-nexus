import { NextResponse } from 'next/server'
import { listRoomMessages, sendRoomMessage } from '@/lib/rooms/messages'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const since = new URL(request.url).searchParams.get('since')
    const messages = await listRoomMessages(auth, id, since)
    return NextResponse.json({ messages })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const body = await readBody(request)
    const message = await sendRoomMessage(auth, id, typeof body.body === 'string' ? body.body : '')
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
