import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'
import type { NexusPlan } from '@/lib/plans'
import { COURSE_PURCHASE_COST, currentCourseMonthKey, resolveCourseAccess, type CourseAccessSelection } from '@/lib/courses/vce-catalog'
import { nextHolidayEndDate } from '@/lib/courses/school-calendar'

function encode(value: string) {
  return encodeURIComponent(value)
}

type SelectionRow = {
  free_subject_course_id: string | null
  plus_month_key: string | null
  plus_course_id: string | null
  plus_unit: 1 | 2 | 3 | 4 | null
}

type PurchaseRow = {
  id: string
  course_id: string
  points_spent: number
  purchased_at: string
  expires_at: string
}

export type CoursePurchaseDTO = {
  id: string
  courseId: string
  pointsSpent: number
  purchasedAt: string
  expiresAt: string
}

export async function getCourseSelection(auth: ServerAuthSession): Promise<CourseAccessSelection> {
  const response = await supabaseRestFetch(auth.accessToken, `/course_selections?user_id=eq.${encode(auth.user.id)}&select=free_subject_course_id,plus_month_key,plus_course_id,plus_unit`)
  const rows = await readSupabaseRestJson<SelectionRow[]>(response, 'Could not load course selection')
  const row = rows[0]
  return {
    freeSubjectId: row?.free_subject_course_id ?? null,
    plusMonthKey: row?.plus_month_key ?? null,
    plusCourseId: row?.plus_course_id ?? null,
    plusUnit: row?.plus_unit ?? null,
  }
}

async function upsertSelection(auth: ServerAuthSession, patch: Record<string, unknown>): Promise<void> {
  const existingResponse = await supabaseRestFetch(auth.accessToken, `/course_selections?user_id=eq.${encode(auth.user.id)}&select=user_id`)
  const existing = await readSupabaseRestJson<{ user_id: string }[]>(existingResponse, 'Could not load course selection')
  if (existing.length === 0) {
    const response = await supabaseRestFetch(auth.accessToken, '/course_selections', {
      method: 'POST',
      body: JSON.stringify({ user_id: auth.user.id, ...patch }),
    })
    if (!response.ok) await readSupabaseRestJson(response, 'Could not save course selection')
    return
  }
  const response = await supabaseRestFetch(auth.accessToken, `/course_selections?user_id=eq.${encode(auth.user.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not save course selection')
}

export async function setFreeSubject(auth: ServerAuthSession, courseId: string): Promise<void> {
  if (typeof courseId !== 'string' || !courseId) throw new SupabaseRequestError('A course is required.', 400)
  await upsertSelection(auth, { free_subject_course_id: courseId })
}

export async function setPlusSelection(auth: ServerAuthSession, courseId: string, unit: 1 | 2 | 3 | 4): Promise<void> {
  if (typeof courseId !== 'string' || !courseId) throw new SupabaseRequestError('A course is required.', 400)
  if (![1, 2, 3, 4].includes(unit)) throw new SupabaseRequestError('A valid unit is required.', 400)
  await upsertSelection(auth, { plus_month_key: currentCourseMonthKey(), plus_course_id: courseId, plus_unit: unit })
}

export async function listCoursePurchases(auth: ServerAuthSession): Promise<CoursePurchaseDTO[]> {
  const response = await supabaseRestFetch(auth.accessToken, `/course_purchases?user_id=eq.${encode(auth.user.id)}&select=*&order=purchased_at.desc`)
  const rows = await readSupabaseRestJson<PurchaseRow[]>(response, 'Could not load course purchases')
  return rows.map((row) => ({
    id: row.id,
    courseId: row.course_id,
    pointsSpent: row.points_spent,
    purchasedAt: row.purchased_at,
    expiresAt: row.expires_at,
  }))
}

export async function purchaseCourse(auth: ServerAuthSession, courseId: string): Promise<CoursePurchaseDTO> {
  if (typeof courseId !== 'string' || !courseId) throw new SupabaseRequestError('A course is required.', 400)
  const expiresAt = nextHolidayEndDate().toISOString()
  const response = await supabaseRestFetch(auth.accessToken, '/course_purchases', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: auth.user.id, course_id: courseId, points_spent: COURSE_PURCHASE_COST, expires_at: expiresAt }),
  })
  const rows = await readSupabaseRestJson<PurchaseRow[]>(response, 'Could not record course purchase')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Could not record course purchase.', 502)
  return { id: row.id, courseId: row.course_id, pointsSpent: row.points_spent, purchasedAt: row.purchased_at, expiresAt: row.expires_at }
}

function hasActivePurchase(purchases: CoursePurchaseDTO[], courseId: string): boolean {
  const now = Date.now()
  return purchases.some((purchase) => purchase.courseId === courseId && new Date(purchase.expiresAt).getTime() > now)
}

/** Server-side mirror of vce-catalog's resolveCourseAccess, now checking real persisted selections/purchases instead of trusting client-supplied state. */
export async function resolveCourseAccessServer(auth: ServerAuthSession, plan: NexusPlan, courseId: string, unit: 1 | 2 | 3 | 4) {
  const [selection, purchases] = await Promise.all([getCourseSelection(auth), listCoursePurchases(auth)])
  if (hasActivePurchase(purchases, courseId)) return { unlocked: true, reason: 'purchased' as const, requiredPlan: null }
  const access = resolveCourseAccess(plan, courseId, unit, selection)
  return access
}
