import 'server-only'

import { ACTIVE_SUBSCRIPTION_STATUSES, isPaidPlan, type PaidPlan } from '@/lib/billing/plans'
import type { NexusPlan } from '@/lib/plans'
import { readSupabaseRestJson, supabaseAdminAuthFetch, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import { recordAuditLog } from './audit'
import type { AdminUser } from './session'

function encode(value: string) {
  return encodeURIComponent(value)
}

const PLAN_RANK: Record<NexusPlan, number> = { Free: 0, Plus: 1, Premium: 2 }

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
  plan: NexusPlan
  planExpiresAt: string | null
  subscriptionStatus: string | null
  hasActiveSubscription: boolean
  adminGrantedPlan: PaidPlan | null
  adminPlanExpiresAt: string | null
  adminPlanActive: boolean
  pendingNexusPoints: number
  pendingNexusPointGrantCount: number
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
  plan: string | null
  plan_expires_at: string | null
  subscription_status: string | null
  admin_granted_plan: string | null
  admin_plan_expires_at: string | null
}

type PendingPointGrantRow = {
  user_id: string
  amount: number
}

type PendingPointGrantSummary = {
  amount: number
  count: number
}

async function fetchProfilesByIds(ids: string[]): Promise<Map<string, ProfileRow>> {
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) return new Map()
  const idFilter = unique.map(encode).join(',')
  const baseSelect = 'user_id,display_name,suspended_until,suspended_reason,banned_at,banned_reason,deleted_at,plan,plan_expires_at,subscription_status'
  try {
    const response = await supabaseServiceFetch(
      `/profiles?user_id=in.(${idFilter})&select=${baseSelect},admin_granted_plan,admin_plan_expires_at`,
    )
    const rows = await readSupabaseRestJson<ProfileRow[]>(response, 'Failed to load profiles')
    return new Map(rows.map((row) => [row.user_id, row]))
  } catch (error) {
    if (!(error instanceof SupabaseRequestError)) throw error
    // Production may receive the app deploy before the latest Supabase migration.
    // Do not let missing admin gift columns stop admins from loading people.
    const response = await supabaseServiceFetch(`/profiles?user_id=in.(${idFilter})&select=${baseSelect}`)
    const rows = await readSupabaseRestJson<Array<Omit<ProfileRow, 'admin_granted_plan' | 'admin_plan_expires_at'>>>(response, 'Failed to load profiles')
    return new Map(rows.map((row) => [row.user_id, { ...row, admin_granted_plan: null, admin_plan_expires_at: null }]))
  }
}

async function fetchPendingPointGrantsByUserIds(ids: string[]): Promise<Map<string, PendingPointGrantSummary>> {
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) return new Map()
  try {
    const response = await supabaseServiceFetch(`/nexus_point_grants?user_id=in.(${unique.map(encode).join(',')})&claimed_at=is.null&select=user_id,amount`)
    const rows = await readSupabaseRestJson<PendingPointGrantRow[]>(response, 'Failed to load Nexus Points gifts')
    const map = new Map<string, PendingPointGrantSummary>()
    for (const row of rows) {
      const current = map.get(row.user_id) ?? { amount: 0, count: 0 }
      current.amount += Number.isFinite(row.amount) ? row.amount : 0
      current.count += 1
      map.set(row.user_id, current)
    }
    return map
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.message.toLowerCase().includes('nexus_point_grants')) return new Map()
    throw error
  }
}

function resolvePlan(profile: ProfileRow | undefined): Pick<AdminUserView, 'plan' | 'planExpiresAt' | 'subscriptionStatus' | 'hasActiveSubscription' | 'adminGrantedPlan' | 'adminPlanExpiresAt' | 'adminPlanActive'> {
  const subscriptionStatus = profile?.subscription_status ?? null
  const hasActiveSubscription = subscriptionStatus !== null && ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)
  const stripePlan: NexusPlan = hasActiveSubscription && (profile?.plan === 'Plus' || profile?.plan === 'Premium') ? profile.plan : 'Free'
  const adminGrantedPlan = isPaidPlan(profile?.admin_granted_plan) ? profile.admin_granted_plan : null
  const adminPlanExpiresAt = profile?.admin_plan_expires_at ?? null
  const adminPlanActive = Boolean(adminGrantedPlan && adminPlanExpiresAt && new Date(adminPlanExpiresAt).getTime() > Date.now())
  const plan = adminPlanActive && adminGrantedPlan && PLAN_RANK[adminGrantedPlan] > PLAN_RANK[stripePlan] ? adminGrantedPlan : stripePlan
  const planExpiresAt = adminPlanActive && adminGrantedPlan && plan === adminGrantedPlan && PLAN_RANK[adminGrantedPlan] > PLAN_RANK[stripePlan]
    ? adminPlanExpiresAt
    : hasActiveSubscription ? profile?.plan_expires_at ?? null : adminPlanActive ? adminPlanExpiresAt : null

  return {
    plan,
    planExpiresAt,
    subscriptionStatus,
    hasActiveSubscription,
    adminGrantedPlan,
    adminPlanExpiresAt,
    adminPlanActive,
  }
}

function toView(user: GoTrueUser, profile: ProfileRow | undefined, pendingPoints: PendingPointGrantSummary | undefined): AdminUserView {
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
    ...resolvePlan(profile),
    pendingNexusPoints: pendingPoints?.amount ?? 0,
    pendingNexusPointGrantCount: pendingPoints?.count ?? 0,
  }
}

export async function listUsers(page = 1, perPage = 50): Promise<AdminUserView[]> {
  const response = await supabaseAdminAuthFetch(`/users?page=${page}&per_page=${perPage}`)
  const data = await readSupabaseRestJson<{ users: GoTrueUser[] }>(response, 'Failed to load users')
  const ids = data.users.map((user) => user.id)
  const [profiles, pendingPointGifts] = await Promise.all([
    fetchProfilesByIds(ids),
    fetchPendingPointGrantsByUserIds(ids),
  ])
  return data.users.map((user) => toView(user, profiles.get(user.id), pendingPointGifts.get(user.id)))
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
  return toView(user, undefined, undefined)
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