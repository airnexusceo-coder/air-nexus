import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import type { ServerAuthSession } from '@/lib/supabase/server'
import { resolveVaultEconomy, type VaultRow } from './economy'
import { DEFENCE_CAPACITY, GENERATOR_OUTPUT_PER_LEVEL_PER_HOUR, repairCostForPercent } from './config'
import type { InstalledDefence, VaultOverview, VaultStatus } from './types'

function encode(value: string) {
  return encodeURIComponent(value)
}

type DefenceRow = {
  id: string
  technology_id: string
  defence_order: number
  energy_priority: number
  is_enabled: boolean
  apex_technologies: { slug: string; name: string; capacity_cost: number; upkeep_energy_per_hour: number; startup_energy_cost: number; technology_type: string }
}

async function fetchInstalledDefences(userId: string): Promise<DefenceRow[]> {
  const response = await supabaseServiceFetch(
    `/apex_vault_defences?user_id=eq.${encode(userId)}&order=defence_order.asc&select=id,technology_id,defence_order,energy_priority,is_enabled,apex_technologies(slug,name,capacity_cost,upkeep_energy_per_hour,startup_energy_cost,technology_type)`,
  )
  return readSupabaseRestJson<DefenceRow[]>(response, 'Failed to load installed defences')
}

function deriveStatus(vault: VaultRow, netFlow: number): VaultStatus {
  if (vault.vault_integrity < 50) return 'destabilised'
  if (netFlow < 0) return 'deficit'
  return 'secured'
}

function toOverview(vault: VaultRow, defences: DefenceRow[]): VaultOverview {
  const installedDefences: InstalledDefence[] = defences.map((row) => ({
    id: row.id,
    technologyId: row.technology_id,
    slug: row.apex_technologies.slug,
    name: row.apex_technologies.name,
    capacityCost: row.apex_technologies.capacity_cost,
    upkeepEnergyPerHour: row.apex_technologies.upkeep_energy_per_hour,
    defenceOrder: row.defence_order,
    energyPriority: row.energy_priority,
    isEnabled: row.is_enabled,
  }))

  const energyOutputPerHour = vault.generator_level * GENERATOR_OUTPUT_PER_LEVEL_PER_HOUR
  const energyUpkeepPerHour = installedDefences.filter((d) => d.isEnabled).reduce((sum, d) => sum + d.upkeepEnergyPerHour, 0)
  const netEnergyFlowPerHour = energyOutputPerHour - energyUpkeepPerHour
  const defenceCapacityUsed = installedDefences.reduce((sum, d) => sum + d.capacityCost, 0)

  return {
    coreEnergy: vault.core_energy,
    vaultIntegrity: vault.vault_integrity,
    generatorLevel: vault.generator_level,
    energyStorageCapacity: vault.energy_storage_capacity,
    energyOutputPerHour,
    energyUpkeepPerHour,
    netEnergyFlowPerHour,
    reservesLastHours: netEnergyFlowPerHour < 0 ? Math.max(0, vault.core_energy / Math.abs(netEnergyFlowPerHour)) : null,
    status: deriveStatus(vault, netEnergyFlowPerHour),
    autoRepairEnabled: vault.auto_repair_enabled,
    autoRepairReserve: vault.auto_repair_reserve,
    breachesEnabled: vault.breaches_enabled,
    defenceCapacityUsed,
    defenceCapacityMax: DEFENCE_CAPACITY,
    installedDefences,
  }
}

/** Resolves the economy, then returns the full Vault overview. */
export async function getVaultOverview(userId: string): Promise<VaultOverview> {
  const vault = await resolveVaultEconomy(userId)
  const defences = await fetchInstalledDefences(userId)
  return toOverview(vault, defences)
}

