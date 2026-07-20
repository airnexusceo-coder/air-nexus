import { NextResponse } from 'next/server'

import { submitAreaQuizAttempt } from '@/lib/courses/area-sessions'
import { getServerAuthSession, SupabaseConfigurationError, SupabaseRequestError } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readBody(req: Request) {
  try {
    const value: unknown = await req.json()
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  let auth: Awaited<ReturnType<typeof getServerAuthSession>>
  try {
    auth = await getServerAuthSession()
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return NextResponse.json({ error: 'Supabase authentication is not configured' }, { status: 500 })
    }
    throw error
  }
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await readBody(req)
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  if (!Array.isArray(body?.answers)) return NextResponse.json({ error: 'answers is required' }, { status: 400 })

  try {
    const result = await submitAreaQuizAttempt(auth, sessionId, body.answers)
    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof SupabaseRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SupabaseConfigurationError) return NextResponse.json({ error: 'AirGPT backend is not configured.' }, { status: 503 })
    console.error('Courses area quiz submit error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not submit your quiz' }, { status: 500 })
  }
}
