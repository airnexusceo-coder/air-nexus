import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import { countRows } from './count'
import { recordAuditLog } from './audit'
import type { AdminUser } from './session'

/**
 * "Clashes" here means Apex Breach sessions — the game's actual PvP combat
 * system (built earlier this project), the closest real equivalent to
 * "clashes" in the requested taxonomy. No separate clash system exists.
 */

function encode(value: string) {
  return encodeURIComponent(value)
}

export type AdminClash = {
  id: string
  attackerId: string
  defenderId: string
  status: string
  result: string | null
  currentLayerIndex: number
  breachEnergyRemaining: number
  startedAt: string
  completedAt: string | null
}

type SessionRow = {
  id: string
  attacker_user_id: string
  defender_user_id: string
  status: string
  result: string | null
  current_layer_index: number
  breach_energy_remaining: number
  started_at: string
  completed_at: string | null
}

export async function listClashes(limit = 100): Promise<AdminClash[]> {
  const response = await supabaseServiceFetch(
    `/apex_breach_sessions?select=id,attacker_user_id,defender_user_id,status,result,current_layer_index,breach_energy_remaining,started_at,completed_at&order=started_at.desc&limit=${limit}`,
  )
  const rows = await readSupabaseRestJson<SessionRow[]>(response, 'Failed to load clashes')
  return rows.map((row) => ({
    id: row.id,
    attackerId: row.attacker_user_id,
    defenderId: row.defender_user_id,
    status: row.status,
    result: row.result,
    currentLayerIndex: row.current_layer_index,
    breachEnergyRemaining: row.breach_energy_remaining,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }))
}

export async function countClashesSince(sinceIso: string): Promise<number> {
  return countRows(`/apex_breach_sessions?select=id&started_at=gte.${encode(sinceIso)}`)
}

/** Cancel = force-finalize as 'retreated' (0 XP, 0 reward either side) via the existing resolver — reuses real game logic, doesn't invent a parallel path. */
export async function cancelClash(admin: AdminUser, breachId: string): Promise<void> {
  const response = await supabaseServiceFetch('/rpc/apex_finalize_breach', {
    method: 'POST',
    body: JSON.stringify({ p_breach_id: breachId, p_result: 'retreated' }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new SupabaseRequestError(text.includes('not found') ? 'Clash not found.' : 'Could not cancel clash.', 400)
  }
  await recordAuditLog(admin, 'clashes.cancel', 'clash', breachId, {})
}

export async function forceClashResult(admin: AdminUser, breachId: string, result: 'breached' | 'contained' | 'retreated'): Promise<void> {
  const response = await supabaseServiceFetch('/rpc/apex_finalize_breach', {
    method: 'POST',
    body: JSON.stringify({ p_breach_id: breachId, p_result: result }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new SupabaseRequestError(text.includes('not found') ? 'Clash not found.' : 'Could not set clash result.', 400)
  }
  await recordAuditLog(admin, 'clashes.force_result', 'clash', breachId, { result })
}
