import { NextResponse } from 'next/server'
import { createAdmin, listAdmins } from '@/lib/admin/admins'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import type { AdminPermission } from '@/lib/admin/permissions'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'admin.view')
    const admins = await listAdmins()
    return NextResponse.json({ admins })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'admin.create')
    const body = await readBody(request)
    const role = body.role === 'super_admin' ? 'super_admin' : 'admin'
    const permissions = Array.isArray(body.permissions) ? (body.permissions.filter((p): p is AdminPermission => typeof p === 'string')) : []
    const created = await createAdmin(
      admin,
      typeof body.username === 'string' ? body.username : '',
      typeof body.password === 'string' ? body.password : '',
      role,
      permissions,
    )
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
