import { NextResponse } from 'next/server'
import { banUser, deleteUser, editUserDisplayName, suspendUser, unbanUser, unsuspendUser } from '@/lib/admin/users'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

/**
 * One route, action-discriminated (mirrors the Apex/Rooms pattern) — these
 * are all "moderate this one user" operations on the same resource.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    const { id } = await params
    const body = await readBody(request)
    const action = body.action

    if (action === 'edit') {
      requirePermission(admin, 'users.edit')
      await editUserDisplayName(admin, id, typeof body.displayName === 'string' ? body.displayName : '')
      return NextResponse.json({ ok: true })
    }
    if (action === 'suspend') {
      requirePermission(admin, 'users.suspend')
      await suspendUser(admin, id, Number(body.hours), typeof body.reason === 'string' ? body.reason : '')
      return NextResponse.json({ ok: true })
    }
    if (action === 'unsuspend') {
      requirePermission(admin, 'users.suspend')
      await unsuspendUser(admin, id)
      return NextResponse.json({ ok: true })
    }
    if (action === 'ban') {
      requirePermission(admin, 'users.ban')
      await banUser(admin, id, typeof body.reason === 'string' ? body.reason : '')
      return NextResponse.json({ ok: true })
    }
    if (action === 'unban') {
      requirePermission(admin, 'users.ban')
      await unbanUser(admin, id)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'users.delete')
    const { id } = await params
    await deleteUser(admin, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
