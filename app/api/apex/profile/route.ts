import { NextResponse } from 'next/server'
import { readSupabaseRestJson, supabaseRestFetch } from '@/lib/supabase/server'
import { deriveApexRank } from '@/lib/apex/config'
import { handleApexError } from '@/lib/apex/vault/errors'
import { requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

function encode(value: string) {
  return encodeURIComponent(value)
}

export async function GET() {
  try {
    const auth = await requireAuth()
    const response = await supabaseRestFetch(auth.accessToken, `/apex_profiles?user_id=eq.${encode(auth.user.id)}&select=apex_xp`)
    const rows = await readSupabaseRestJson<{ apex_xp: number }[]>(response, 'Failed to load Apex progression')
    const xp = Number(rows[0]?.apex_xp ?? 0)
    return NextResponse.json({ xp, ...deriveApexRank(xp) })
  } catch (error) {
    return handleApexError(error)
  }
}