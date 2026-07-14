import { NextResponse } from 'next/server'
import { listRoomMessages, sendRoomMessage } from '@/lib/rooms/messages'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const url = new URL(request.url)
    const since = url.searchParams.get('since')
    const channelId = url.searchParams.get('channelId')
    const messages = await listRoomMessages(auth, id, since, channelId)
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
    const channelId = typeof body.channelId === 'string' ? body.channelId : null
    const message = await sendRoomMessage(auth, id, typeof body.body === 'string' ? body.body : '', channelId)
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
