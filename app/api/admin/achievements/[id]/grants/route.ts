import { NextResponse } from 'next/server'
import { grantAchievement, revokeAchievement } from '@/lib/admin/achievements'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'achievements.grant')
    const { id } = await params
    const body = await readBody(request)
    await grantAchievement(admin, typeof body.userId === 'string' ? body.userId : '', id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'achievements.revoke')
    const { id } = await params
    const body = await readBody(request)
    await revokeAchievement(admin, typeof body.userId === 'string' ? body.userId : '', id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
