import { NextResponse } from 'next/server'
import { grantXp, removeXp, setUserXp, viewUserXp } from '@/lib/admin/xp'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'xp.view')
    const { id } = await params
    const xp = await viewUserXp(id)
    return NextResponse.json({ xp })
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

    if (body.action === 'grant') {
      requirePermission(admin, 'xp.grant')
      await grantXp(admin, id, amount)
    } else if (body.action === 'remove') {
      requirePermission(admin, 'xp.remove')
      await removeXp(admin, id, amount)
    } else if (body.action === 'set') {
      requirePermission(admin, 'xp.set')
      await setUserXp(admin, id, amount)
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    const xp = await viewUserXp(id)
    return NextResponse.json({ xp })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
