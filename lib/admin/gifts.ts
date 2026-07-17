import 'server-only'

import { ACTIVE_SUBSCRIPTION_STATUSES, isPaidPlan, type PaidPlan } from '@/lib/billing/plans'
import type { NexusPlan } from '@/lib/plans'
import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import { recordAuditLog } from './audit'
import type { AdminUser } from './session'

function encode(value: string) {
  return encodeURIComponent(value)
}

const PLAN_RANK: Record<NexusPlan, number> = { Free: 0, Plus: 1, Premium: 2 }
const MAX_GIFT_DAYS = 3650
const MAX_POINTS_ADJUSTMENT = 1_000_000

type ProfileGiftRow = {
  plan: string | null
  plan_expires_at: string | null
  subscription_status: string | null
  admin_granted_plan: string | null
  admin_plan_expires_at: string | null
}

type PendingGrantRow = {
  amount: number
}

export type AdminGrantStatus = {
  stripePlan: NexusPlan
  stripePlanExpiresAt: string | null
  subscriptionStatus: string | null
  hasActiveSubscription: boolean
  adminGrantedPlan: PaidPlan | null
  adminPlanExpiresAt: string | null
  adminPlanActive: boolean
  effectivePlan: NexusPlan
  pendingNexusPoints: number
  pendingGrantCount: number
}

function asPlan(value: unknown): NexusPlan {
  return value === 'Plus' || value === 'Premium' ? value : 'Free'
}

function activeAdminGift(row: ProfileGiftRow | undefined) {
  const plan = isPaidPlan(row?.admin_granted_plan) ? row.admin_granted_plan : null
  const expiresAt = row?.admin_plan_expires_at ?? null
  const active = Boolean(plan && expiresAt && new Date(expiresAt).getTime() > Date.now())
  return { plan, expiresAt, active }
}

function effectivePlanFor(row: ProfileGiftRow | undefined): Pick<AdminGrantStatus, 'stripePlan' | 'stripePlanExpiresAt' | 'subscriptionStatus' | 'hasActiveSubscription' | 'adminGrantedPlan' | 'adminPlanExpiresAt' | 'adminPlanActive' | 'effectivePlan'> {
  const subscriptionStatus = row?.subscription_status ?? null
  const hasActiveSubscription = subscriptionStatus !== null && ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)
  const stripePlan = hasActiveSubscription ? asPlan(row?.plan) : 'Free'
  const gift = activeAdminGift(row)
  const effectivePlan = gift.active && gift.plan && PLAN_RANK[gift.plan] > PLAN_RANK[stripePlan] ? gift.plan : stripePlan

  return {
    stripePlan,
    stripePlanExpiresAt: hasActiveSubscription ? row?.plan_expires_at ?? null : null,
    subscriptionStatus,
    hasActiveSubscription,
    adminGrantedPlan: gift.plan,
    adminPlanExpiresAt: gift.expiresAt,
    adminPlanActive: gift.active,
    effectivePlan,
  }
}

