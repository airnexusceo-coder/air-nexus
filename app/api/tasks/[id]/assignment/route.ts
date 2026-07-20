import { NextResponse } from 'next/server'
import { getTaskAssignment, upsertTaskAssignment } from '@/lib/tasks/assignments'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const assignment = await getTaskAssignment(auth, id)
    return NextResponse.json({ assignment })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const body = await readBody(request)
    const assignment = await upsertTaskAssignment(auth, id, body)
    return NextResponse.json(assignment)
  } catch (error) {
    return handleAirnexusError(error)
  }
}
