import { NextResponse } from 'next/server'
import { buildSupabaseOAuthUrl, SupabaseConfigurationError } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function safeNextPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/airgpt'
}

/** Starts Supabase's hosted Google OAuth flow — a plain-link GET so it works as a normal `<a href>` navigation, no client-side fetch needed. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = safeNextPath(url.searchParams.get('next'))

  try {
    const redirectTo = `${url.origin}/auth/callback?next=${encodeURIComponent(next)}`
    return NextResponse.redirect(buildSupabaseOAuthUrl('google', redirectTo))
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      const loginUrl = new URL('/login', url.origin)
      loginUrl.searchParams.set('error', 'Google sign-in is not configured yet.')
      return NextResponse.redirect(loginUrl)
    }
    throw error
  }
}
