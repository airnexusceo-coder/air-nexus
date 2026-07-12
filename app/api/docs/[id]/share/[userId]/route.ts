import { NextResponse } from 'next/server'
import { unshareDoc } from '@/lib/docs/docs'
import { handleAirnexusError, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const auth = await requireAuth()
    const { id, userId } = await params
    await unshareDoc(auth, id, userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