async function fetchProfileGiftRow(userId: string): Promise<ProfileGiftRow | undefined> {
  try {
    const response = await supabaseServiceFetch(
      `/profiles?user_id=eq.${encode(userId)}&select=plan,plan_expires_at,subscription_status,admin_granted_plan,admin_plan_expires_at`,
    )
    const rows = await readSupabaseRestJson<ProfileGiftRow[]>(response, 'Failed to load user plan grants')
    return rows[0]
  } catch (error) {
    if (!(error instanceof SupabaseRequestError)) throw error
    const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}&select=plan,plan_expires_at,subscription_status`)
    const rows = await readSupabaseRestJson<Array<Omit<ProfileGiftRow, 'admin_granted_plan' | 'admin_plan_expires_at'>>>(response, 'Failed to load user plan grants')
    const row = rows[0]
    return row ? { ...row, admin_granted_plan: null, admin_plan_expires_at: null } : undefined
  }
}

async function fetchPendingPointGrantSummary(userId: string): Promise<{ pendingNexusPoints: number; pendingGrantCount: number }> {
  try {
    const response = await supabaseServiceFetch(`/nexus_point_grants?user_id=eq.${encode(userId)}&claimed_at=is.null&select=amount`)
    const rows = await readSupabaseRestJson<PendingGrantRow[]>(response, 'Failed to load Nexus Points grants')
    return {
      pendingNexusPoints: rows.reduce((total, row) => total + (Number.isFinite(row.amount) ? row.amount : 0), 0),
      pendingGrantCount: rows.length,
    }
  } catch (error) {
    // Keep admin user lists usable before the latest Supabase migrations are applied.
    if (error instanceof SupabaseRequestError && error.message.toLowerCase().includes('nexus_point_grants')) {
      return { pendingNexusPoints: 0, pendingGrantCount: 0 }
    }
    throw error
  }
}

export async function getUserGrantStatus(userId: string): Promise<AdminGrantStatus> {
  const [profile, pending] = await Promise.all([
    fetchProfileGiftRow(userId),
    fetchPendingPointGrantSummary(userId),
  ])
  return { ...effectivePlanFor(profile), ...pending }
}

export async function giftSubscription(admin: AdminUser, userId: string, plan: unknown, durationDays: number): Promise<AdminGrantStatus> {
  if (!isPaidPlan(plan)) throw new SupabaseRequestError('Choose Plus or Premium for a gifted subscription.', 400)
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > MAX_GIFT_DAYS) {
    throw new SupabaseRequestError(`Gift duration must be between 1 and ${MAX_GIFT_DAYS} days.`, 400)
  }

  const roundedDays = Math.round(durationDays)
  const expiresAt = new Date(Date.now() + roundedDays * 24 * 60 * 60 * 1000).toISOString()
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      admin_granted_plan: plan,
      admin_plan_expires_at: expiresAt,
      admin_plan_granted_at: new Date().toISOString(),
      admin_plan_granted_by: admin.id,
    }),
  })
  const rows = await readSupabaseRestJson<unknown[]>(response, 'Could not gift subscription')
  if (rows.length === 0) throw new SupabaseRequestError('User profile was not found.', 404)

  await recordAuditLog(admin, 'subscriptions.gift', 'user', userId, { plan, durationDays: roundedDays, expiresAt })
  return getUserGrantStatus(userId)
}

export async function revokeGiftSubscription(admin: AdminUser, userId: string): Promise<AdminGrantStatus> {
  const before = await fetchProfileGiftRow(userId)
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      admin_granted_plan: null,
      admin_plan_expires_at: null,
      admin_plan_granted_at: null,
      admin_plan_granted_by: null,
    }),
  })
  const rows = await readSupabaseRestJson<unknown[]>(response, 'Could not revoke gifted subscription')
  if (rows.length === 0) throw new SupabaseRequestError('User profile was not found.', 404)

  await recordAuditLog(admin, 'subscriptions.revoke', 'user', userId, {
    previousPlan: before?.admin_granted_plan ?? null,
    previousExpiry: before?.admin_plan_expires_at ?? null,
  })
  return getUserGrantStatus(userId)
}

async function writeNexusPointsAdjustment(
  admin: AdminUser,
  userId: string,
  signedAmount: number,
  description: string,
  action: 'nexus_points.grant' | 'nexus_points.remove',
): Promise<AdminGrantStatus> {
  if (!Number.isFinite(signedAmount) || signedAmount === 0 || Math.abs(signedAmount) > MAX_POINTS_ADJUSTMENT) {
    throw new SupabaseRequestError(`Enter a Nexus Points amount between 1 and ${MAX_POINTS_ADJUSTMENT.toLocaleString()}.`, 400)
  }
  const roundedAmount = Math.round(signedAmount)
  const fallback = roundedAmount > 0 ? 'Admin Nexus Points gift' : 'Admin Nexus Points removal'
  const trimmedDescription = description.trim() || fallback
  if (trimmedDescription.length > 160) throw new SupabaseRequestError('Adjustment note must be 160 characters or fewer.', 400)

  const response = await supabaseServiceFetch('/nexus_point_grants', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      amount: roundedAmount,
      description: trimmedDescription,
      granted_by: admin.id,
    }),
  })

  let rows: unknown[]
  try {
    rows = await readSupabaseRestJson<unknown[]>(response, roundedAmount > 0 ? 'Could not gift Nexus Points' : 'Could not remove Nexus Points')
  } catch (error) {
    if (error instanceof SupabaseRequestError) {
      const message = error.message.toLowerCase()
      if (message.includes('nexus_point_grants') || message.includes('amount') || message.includes('constraint')) {
        throw new SupabaseRequestError('Nexus Points admin controls need the latest Supabase migrations applied: 0019_admin_gifts.sql and 0020_nexus_point_adjustments.sql.', 503)
      }
    }
    throw error
  }
  if (rows.length === 0) throw new SupabaseRequestError('Could not create Nexus Points adjustment.', 502)

  await recordAuditLog(admin, action, 'user', userId, { amount: Math.abs(roundedAmount), signedAmount: roundedAmount, description: trimmedDescription })
  return getUserGrantStatus(userId)
}

export async function grantNexusPoints(admin: AdminUser, userId: string, amount: number, description: string): Promise<AdminGrantStatus> {
  return writeNexusPointsAdjustment(admin, userId, Math.abs(amount), description, 'nexus_points.grant')
}

export async function removeNexusPoints(admin: AdminUser, userId: string, amount: number, description: string): Promise<AdminGrantStatus> {
  return writeNexusPointsAdjustment(admin, userId, -Math.abs(amount), description, 'nexus_points.remove')
}
