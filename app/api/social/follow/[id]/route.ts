import { NextResponse } from 'next/server'
import { followUser, unfollowUser } from '@/lib/airnexus/social'
import { handleAirnexusError, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    await followUser(auth, id)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    await unfollowUser(auth, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
