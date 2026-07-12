import 'server-only'

import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import { hasPermission } from './permission-check'
import type { AdminPermission } from './permissions'

/**
 * Admin sessions are a fully separate system from Supabase Auth — a
 * different cookie, a different table, checked independently. A normal
 * AirNexus user (even one with role:'owner') has no path into an admin
 * route without also holding a valid admin session.
 */

export const ADMIN_SESSION_COOKIE = 'airnexus-admin-session'
const SESSION_TTL_HOURS = 12

export type AdminUser = {
  id: string
  username: string
  role: 'super_admin' | 'admin'
  permissions: string[]
  isActive: boolean
}

function encode(value: string) {
  return encodeURIComponent(value)
}

type SessionRow = {
  token: string
  expires_at: string
  admin_users: { id: string; username: string; role: string; permissions: string[]; is_active: boolean }
}

export async function requireAdminSession(): Promise<AdminUser> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) throw new SupabaseRequestError('Admin sign-in required.', 401)

  const response = await supabaseServiceFetch(
    `/admin_sessions?token=eq.${encode(token)}&select=token,expires_at,admin_users(id,username,role,permissions,is_active)`,
  )
  const rows = await readSupabaseRestJson<SessionRow[]>(response, 'Failed to verify admin session')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Admin sign-in required.', 401)
  if (new Date(row.expires_at).getTime() <= Date.now()) throw new SupabaseRequestError('Admin session expired — sign in again.', 401)
  if (!row.admin_users.is_active) throw new SupabaseRequestError('This admin account has been deactivated.', 403)

  return {
    id: row.admin_users.id,
    username: row.admin_users.username,
    role: row.admin_users.role as AdminUser['role'],
    permissions: row.admin_users.permissions,
    isActive: row.admin_users.is_active,
  }
}

export function requirePermission(admin: AdminUser, permission: AdminPermission): void {
  if (hasPermission(admin, permission)) return
  throw new SupabaseRequestError(`Missing permission: ${permission}`, 403)
}

export async function createAdminSession(adminUserId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const response = await supabaseServiceFetch('/admin_sessions', {
    method: 'POST',
    body: JSON.stringify({ token, admin_user_id: adminUserId, expires_at: expiresAt }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not create admin session')
  return { token, expiresAt }
}

export async function deleteAdminSession(token: string): Promise<void> {
  await supabaseServiceFetch(`/admin_sessions?token=eq.${encode(token)}`, { method: 'DELETE' }).catch(() => undefined)
}

export function setAdminSessionCookie(response: NextResponse, token: string, expiresAt: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  })
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
