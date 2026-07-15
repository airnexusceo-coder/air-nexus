import { NextResponse } from 'next/server'
import { listStudentProgress } from '@/lib/admin/market-masters'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'market_masters.view')
    const students = await listStudentProgress()
    return NextResponse.json({ students })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
