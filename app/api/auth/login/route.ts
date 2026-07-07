import { NextResponse } from 'next/server'
import {
  sessionFromSupabaseUser,
  setSupabaseAuthCookies,
  signInWithSupabasePassword,
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
    return NextResponse.json({ error: status === 401 ? 'Invalid email or password.' : error.message }, { status })
  }
  console.error('Supabase login error:', error instanceof Error ? error.message : 'Unknown error')
  return NextResponse.json({ error: 'Sign-in failed.' }, { status: 500 })
}

export async function POST(request: Request) {
  const body = await readBody(request)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const remember = body.remember !== false

  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  if (!password) return NextResponse.json({ error: 'Password is required.' }, { status: 400 })

  try {
    const supabaseSession = await signInWithSupabasePassword(email, password)
    const session = sessionFromSupabaseUser(supabaseSession.user)
    if (!session) return NextResponse.json({ error: 'Supabase did not return a valid user.' }, { status: 502 })
    const response = NextResponse.json({ session })
    setSupabaseAuthCookies(response, supabaseSession, remember)
    return response
  } catch (error) {
    return publicAuthError(error)
  }
}
