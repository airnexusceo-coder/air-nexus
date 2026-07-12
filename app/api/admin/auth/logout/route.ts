import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_SESSION_COOKIE, clearAdminSessionCookie, deleteAdminSession } from '@/lib/admin/session'

export const runtime = 'nodejs'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (token) await deleteAdminSession(token)
  const response = NextResponse.json({ ok: true })
  clearAdminSessionCookie(response)
  return response
}
