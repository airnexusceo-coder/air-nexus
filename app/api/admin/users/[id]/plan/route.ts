import { NextResponse } from 'next/server'
import { giftSubscription, getUserGrantStatus, revokeGiftSubscription } from '@/lib/admin/gifts'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'subscriptions.view')
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

    if (body.action === 'gift') {
      requirePermission(admin, 'subscriptions.gift')
      const status = await giftSubscription(admin, id, body.plan, Number(body.durationDays))
      return NextResponse.json(status)
    }

    if (body.action === 'revoke') {
      requirePermission(admin, 'subscriptions.revoke')
      const status = await revokeGiftSubscription(admin, id)
      return NextResponse.json(status)
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}