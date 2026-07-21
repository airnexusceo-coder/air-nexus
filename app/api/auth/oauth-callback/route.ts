import { NextResponse } from 'next/server'
import {
  getSupabaseUser,
  setSupabaseAuthCookies,
  SupabaseConfigurationError,
  SupabaseRequestError,
} from '@/lib/supabase/server'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readBody(request: Request) {
  try {
    const value: unknown = await request.json()
    return isRecord(value) ? value : {}
  } catch {
    return {}
  }
}

function publicAuthError(error: unknown) {
  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json({ error: 'Supabase authentication is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.' }, { status: 503 })
  }
  if (error instanceof SupabaseRequestError) {
    const status = error.status === 400 || error.status === 401 ? 401 : error.status >= 500 ? 502 : error.status
    return NextResponse.json({ error: status === 401 ? 'That Google sign-in could not be verified.' : error.message }, { status })
  }
  console.error('Google OAuth callback error:', error instanceof Error ? error.message : 'Unknown error')
  return NextResponse.json({ error: 'Sign-in failed.' }, { status: 500 })
}

/**
 * The browser lands here after `app/auth/callback/page.tsx` parses the
 * access/refresh tokens Supabase's hosted Google OAuth flow returned in the
 * URL fragment (fragments never reach the server directly). This route just
 * verifies that access token against Supabase and issues the exact same
 * httpOnly session cookies the password sign-in flow already sets — Google
 * sign-in and password sign-in end up as the same kind of session.
 */
export async function POST(request: Request) {
  const body = await readBody(request)
  const accessToken = typeof body.access_token === 'string' ? body.access_token : ''
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : ''
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : undefined

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: 'Google did not return a complete sign-in.' }, { status: 400 })
  }

  try {
    const session = await getSupabaseUser(accessToken)
    if (!session) return NextResponse.json({ error: 'Could not verify the Google sign-in.' }, { status: 502 })
    const response = NextResponse.json({ session })
    setSupabaseAuthCookies(response, { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn }, true)
    return response
  } catch (error) {
    return publicAuthError(error)
  }
}
