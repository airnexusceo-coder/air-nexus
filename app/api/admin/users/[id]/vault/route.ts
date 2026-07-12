import { NextResponse } from 'next/server'
import { viewUserVault } from '@/lib/admin/apex'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'apex.full_access')
    const { id } = await params
    const vault = await viewUserVault(id)
    return NextResponse.json(vault)
  } catch (error) {
    return handleAirnexusError(error)
  }
}
