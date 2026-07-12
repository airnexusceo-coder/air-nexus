import { NextResponse } from 'next/server'
import { getRoomDetail } from '@/lib/rooms/rooms'
import { handleAirnexusError, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const room = await getRoomDetail(auth, id)
    return NextResponse.json(room)
  } catch (error) {
    return handleAirnexusError(error)
  }
}
