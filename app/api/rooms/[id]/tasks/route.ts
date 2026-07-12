import { NextResponse } from 'next/server'
import { createRoomTask, listRoomTasks } from '@/lib/rooms/tasks'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const tasks = await listRoomTasks(auth, id)
    return NextResponse.json({ tasks })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const body = await readBody(request)
    const task = await createRoomTask(
      auth,
      id,
      typeof body.title === 'string' ? body.title : '',
      typeof body.assigneeId === 'string' ? body.assigneeId : null,
    )
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
