import { NextResponse } from 'next/server'
import { deleteAchievement, updateAchievement } from '@/lib/admin/achievements'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'achievements.edit')
    const { id } = await params
    const body = await readBody(request)
    await updateAchievement(admin, id, typeof body.name === 'string' ? body.name : '', typeof body.description === 'string' ? body.description : '')
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'achievements.delete')
    const { id } = await params
    await deleteAchievement(admin, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
