import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import { recordAuditLog } from './audit'
import type { AdminUser } from './session'

/**
 * "XP" here is specifically Apex Clash XP (apex_profiles.apex_xp) — the only
 * server-authoritative XP in AirNexus. Not a generic XP system; the admin UI
 * labels it as such so this doesn't read as broader than it is.
 */

function encode(value: string) {
  return encodeURIComponent(value)
}

export async function viewUserXp(userId: string): Promise<number> {
  const response = await supabaseServiceFetch(`/apex_profiles?user_id=eq.${encode(userId)}&select=apex_xp`)
  const rows = await readSupabaseRestJson<{ apex_xp: number }[]>(response, 'Failed to load XP')
  return rows[0]?.apex_xp ?? 0
}

async function writeXp(admin: AdminUser, userId: string, nextXp: number, action: string, detail: Record<string, unknown>): Promise<void> {
  if (!Number.isFinite(nextXp) || nextXp < 0) throw new SupabaseRequestError('XP must be zero or greater.', 400)
  const response = await supabaseServiceFetch(`/apex_profiles?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ apex_xp: Math.round(nextXp) }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not update XP')
  await recordAuditLog(admin, action, 'user', userId, detail)
}

export async function grantXp(admin: AdminUser, userId: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) throw new SupabaseRequestError('Enter an amount greater than 0.', 400)
  const current = await viewUserXp(userId)
  await writeXp(admin, userId, current + amount, 'xp.grant', { amount, before: current })
}

export async function removeXp(admin: AdminUser, userId: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) throw new SupabaseRequestError('Enter an amount greater than 0.', 400)
  const current = await viewUserXp(userId)
  await writeXp(admin, userId, Math.max(0, current - amount), 'xp.remove', { amount, before: current })
}

export async function setUserXp(admin: AdminUser, userId: string, amount: number): Promise<void> {
  const current = await viewUserXp(userId)
  await writeXp(admin, userId, amount, 'xp.set', { before: current, after: amount })
}
