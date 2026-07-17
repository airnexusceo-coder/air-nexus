import { NextResponse } from 'next/server'
import { getUserGrantStatus, grantNexusPoints } from '@/lib/admin/gifts'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'nexus_points.view')
    const { id } = await params
    const status = await getUserGrantStatus(id)
    return NextResponse.json(status)
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'nexus_points.grant')
    const { id } = await params
    const body = await readBody(request)
    const status = await grantNexusPoints(
      admin,
      id,
      Number(body.amount),
      typeof body.description === 'string' ? body.description : '',
    )
    return NextResponse.json(status)
  } catch (error) {
    return handleAirnexusError(error)
  }
}