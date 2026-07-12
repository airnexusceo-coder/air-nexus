export type MotivationSyncInput = { lifetimeXp: number; currentStreakDays: number; longestStreakDays: number }

const MAX_STREAK_DAYS = 3650
const MAX_LIFETIME_XP = 1_000_000

/** Bounds-checks self-reported study stats before they're persisted — the client is untrusted, even though nothing here is a spendable resource. Longest streak is always at least the current streak. */
export function clampMotivationSyncInput(input: MotivationSyncInput): MotivationSyncInput {
  const currentStreakDays = Math.max(0, Math.min(MAX_STREAK_DAYS, Math.round(Number(input.currentStreakDays) || 0)))
  const longestStreakDays = Math.max(currentStreakDays, Math.max(0, Math.min(MAX_STREAK_DAYS, Math.round(Number(input.longestStreakDays) || 0))))
  const lifetimeXp = Math.max(0, Math.min(MAX_LIFETIME_XP, Math.round(Number(input.lifetimeXp) || 0)))
  return { lifetimeXp, currentStreakDays, longestStreakDays }
}
