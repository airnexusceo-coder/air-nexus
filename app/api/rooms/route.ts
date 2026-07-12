import { NextResponse } from 'next/server'
import { createRoom, listMyRooms } from '@/lib/rooms/rooms'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const rooms = await listMyRooms(auth)
    return NextResponse.json({ rooms })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

/** Room creation is admin-only — requires both a valid AirNexus session (attribution) and a valid admin session (authorization). */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const admin = await requireAdminSession()
    requirePermission(admin, 'rooms.create')
    const body = await readBody(request)
    const room = await createRoom(auth, typeof body.name === 'string' ? body.name : '')
    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
