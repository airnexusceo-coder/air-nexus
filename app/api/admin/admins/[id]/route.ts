import { NextResponse } from 'next/server'
import { removeAdmin, updateAdminPermissions } from '@/lib/admin/admins'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import type { AdminPermission } from '@/lib/admin/permissions'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'admin.edit')
    const { id } = await params
    const body = await readBody(request)
    const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p): p is AdminPermission => typeof p === 'string') : []
    await updateAdminPermissions(admin, id, permissions)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'admin.remove')
    const { id } = await params
    await removeAdmin(admin, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
