import { NextResponse } from 'next/server'
import { setDisplayName } from '@/lib/airnexus/social'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    await setDisplayName(auth, typeof body.displayName === 'string' ? body.displayName : '')
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
