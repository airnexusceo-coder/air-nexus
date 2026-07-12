/**
 * Breach resolver — central, documented constants. The authoritative
 * resolution logic lives in SQL (`apex_breach_take_action` /
 * `apex_finalize_breach`, supabase/migrations/0004_apex_breach_resolver.sql)
 * since it must run as one atomic, row-locked transaction per action — these
 * mirror the SQL exactly (kept in sync by hand, SQL can't import TS) and are
 * the single reference for balancing + the values the UI displays as
 * previews. **The client never computes an outcome; these are display-only.**
 *
 * BREACH SNAPSHOT DECISION: a breach uses a DEFENCE SNAPSHOT captured at
 * creation (apex_breach_layers), not the defender's live state. This is
 * intentional — it makes a breach fair/reproducible even if the defender
 * edits their Vault mid-breach, and means the attacker's session never
 * queries the defender's live private tables.
 */

import type { SanitizedBreachLayer } from './types'

export const BREACH_STAGE_LABELS = ['Outer Perimeter', 'Inner Sanctum', 'Core Gate'] as const

/** Action costs (Core Energy) — mirrors the SQL resolver's hardcoded values. */
export const SCAN_COST = 10
export const PROBE_COST = 20
export const OVERLOAD_COST = 60

/** Base pressure as a fraction of the layer's strength — mirrors the SQL resolver. */
export const PROBE_PRESSURE_FRACTION = 0.22
export const OVERLOAD_PRESSURE_FRACTION = 0.4
export const TOOL_MATCHED_PRESSURE_FRACTION = 0.68
export const TOOL_MISMATCHED_PRESSURE_FRACTION = 0.3

/** Auditable randomness band applied to every pressure roll. */
export const PRESSURE_RANDOM_MIN = 0.85
export const PRESSURE_RANDOM_MAX = 1.15

/** A layer survives at most this many actions before the breach is contained. */
export const MAX_ACTIONS_PER_LAYER = 4
/** Below this remaining breach energy, the breach is contained. */
export const MIN_VIABLE_BREACH_ENERGY = 15

/** Baseline strength for layers with no installed defence behind them. */
export const OUTER_BASELINE_STRENGTH = 60
export const DEEP_BASELINE_STRENGTH = 70
export const CORE_BASELINE_STRENGTH = 80

/** Session TTL — an inactive 'active' session becomes 'expired' after this long. */
export const BREACH_SESSION_TTL_MINUTES = 30

/** Reward: successful breach funds this fraction of the committed budget back as a reward (economy sink from the defender, not a direct transfer). */
export const BREACH_REWARD_FRACTION = 0.25
/** Vault Integrity lost by the defender on a successful breach. */
export const BREACH_INTEGRITY_DAMAGE = 15

/** Clash XP formula constants — mirrors the SQL finalizer exactly. */
export const XP_BASE_VICTORY = 40
export const XP_PER_LAYER_BROKEN = 6
export const XP_UNDERDOG_BONUS = 8
export const XP_PARTICIPATION_CONTAINED = 10

/** Anti-farm: diminishing XP for repeated breaches against the same defender within 24h. */
export const ANTI_FARM_MULTIPLIERS = [1, 0.5, 0.2, 0] as const
export const ANTI_FARM_WINDOW_HOURS = 24

export function antiFarmMultiplier(priorBreachesAgainstSameTargetIn24h: number): number {
  const index = Math.min(priorBreachesAgainstSameTargetIn24h, ANTI_FARM_MULTIPLIERS.length - 1)
  return ANTI_FARM_MULTIPLIERS[index]
}

/**
 * Display-only preview of the breach XP formula — mirrors
 * `apex_finalize_breach` exactly. The server computes the authoritative
 * value; this is only used for UI copy (e.g. "up to ~46 XP").
 */
export function previewVictoryXp(layersBroken: number, isUnderdog: boolean, priorBreachesIn24h: number): number {
  const multiplier = antiFarmMultiplier(priorBreachesIn24h)
  let xp = Math.round((XP_BASE_VICTORY + layersBroken * XP_PER_LAYER_BROKEN) * multiplier)
  if (isUnderdog) xp += Math.round(XP_UNDERDOG_BONUS * multiplier)
  return xp
}

export type RawBreachLayerRow = {
  layer_index: number
  name: string
  integrity: number
  strength: number
  is_broken: boolean
  is_revealed: boolean
  actions_taken: number
}

/**
 * The hidden-information boundary: an unrevealed layer's technology identity
 * (`name`) must NEVER reach the client. This is the one place that mapping
 * happens — every caller (breach.ts) must route raw layer rows through this
 * function rather than building a DTO by hand.
 */
export function sanitizeLayerRow(row: RawBreachLayerRow): SanitizedBreachLayer {
  return {
    layerIndex: row.layer_index,
    label: BREACH_STAGE_LABELS[row.layer_index] ?? 'Core Gate',
    revealed: row.is_revealed,
    name: row.is_revealed ? row.name : null,
    integrityPercent: Math.round((row.integrity / row.strength) * 100),
    broken: row.is_broken,
    actionsTaken: row.actions_taken,
  }
}
