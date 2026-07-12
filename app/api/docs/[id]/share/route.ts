import { NextResponse } from 'next/server'
import { shareDoc } from '@/lib/docs/docs'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const body = await readBody(request)
    const role = body.role === 'editor' || body.role === 'viewer' ? body.role : 'viewer'
    await shareDoc(auth, id, typeof body.userId === 'string' ? body.userId : '', role)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
