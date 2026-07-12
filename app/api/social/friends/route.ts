import { NextResponse } from 'next/server'
import { getAcceptedFriends, sendFriendRequest, sendFriendRequestById } from '@/lib/airnexus/social'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const friends = await getAcceptedFriends(auth)
    return NextResponse.json({ friends })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

/** Accepts either { email } (Search tab's "add by email") or { userId } (from a search result / profile). */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    if (typeof body.userId === 'string' && body.userId) {
      await sendFriendRequestById(auth, body.userId)
    } else {
      await sendFriendRequest(auth, typeof body.email === 'string' ? body.email : '')
    }
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