async function requireOwnedDefenceTechnology(userId: string, technologySlug: string) {
  const response = await supabaseServiceFetch(
    `/apex_technologies?slug=eq.${encode(technologySlug)}&technology_type=eq.defence&is_active=eq.true&select=*`,
  )
  const rows = await readSupabaseRestJson<{ id: string; name: string; capacity_cost: number; startup_energy_cost: number }[]>(response, 'Failed to load technology')
  const tech = rows[0]
  if (!tech) throw new SupabaseRequestError('Unknown defence technology.', 404)

  const ownedResponse = await supabaseServiceFetch(
    `/apex_user_technologies?user_id=eq.${encode(userId)}&technology_id=eq.${encode(tech.id)}&select=technology_id`,
  )
  const owned = await readSupabaseRestJson<unknown[]>(ownedResponse, 'Failed to check ownership')
  if (owned.length === 0) throw new SupabaseRequestError('You do not own this technology.', 403)

  return tech
}

/** Install an owned defence technology: consumes capacity, pays the one-time startup cost. */
export async function installTechnology(auth: ServerAuthSession, technologySlug: string): Promise<VaultOverview> {
  const userId = auth.user.id
  const tech = await requireOwnedDefenceTechnology(userId, technologySlug)

  const existingDefences = await fetchInstalledDefences(userId)
  if (existingDefences.some((d) => d.technology_id === tech.id)) {
    throw new SupabaseRequestError('Already installed.', 409)
  }
  const usedCapacity = existingDefences.reduce((sum, d) => sum + d.apex_technologies.capacity_cost, 0)
  if (usedCapacity + tech.capacity_cost > DEFENCE_CAPACITY) {
    throw new SupabaseRequestError(`Not enough Defence Capacity (${DEFENCE_CAPACITY - usedCapacity} remaining).`, 400)
  }

  await resolveVaultEconomy(userId)
  await spendCoreEnergy(userId, tech.startup_energy_cost, 'system_startup', `install:${technologySlug}`)

  const nextOrder = existingDefences.length > 0 ? Math.max(...existingDefences.map((d) => d.defence_order)) + 1 : 0
  const insertResponse = await supabaseServiceFetch('/apex_vault_defences', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, technology_id: tech.id, defence_order: nextOrder, energy_priority: nextOrder, is_enabled: true }),
  })
  if (!insertResponse.ok) await readSupabaseRestJson(insertResponse, 'Could not install technology')

  return getVaultOverview(userId)
}

/** Remove an installed defence: frees capacity. No refund. */
export async function uninstallTechnology(auth: ServerAuthSession, defenceId: string): Promise<VaultOverview> {
  const userId = auth.user.id
  const response = await supabaseServiceFetch(`/apex_vault_defences?id=eq.${encode(defenceId)}&user_id=eq.${encode(userId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
  const rows = await readSupabaseRestJson<unknown[]>(response, 'Could not uninstall technology')
  if (rows.length === 0) throw new SupabaseRequestError('Defence not found.', 404)
  return getVaultOverview(userId)
}

async function spendCoreEnergy(userId: string, amount: number, transactionType: string, source: string) {
  if (amount <= 0) return
  const response = await supabaseServiceFetch('/rpc/apex_adjust_core_energy', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId, p_delta: -amount, p_transaction_type: transactionType, p_source: source }),
  })
  if (!response.ok) {
    const text = await response.text()
    if (text.includes('Insufficient')) throw new SupabaseRequestError('Not enough Core Energy.', 400)
    throw new SupabaseRequestError('Could not spend Core Energy.', 502)
  }
}

/** (Re)activate a defence. Reactivating one the economy auto-disabled charges startup cost again. */
export async function activateDefence(auth: ServerAuthSession, defenceId: string): Promise<VaultOverview> {
  const userId = auth.user.id
  await resolveVaultEconomy(userId)
  const defences = await fetchInstalledDefences(userId)
  const defence = defences.find((d) => d.id === defenceId)
  if (!defence) throw new SupabaseRequestError('Defence not found.', 404)
  if (defence.is_enabled) return getVaultOverview(userId)

  await spendCoreEnergy(userId, defence.apex_technologies.startup_energy_cost, 'system_startup', `reactivate:${defence.apex_technologies.slug}`)

  const updateResponse = await supabaseServiceFetch(`/apex_vault_defences?id=eq.${encode(defenceId)}&user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_enabled: true }),
  })
  if (!updateResponse.ok) await readSupabaseRestJson(updateResponse, 'Could not activate defence')
  return getVaultOverview(userId)
}

