import { NextResponse } from 'next/server'

import { getStudyAnalyticsSummary } from '@/lib/courses/area-sessions'
import { VCE_COURSES } from '@/lib/courses/vce-catalog'
import { getServerAuthSession, SupabaseConfigurationError, SupabaseRequestError } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
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

  try {
    const summary = await getStudyAnalyticsSummary(auth)
    const byCourse = summary.byCourse.map((course) => ({
      ...course,
      courseName: VCE_COURSES.find((item) => item.id === course.courseId)?.name ?? course.courseId,
    }))
    return NextResponse.json({ ...summary, byCourse })
  } catch (error) {
    if (error instanceof SupabaseRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SupabaseConfigurationError) return NextResponse.json({ error: 'AirGPT backend is not configured.' }, { status: 503 })
    console.error('Study analytics summary error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not load study analytics' }, { status: 500 })
  }
}
