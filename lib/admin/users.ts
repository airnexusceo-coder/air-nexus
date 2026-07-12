import 'server-only'

import { readSupabaseRestJson, supabaseAdminAuthFetch, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import { recordAuditLog } from './audit'
import type { AdminUser } from './session'

function encode(value: string) {
  return encodeURIComponent(value)
}

export type AdminUserView = {
  id: string
  email: string
  displayName: string
  createdAt: string
  suspendedUntil: string | null
  suspendedReason: string | null
  bannedAt: string | null
  bannedReason: string | null
  deletedAt: string | null
}

type GoTrueUser = { id: string; email?: string; created_at: string; user_metadata?: { full_name?: string } }
type ProfileRow = {
  user_id: string
  display_name: string
  suspended_until: string | null
  suspended_reason: string | null
  banned_at: string | null
  banned_reason: string | null
  deleted_at: string | null
}

async function fetchProfilesByIds(ids: string[]): Promise<Map<string, ProfileRow>> {
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) return new Map()
  const response = await supabaseServiceFetch(
    `/profiles?user_id=in.(${unique.map(encode).join(',')})&select=user_id,display_name,suspended_until,suspended_reason,banned_at,banned_reason,deleted_at`,
  )
  const rows = await readSupabaseRestJson<ProfileRow[]>(response, 'Failed to load profiles')
  return new Map(rows.map((row) => [row.user_id, row]))
}

function toView(user: GoTrueUser, profile: ProfileRow | undefined): AdminUserView {
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: profile?.display_name ?? user.user_metadata?.full_name ?? 'AirNexus student',
    createdAt: user.created_at,
    suspendedUntil: profile?.suspended_until ?? null,
    suspendedReason: profile?.suspended_reason ?? null,
    bannedAt: profile?.banned_at ?? null,
    bannedReason: profile?.banned_reason ?? null,
    deletedAt: profile?.deleted_at ?? null,
  }
}

export async function listUsers(page = 1, perPage = 50): Promise<AdminUserView[]> {
  const response = await supabaseAdminAuthFetch(`/users?page=${page}&per_page=${perPage}`)
  const data = await readSupabaseRestJson<{ users: GoTrueUser[] }>(response, 'Failed to load users')
  const profiles = await fetchProfilesByIds(data.users.map((user) => user.id))
  return data.users.map((user) => toView(user, profiles.get(user.id)))
}

export async function createUser(admin: AdminUser, email: string, password: string, displayName?: string): Promise<AdminUserView> {
  const trimmedEmail = email.trim()
  if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) throw new SupabaseRequestError('Enter a valid email address.', 400)
  if (password.length < 8) throw new SupabaseRequestError('Password must be at least 8 characters.', 400)

  const response = await supabaseAdminAuthFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: displayName ? { full_name: displayName } : undefined,
    }),
  })
  const user = await readSupabaseRestJson<GoTrueUser>(response, 'Could not create user')
  await recordAuditLog(admin, 'users.create', 'user', user.id, { email: trimmedEmail })
  // profiles/apex_profiles rows are seeded automatically by the existing
  // ensure_airnexus_defaults trigger (0002) on auth.users insert.
  return toView(user, undefined)
}

export async function editUserDisplayName(admin: AdminUser, userId: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim()
  if (!trimmed || trimmed.length > 80) throw new SupabaseRequestError('Enter a name (1-80 characters).', 400)
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ display_name: trimmed }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not update user')
  await recordAuditLog(admin, 'users.edit', 'user', userId, { displayName: trimmed })
}

export async function suspendUser(admin: AdminUser, userId: string, hours: number, reason: string): Promise<void> {
  if (!Number.isFinite(hours) || hours <= 0) throw new SupabaseRequestError('Enter a suspension length greater than 0 hours.', 400)
  const suspendedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ suspended_until: suspendedUntil, suspended_reason: reason || null }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not suspend user')
  await recordAuditLog(admin, 'users.suspend', 'user', userId, { suspendedUntil, reason })
}

export async function unsuspendUser(admin: AdminUser, userId: string): Promise<void> {
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ suspended_until: null, suspended_reason: null }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not lift suspension')
  await recordAuditLog(admin, 'users.suspend', 'user', userId, { lifted: true })
}

export async function banUser(admin: AdminUser, userId: string, reason: string): Promise<void> {
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ banned_at: new Date().toISOString(), banned_reason: reason || null }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not ban user')
  await recordAuditLog(admin, 'users.ban', 'user', userId, { reason })
}

export async function unbanUser(admin: AdminUser, userId: string): Promise<void> {
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ banned_at: null, banned_reason: null }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not unban user')
  await recordAuditLog(admin, 'users.ban', 'user', userId, { lifted: true })
}

/**
 * Soft delete only — anonymises the display name and marks deleted_at, which
 * requireAuth() checks on every subsequent request. Never a hard cascading
 * DELETE of a real person's account; that's a much bigger, harder-to-reverse
 * decision than an admin console action should make silently.
 */
export async function deleteUser(admin: AdminUser, userId: string): Promise<void> {
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ deleted_at: new Date().toISOString(), display_name: 'Deleted user' }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not delete user')
  await recordAuditLog(admin, 'users.delete', 'user', userId, {})
}
