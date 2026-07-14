import { NextResponse } from 'next/server'
import { findProfileByEmail } from '@/lib/airnexus/social'
import { handleAirnexusError, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    const email = new URL(request.url).searchParams.get('email') ?? ''
    const result = await findProfileByEmail(auth, email)
    return NextResponse.json({ result })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
