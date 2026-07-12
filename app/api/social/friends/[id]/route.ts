import { NextResponse } from 'next/server'
import { respondFriendRequest } from '@/lib/airnexus/social'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const body = await readBody(request)
    const action = body.action === 'accept' ? 'accept' : body.action === 'block' ? 'block' : null
    if (!action) return NextResponse.json({ error: 'action must be accept or block.' }, { status: 400 })
    await respondFriendRequest(auth, id, action)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
