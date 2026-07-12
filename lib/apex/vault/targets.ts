import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch, type ServerAuthSession } from '@/lib/supabase/server'
import { getAcceptedFriends } from '@/lib/airnexus/social'
import { deriveApexRank } from '@/lib/apex/config'
import { BREACH_TARGET_WINDOW_HOURS, MAX_BREACHES_PER_TARGET, POST_BREACH_PROTECTION_HOURS } from './config'
import type { ApexTarget, ApexTargetStatus } from './types'

function encode(value: string) {
  return encodeURIComponent(value)
}

function isoSince(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

/**
 * Real AirGPT friends' public Apex target summaries — never their exact Core
 * Energy, defence order, or priority (those stay in apex_vault_defences,
 * which has no cross-user RLS policy). Signal state is a coarse, honestly
 * derived read of real server-side conditions, not a fabricated flavour value.
 */
export async function listApexTargets(auth: ServerAuthSession): Promise<ApexTarget[]> {
  const userId = auth.user.id
  const friends = await getAcceptedFriends(auth)
  if (friends.length === 0) return []

  const friendIds = friends.map((f) => f.user_id)
  const idFilter = `(${friendIds.map(encode).join(',')})`

  const [vaultRows, defenceCountRows, myOutgoingRows] = await Promise.all([
    readSupabaseRestJson<{ user_id: string; vault_integrity: number; breaches_enabled: boolean }[]>(
      await supabaseServiceFetch(`/apex_vaults?user_id=in.${idFilter}&select=user_id,vault_integrity,breaches_enabled`),
      'Failed to load target vaults',
    ),
    readSupabaseRestJson<{ user_id: string }[]>(
      await supabaseServiceFetch(`/apex_vault_defences?user_id=in.${idFilter}&select=user_id`),
      'Failed to load target defences',
    ),
    readSupabaseRestJson<{ defender_user_id: string }[]>(
      await supabaseServiceFetch(
        `/apex_breach_sessions?attacker_user_id=eq.${encode(userId)}&defender_user_id=in.${idFilter}&started_at=gte.${encode(isoSince(BREACH_TARGET_WINDOW_HOURS))}&select=defender_user_id`,
      ),
      'Failed to load breach history',
    ),
  ])

  const vaultByUser = new Map(vaultRows.map((row) => [row.user_id, row]))
  const defenceCounts = new Map<string, number>()
  for (const row of defenceCountRows) defenceCounts.set(row.user_id, (defenceCounts.get(row.user_id) ?? 0) + 1)
  const breachCounts = new Map<string, number>()
  for (const row of myOutgoingRows) breachCounts.set(row.defender_user_id, (breachCounts.get(row.defender_user_id) ?? 0) + 1)

  // Vault Recovery protection: not reachable yet (no breach can complete
  // until the interactive resolver exists — see APEX_HANDOFF.md), but the
  // check is real and will start working the moment breaches can complete.
  const protectedRows = await readSupabaseRestJson<{ defender_user_id: string }[]>(
    await supabaseServiceFetch(
      `/apex_breach_sessions?defender_user_id=in.${idFilter}&status=eq.completed&completed_at=gte.${encode(isoSince(POST_BREACH_PROTECTION_HOURS))}&select=defender_user_id`,
    ),
    'Failed to load recovery status',
  )
  const protectedUsers = new Set(protectedRows.map((row) => row.defender_user_id))

  return friends.map((friend) => {
    const vault = vaultByUser.get(friend.user_id)
    const usedInWindow = breachCounts.get(friend.user_id) ?? 0

    let status: ApexTargetStatus = 'available'
    if (vault && !vault.breaches_enabled) status = 'breaches_disabled'
    else if (protectedUsers.has(friend.user_id)) status = 'protected'
    else if (usedInWindow >= MAX_BREACHES_PER_TARGET) status = 'limit_reached'

    const integrity = vault?.vault_integrity ?? 100
    const vaultSignal = integrity < 50 ? 'unstable' : integrity < 80 ? 'weakening' : 'stable'

    return {
      userId: friend.user_id,
      displayName: friend.display_name,
      apexRankLabel: deriveApexRank(friend.apex_xp).label,
      vaultSignal,
      defenceLayerCount: defenceCounts.get(friend.user_id) ?? 0,
      status,
      breachesUsedInWindow: usedInWindow,
      breachesMaxInWindow: MAX_BREACHES_PER_TARGET,
    }
  })
}
