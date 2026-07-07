import { NextResponse } from 'next/server'
import {
  clearSupabaseAuthCookies,
  getServerAuthSession,
} from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST() {
  const current = await getServerAuthSession().catch(() => null)
  if (current) {
    // The local cookie is the source of truth for the Next.js app. Supabase will
    // also expire refresh tokens server-side; failure here should not keep the
    // browser signed in.
    await fetch(`${process.env.SUPABASE_URL?.replace(/\/+$/, '')}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${current.accessToken}`,
      },
      cache: 'no-store',
    }).catch(() => null)
  }

  const response = NextResponse.json({ ok: true })
  clearSupabaseAuthCookies(response)
  return response
}
