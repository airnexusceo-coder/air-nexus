import { NextResponse } from 'next/server'
import { addRoomMember } from '@/lib/rooms/rooms'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const body = await readBody(request)
    await addRoomMember(auth, id, typeof body.userId === 'string' ? body.userId : '')
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
