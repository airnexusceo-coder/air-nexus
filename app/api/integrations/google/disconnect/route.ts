import { NextResponse } from 'next/server'
import { getServerAuthSession } from '@/lib/supabase/server'
import { disconnectGoogle } from '@/lib/integrations/google-drive'
import { handleAirnexusError } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const auth = await getServerAuthSession()
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    await disconnectGoogle(auth)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
