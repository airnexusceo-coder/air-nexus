import { NextResponse } from 'next/server'
import { createTask, listTasks } from '@/lib/tasks/tasks'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const tasks = await listTasks(auth)
    return NextResponse.json({ tasks })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const task = await createTask(auth, body)
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
