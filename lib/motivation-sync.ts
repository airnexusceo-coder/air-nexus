import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, type ServerAuthSession } from '@/lib/supabase/server'
import { clampMotivationSyncInput, type MotivationSyncInput } from '@/lib/motivation-sync-clamp'

export type { MotivationSyncInput }

function encode(value: string) {
  return encodeURIComponent(value)
}

/**
 * Persists client-computed study stats (lib/motivation.ts) so a public
 * profile can show them. Self-reported, server-persisted — the same trust
 * model this app already uses for Nexus Points, not a new category of
 * dishonesty.
 */
export async function syncMotivationStats(auth: ServerAuthSession, input: MotivationSyncInput): Promise<void> {
  const { lifetimePoints, currentStreakDays, longestStreakDays } = clampMotivationSyncInput(input)

  const response = await supabaseRestFetch(auth.accessToken, `/profiles?user_id=eq.${encode(auth.user.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      lifetime_points: lifetimePoints,
      current_streak_days: currentStreakDays,
      longest_streak_days: longestStreakDays,
      stats_synced_at: new Date().toISOString(),
    }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not sync study stats')
}
