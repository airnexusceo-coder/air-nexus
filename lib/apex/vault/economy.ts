import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch } from '@/lib/supabase/server'

export type VaultRow = {
  user_id: string
  core_energy: number
  vault_integrity: number
  generator_level: number
  energy_storage_capacity: number
  auto_repair_enabled: boolean
  auto_repair_reserve: number
  breaches_enabled: boolean
  last_economy_resolved_at: string
}

/**
 * The single trusted entry point for Vault economy state. Calls the
 * `apex_resolve_vault_economy` SECURITY DEFINER function (service-role —
 * bypasses RLS, row-locks the vault, and does the elapsed-time generation +
 * upkeep math atomically). Every route that reads or mutates a Vault calls
 * this first, so Core Energy is always current regardless of how long the
 * account was offline. No cron job is required for this to be correct; it's
 * "lazy" resolution — a scheduled resolver is a valid future optimisation
 * (see APEX_HANDOFF.md) but not a correctness requirement.
 */
export async function resolveVaultEconomy(userId: string): Promise<VaultRow> {
  const response = await supabaseServiceFetch('/rpc/apex_resolve_vault_economy', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId }),
  })
  return readSupabaseRestJson<VaultRow>(response, 'Failed to resolve Vault economy')
}
