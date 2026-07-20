import { NextResponse } from 'next/server'

import { findCourseChapter, findCourseLevel } from '@/lib/courses/ai-lesson-pack'
import { getOrCreateTodaySession } from '@/lib/courses/area-sessions'
import { VCE_COURSES } from '@/lib/courses/vce-catalog'
import type { NexusPlan } from '@/lib/plans'
import { resolveCourseAccessServer } from '@/lib/courses/purchases'
import { getServerAuthSession, SupabaseConfigurationError, SupabaseRequestError } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 90

const REQUEST_TIMEOUT_MS = 75_000

function asPlan(value: unknown): NexusPlan {
  return value === 'Plus' || value === 'Premium' ? value : 'Free'
}

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

function createTimeoutSignal() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return { controller, timeoutId }
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
  const courseId = typeof body?.courseId === 'string' ? body.courseId : ''
  const course = VCE_COURSES.find((item) => item.id === courseId)
  if (!course) return NextResponse.json({ error: 'Unknown VCE course' }, { status: 400 })

  const level = findCourseLevel(course, body?.unit)
  if (!level) return NextResponse.json({ error: 'Unknown VCE unit' }, { status: 400 })

  const chapter = findCourseChapter(level, body?.areaId)
  if (!chapter) return NextResponse.json({ error: 'Unknown Area of Study' }, { status: 400 })

  const access = await resolveCourseAccessServer(auth, asPlan(body?.plan), course.id, level.unit)
  if (!access.unlocked) return NextResponse.json({ error: 'This unit is not unlocked on your plan yet.' }, { status: 403 })

  const { controller, timeoutId } = createTimeoutSignal()
  try {
    const session = await getOrCreateTodaySession(auth, course, level, chapter, controller.signal)
    return NextResponse.json({ session })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: "Today's lesson is taking longer than expected to generate — try again in a moment." }, { status: 504 })
    }
    if (error instanceof SupabaseRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SupabaseConfigurationError) return NextResponse.json({ error: 'AirGPT backend is not configured.' }, { status: 503 })
    console.error("Courses area session error:", error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: "Could not load today's study session" }, { status: 500 })
  } finally {
    clearTimeout(timeoutId)
  }
}
