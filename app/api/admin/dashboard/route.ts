import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/admin/dashboard'
import { requireAdminSession } from '@/lib/admin/session'
import { handleAirnexusError } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdminSession()
    const stats = await getDashboardStats()
    return NextResponse.json(stats)
  } catch (error) {
    return handleAirnexusError(error)
  }
}
