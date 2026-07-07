import { NextResponse } from 'next/server'
import {
  clearSupabaseAuthCookies,
  getServerAuthSession,
  refreshSupabaseSession,
  sessionFromSupabaseUser,
  setSupabaseAuthCookies,
  SUPABASE_REFRESH_COOKIE,
  SupabaseConfigurationError,
} from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const current = await getServerAuthSession()
    if (current) return NextResponse.json({ session: current.user })

    const cookieStore = await cookies()
    const refreshToken = cookieStore.get(SUPABASE_REFRESH_COOKIE)?.value
    if (!refreshToken) return NextResponse.json({ session: null }, { status: 401 })

    const refreshed = await refreshSupabaseSession(refreshToken)
    const session = sessionFromSupabaseUser(refreshed.user)
    if (!session) {
      const response = NextResponse.json({ session: null }, { status: 401 })
      clearSupabaseAuthCookies(response)
      return response
    }

    const response = NextResponse.json({ session })
    setSupabaseAuthCookies(response, refreshed, true)
    return response
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return NextResponse.json({ error: 'Supabase authentication is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.' }, { status: 503 })
    }
    const response = NextResponse.json({ session: null }, { status: 401 })
    clearSupabaseAuthCookies(response)
    return response
  }
}
