import { NextResponse } from 'next/server'
import { cancelClash, forceClashResult } from '@/lib/admin/clashes'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

const VALID_RESULTS = ['breached', 'contained', 'retreated'] as const

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession()
    const { id } = await params
    const body = await readBody(request)

    if (body.action === 'cancel') {
      requirePermission(admin, 'clashes.cancel')
      await cancelClash(admin, id)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'force_result') {
      requirePermission(admin, 'clashes.force_result')
      const result = typeof body.result === 'string' && VALID_RESULTS.includes(body.result as (typeof VALID_RESULTS)[number]) ? body.result : null
      if (!result) return NextResponse.json({ error: 'result must be breached, contained, or retreated.' }, { status: 400 })
      await forceClashResult(admin, id, result as (typeof VALID_RESULTS)[number])
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
