import { NextResponse } from 'next/server'
import { getUserGrantStatus, grantNexusPoints, removeNexusPoints } from '@/lib/admin/gifts'
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
    const { id } = await params
    const body = await readBody(request)
    const amount = Number(body.amount)
    const description = typeof body.description === 'string' ? body.description : ''

    if (body.action === 'remove') {
      requirePermission(admin, 'nexus_points.remove')
      const status = await removeNexusPoints(admin, id, amount, description)
      return NextResponse.json(status)
    }

    requirePermission(admin, 'nexus_points.grant')
    const status = await grantNexusPoints(admin, id, amount, description)
    return NextResponse.json(status)
  } catch (error) {
    return handleAirnexusError(error)
  }
}
