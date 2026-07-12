/**
 * Apex — central Apex-wide configuration.
 *
 * Apex is the Nexus Vault economy/strategy feature inside AirGPT (not a
 * separate app). This file is the single source of truth for Apex-wide
 * constants that aren't specific to the Vault economy itself (which lives in
 * `lib/apex/vault/economy.ts` + the `apex_resolve_vault_economy` DB function).
 */

/** The Apex rank ladder. `unranked` is the honest new-account state (0 XP, no matches). */
export const APEX_RANKS: { rank: string; label: string; xp: number }[] = [
  { rank: 'unranked', label: 'UNRANKED', xp: 0 },
  { rank: 'bronze_1', label: 'Bronze I', xp: 100 },
  { rank: 'bronze_2', label: 'Bronze II', xp: 350 },
  { rank: 'bronze_3', label: 'Bronze III', xp: 700 },
  { rank: 'silver_1', label: 'Silver I', xp: 1_100 },
  { rank: 'silver_2', label: 'Silver II', xp: 1_700 },
  { rank: 'silver_3', label: 'Silver III', xp: 2_400 },
  { rank: 'gold_1', label: 'Gold I', xp: 3_300 },
  { rank: 'gold_2', label: 'Gold II', xp: 4_600 },
  { rank: 'gold_3', label: 'Gold III', xp: 6_100 },
  { rank: 'apex', label: 'Apex', xp: 8_100 },
  { rank: 'apex_elite', label: 'Apex Elite', xp: 12_100 },
  { rank: 'white_wolf', label: 'White Wolf', xp: 20_000 },
]

export type ApexRankInfo = {
  rank: string
  label: string
  index: number
  currentThreshold: number
  nextThreshold: number | null
  nextLabel: string | null
  /** 0..1 progress toward the next rank (1 at max rank / while unranked with 0 XP). */
  progress: number
}

/**
 * Derive Apex rank + progress from an XP total. New accounts (0 XP) are
 * UNRANKED. Rank is always derived; the DB column is a convenience cache.
 */
export function deriveApexRank(xp: number): ApexRankInfo {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0
  let index = 0
  for (let i = 0; i < APEX_RANKS.length; i += 1) {
    if (safeXp >= APEX_RANKS[i].xp) index = i
  }
  const current = APEX_RANKS[index]
  const next = APEX_RANKS[index + 1] ?? null
  const progress = next ? Math.min(1, Math.max(0, (safeXp - current.xp) / (next.xp - current.xp))) : 1
  return {
    rank: current.rank,
    label: current.label,
    index,
    currentThreshold: current.xp,
    nextThreshold: next?.xp ?? null,
    nextLabel: next?.label ?? null,
    progress,
  }
}
