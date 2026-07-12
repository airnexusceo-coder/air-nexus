import { NextResponse } from 'next/server'
import { listClashes } from '@/lib/admin/clashes'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'clashes.view')
    const clashes = await listClashes()
    return NextResponse.json({ clashes })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
