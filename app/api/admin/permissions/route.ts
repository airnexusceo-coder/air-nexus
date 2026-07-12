import { NextResponse } from 'next/server'
import { ADMIN_PERMISSIONS, isPermissionLive, PERMISSION_LOCKED_REASON } from '@/lib/admin/permissions'
import { requireAdminSession } from '@/lib/admin/session'
import { handleAirnexusError } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdminSession()
    const permissions = ADMIN_PERMISSIONS.map((permission) => ({
      permission,
      live: isPermissionLive(permission),
      lockedReason: PERMISSION_LOCKED_REASON[permission] ?? null,
    }))
    return NextResponse.json({ permissions })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
