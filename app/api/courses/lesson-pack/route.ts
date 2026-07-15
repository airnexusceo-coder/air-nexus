import { NextResponse } from 'next/server'

import { createAiAreaLessonPack, createAiUnitLessonPack, findCourseChapter, findCourseLevel, lessonPackCacheKey, lessonPackCacheKeyForChapter } from '@/lib/courses/ai-lesson-pack'
import { VCE_COURSES } from '@/lib/courses/vce-catalog'
import type { NexusPlan } from '@/lib/plans'
import type { AiUnitLessonPack } from '@/lib/courses/lesson-pack-types'
import { resolveCourseAccessServer } from '@/lib/courses/purchases'
import { getServerAuthSession, SupabaseConfigurationError } from '@/lib/supabase/server'

function asPlan(value: unknown): NexusPlan {
  return value === 'Plus' || value === 'Premium' ? value : 'Free'
}

export const runtime = 'nodejs'
export const maxDuration = 90

const REQUEST_TIMEOUT_MS = 75_000
const lessonPackCache = new Map<string, AiUnitLessonPack>()

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

  const access = await resolveCourseAccessServer(auth, asPlan(body?.plan), course.id, level.unit)
  if (!access.unlocked) return NextResponse.json({ error: 'This unit is not unlocked on your plan yet.' }, { status: 403 })

  const chapter = body?.chapterId ? findCourseChapter(level, body.chapterId) : null
  if (body?.chapterId && !chapter) return NextResponse.json({ error: 'Unknown Area of Study' }, { status: 400 })

  const cacheKey = chapter ? lessonPackCacheKeyForChapter(course, level, chapter) : lessonPackCacheKey(course, level)
  const cached = lessonPackCache.get(cacheKey)
  if (cached) return NextResponse.json({ pack: cached, cached: true })

  const { controller, timeoutId } = createTimeoutSignal()
  try {
    const pack = chapter
      ? await createAiAreaLessonPack(course, level, chapter, controller.signal)
      : await createAiUnitLessonPack(course, level, controller.signal)
    lessonPackCache.set(cacheKey, pack)
    return NextResponse.json({ pack, cached: false })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Lesson generation timed out' }, { status: 504 })
    }
    console.error('Courses lesson pack error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not generate lesson pack' }, { status: 500 })
  } finally {
    clearTimeout(timeoutId)
  }
}
