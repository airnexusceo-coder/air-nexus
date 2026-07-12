/**
 * Nexus Vault — central economy configuration. Every balance number lives
 * here, not scattered across components/routes. Starting values are
 * explicitly examples (per the product brief), meant to be tuned.
 *
 * NOTE: GENERATOR_OUTPUT_PER_LEVEL_PER_HOUR must stay in sync with the
 * hardcoded `generator_level * 100` in the SQL function
 * `apex_resolve_vault_economy()` (supabase/migrations/0003_apex_nexus_vault.sql)
 * — SQL can't import this TS constant, so the two are kept in sync by hand.
 */

export const GENERATOR_OUTPUT_PER_LEVEL_PER_HOUR = 100
export const DEFAULT_ENERGY_STORAGE_CAPACITY = 5_000

/** Total capacity every Vault has for installed+enabled defence systems. */
export const DEFENCE_CAPACITY = 8

/** Breach tools an attacker may equip per breach. */
export const MAX_BREACH_TOOL_SLOTS = 3

/** Anti-spam: breaches against the same target, per rolling window. */
export const MAX_BREACHES_PER_TARGET = 2
export const BREACH_TARGET_WINDOW_HOURS = 24

/** After a successful breach, the defender gets temporary protection. */
export const POST_BREACH_PROTECTION_HOURS = 8

/** Vault repair: Core Energy cost per 10% Integrity restored. */
export const VAULT_REPAIR_INCREMENT_PERCENT = 10
export const VAULT_REPAIR_COST_PER_INCREMENT = 250

export function repairCostForPercent(percent: number): number {
  const increments = Math.ceil(Math.max(0, percent) / VAULT_REPAIR_INCREMENT_PERCENT)
  return increments * VAULT_REPAIR_COST_PER_INCREMENT
}
