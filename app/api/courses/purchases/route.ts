import { NextResponse } from 'next/server'

import { listCoursePurchases, purchaseCourse } from '@/lib/courses/purchases'
import { VCE_COURSES } from '@/lib/courses/vce-catalog'
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
  console.error('Course purchase error:', error instanceof Error ? error.message : 'Unknown error')
  return NextResponse.json({ error: 'Could not complete this purchase' }, { status: 500 })
}

export async function GET() {
  try {
    const auth = await requireSession()
    const purchases = await listCoursePurchases(auth)
    return NextResponse.json({ purchases })
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Records a course purchase. The Nexus Points spend itself is asserted by
 * the client, same trust model as every other Nexus Points spend in this
 * app (Marketplace cosmetics, Apex technology purchases) — there is no
 * server-side points ledger anywhere in AirNexus yet. What this endpoint
 * makes real and server-authoritative is the *unlock*: once recorded, the
 * course is genuinely accessible (see resolveCourseAccessServer) until the
 * stored expiry, independent of client-side state.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireSession()
    const body = await readBody(req)
    const courseId = typeof body?.courseId === 'string' ? body.courseId : ''
    const course = VCE_COURSES.find((item) => item.id === courseId)
    if (!course) return NextResponse.json({ error: 'Unknown VCE course' }, { status: 400 })

    const purchase = await purchaseCourse(auth, courseId)
    return NextResponse.json({ purchase }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
