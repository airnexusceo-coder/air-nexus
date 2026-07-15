import { NextResponse } from 'next/server'

import { getCourseSelection, setFreeSubject, setPlusSelection } from '@/lib/courses/purchases'
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

async function requireSession() {
  const auth = await getServerAuthSession()
  if (!auth) throw new SupabaseRequestError('Authentication required', 401)
  return auth
}

function handleError(error: unknown) {
  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json({ error: 'Supabase authentication is not configured' }, { status: 500 })
  }
  if (error instanceof SupabaseRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('Course selection error:', error instanceof Error ? error.message : 'Unknown error')
  return NextResponse.json({ error: 'Could not save your course selection' }, { status: 500 })
}

export async function GET() {
  try {
    const auth = await requireSession()
    const selection = await getCourseSelection(auth)
    return NextResponse.json({ selection })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession()
    const body = await readBody(req)
    const kind = body?.kind

    if (kind === 'free') {
      await setFreeSubject(auth, typeof body?.courseId === 'string' ? body.courseId : '')
    } else if (kind === 'plus') {
      const unit = typeof body?.unit === 'number' ? body.unit : Number(body?.unit)
      await setPlusSelection(auth, typeof body?.courseId === 'string' ? body.courseId : '', unit as 1 | 2 | 3 | 4)
    } else {
      return NextResponse.json({ error: 'Unknown selection kind' }, { status: 400 })
    }

    const selection = await getCourseSelection(auth)
    return NextResponse.json({ selection })
  } catch (error) {
    return handleError(error)
  }
}