export async function deactivateDefence(auth: ServerAuthSession, defenceId: string): Promise<VaultOverview> {
  const userId = auth.user.id
  const response = await supabaseServiceFetch(`/apex_vault_defences?id=eq.${encode(defenceId)}&user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ is_enabled: false }),
  })
  const rows = await readSupabaseRestJson<unknown[]>(response, 'Could not deactivate defence')
  if (rows.length === 0) throw new SupabaseRequestError('Defence not found.', 404)
  return getVaultOverview(userId)
}

async function reorderColumn(auth: ServerAuthSession, column: 'defence_order' | 'energy_priority', orderedDefenceIds: string[]): Promise<VaultOverview> {
  const userId = auth.user.id
  if (!Array.isArray(orderedDefenceIds) || orderedDefenceIds.length === 0) {
    throw new SupabaseRequestError('A defence order list is required.', 400)
  }
  const existing = await fetchInstalledDefences(userId)
  const existingIds = new Set(existing.map((d) => d.id))
  if (!orderedDefenceIds.every((id) => existingIds.has(id)) || orderedDefenceIds.length !== existing.length) {
    throw new SupabaseRequestError('Order list must include exactly your installed defences.', 400)
  }

  await Promise.all(
    orderedDefenceIds.map((id, index) =>
      supabaseServiceFetch(`/apex_vault_defences?id=eq.${encode(id)}&user_id=eq.${encode(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ [column]: index }),
      }),
    ),
  )
  return getVaultOverview(userId)
}

export function reorderDefences(auth: ServerAuthSession, orderedDefenceIds: string[]) {
  return reorderColumn(auth, 'defence_order', orderedDefenceIds)
}

export function setEnergyPriority(auth: ServerAuthSession, orderedDefenceIds: string[]) {
  return reorderColumn(auth, 'energy_priority', orderedDefenceIds)
}

export async function repairVault(auth: ServerAuthSession, restorePercent: number): Promise<VaultOverview> {
  const userId = auth.user.id
  const percent = Math.max(0, Math.min(100, Math.round(Number(restorePercent))))
  if (!Number.isFinite(percent) || percent <= 0) throw new SupabaseRequestError('Enter a repair amount greater than 0.', 400)

  await resolveVaultEconomy(userId)
  const cost = repairCostForPercent(percent)
  const response = await supabaseServiceFetch('/rpc/apex_repair_vault', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId, p_integrity_restore: percent, p_cost: cost }),
  })
  if (!response.ok) {
    const text = await response.text()
    if (text.includes('Insufficient')) throw new SupabaseRequestError('Not enough Core Energy to repair.', 400)
    throw new SupabaseRequestError('Could not repair Vault.', 502)
  }
  return getVaultOverview(userId)
}

export async function setAutoRepair(auth: ServerAuthSession, enabled: boolean, reserve: number): Promise<VaultOverview> {
  const userId = auth.user.id
  const safeReserve = Math.max(0, Math.round(Number(reserve) || 0))
  const response = await supabaseServiceFetch(`/apex_vaults?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ auto_repair_enabled: Boolean(enabled), auto_repair_reserve: safeReserve }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not update Auto-Repair')
  return getVaultOverview(userId)
}

export async function setBreachesEnabled(auth: ServerAuthSession, enabled: boolean): Promise<VaultOverview> {
  const userId = auth.user.id
  const response = await supabaseServiceFetch(`/apex_vaults?user_id=eq.${encode(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ breaches_enabled: Boolean(enabled) }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not update setting')
  return getVaultOverview(userId)
}
