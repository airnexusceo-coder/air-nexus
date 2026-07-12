import { NextResponse } from 'next/server'
import { deleteRoomTask, updateRoomTask, type RoomTaskPatch } from '@/lib/rooms/tasks'
import type { RoomTaskStatus } from '@/lib/rooms/types'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

const VALID_STATUSES: RoomTaskStatus[] = ['todo', 'in_progress', 'done']

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const auth = await requireAuth()
    const { id, taskId } = await params
    const body = await readBody(request)

    const patch: RoomTaskPatch = {}
    if (typeof body.title === 'string') patch.title = body.title
    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status as RoomTaskStatus)) patch.status = body.status as RoomTaskStatus
    if (body.assigneeId === null || typeof body.assigneeId === 'string') patch.assigneeId = body.assigneeId as string | null

    const task = await updateRoomTask(auth, id, taskId, patch)
    return NextResponse.json(task)
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const auth = await requireAuth()
    const { id, taskId } = await params
    await deleteRoomTask(auth, id, taskId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
