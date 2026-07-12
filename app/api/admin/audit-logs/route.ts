import { NextResponse } from 'next/server'
import { listAuditLog } from '@/lib/admin/audit'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'audit_logs.view')
    const entries = await listAuditLog()
    return NextResponse.json({ entries })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
