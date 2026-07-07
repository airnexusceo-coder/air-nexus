import { NextResponse } from 'next/server'
import {
  sessionFromSupabaseUser,
  setSupabaseAuthCookies,
  signUpWithSupabasePassword,
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
    const status = error.status >= 500 ? 502 : error.status
    return NextResponse.json({ error: error.message }, { status })
  }
  console.error('Supabase signup error:', error instanceof Error ? error.message : 'Unknown error')
  return NextResponse.json({ error: 'Account creation failed.' }, { status: 500 })
}

export async function POST(request: Request) {
  const body = await readBody(request)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const remember = body.remember !== false

  if (!name) return NextResponse.json({ error: 'Enter your name.' }, { status: 400 })
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

  try {
    const supabaseSession = await signUpWithSupabasePassword(name, email, password)
    if (typeof supabaseSession.access_token !== 'string') {
      return NextResponse.json({
        pendingVerification: true,
        message: 'Account created. Check your email to confirm your Supabase account, then sign in.',
      }, { status: 202 })
    }

    const session = sessionFromSupabaseUser(supabaseSession.user)
    if (!session) return NextResponse.json({ error: 'Supabase did not return a valid user.' }, { status: 502 })
    const response = NextResponse.json({ session })
    setSupabaseAuthCookies(response, supabaseSession, remember)
    return response
  } catch (error) {
    return publicAuthError(error)
  }
}
