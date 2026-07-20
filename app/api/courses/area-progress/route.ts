import { NextResponse } from 'next/server'

import { findCourseLevel } from '@/lib/courses/ai-lesson-pack'
import { listAreaProgress } from '@/lib/courses/area-sessions'
import { VCE_COURSES } from '@/lib/courses/vce-catalog'
import { getServerAuthSession, SupabaseConfigurationError, SupabaseRequestError } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
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

  const url = new URL(req.url)
  const courseId = url.searchParams.get('courseId') ?? ''
  const course = VCE_COURSES.find((item) => item.id === courseId)
  if (!course) return NextResponse.json({ error: 'Unknown VCE course' }, { status: 400 })

  const level = findCourseLevel(course, url.searchParams.get('unit'))
  if (!level) return NextResponse.json({ error: 'Unknown VCE unit' }, { status: 400 })

  try {
    const progress = await listAreaProgress(auth, course.id, level.unit)
    return NextResponse.json({ progress })
  } catch (error) {
    if (error instanceof SupabaseRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SupabaseConfigurationError) return NextResponse.json({ error: 'AirGPT backend is not configured.' }, { status: 503 })
    console.error('Courses area progress error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not load your study progress' }, { status: 500 })
  }
}
