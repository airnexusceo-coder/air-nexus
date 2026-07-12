import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, supabaseServiceFetch, type ServerAuthSession } from '@/lib/supabase/server'
import type { ApexAchievement } from './types'

function encode(value: string) {
  return encodeURIComponent(value)
}

type CatalogRow = { slug: string; name: string; description: string }
type EarnedRow = { achievement_id: string; earned_at: string }
type AchievementIdRow = { id: string; slug: string }

/**
 * The full achievement catalog + this user's earned state. Achievements are
 * server-awarded only, from real finalised-breach outcomes (see
 * apex_finalize_breach in 0004_apex_breach_resolver.sql) — nothing here ever
 * grants one; this is a read-only view. Uses the caller's own token (RLS:
 * select-own on apex_user_achievements, public catalog read).
 */
export async function listAchievements(auth: ServerAuthSession): Promise<ApexAchievement[]> {
  const [catalog, ids, earned] = await Promise.all([
    readSupabaseRestJson<CatalogRow[]>(
      await supabaseRestFetch(auth.accessToken, '/apex_achievements?select=slug,name,description&order=name.asc'),
      'Failed to load achievements',
    ),
    readSupabaseRestJson<AchievementIdRow[]>(
      await supabaseRestFetch(auth.accessToken, '/apex_achievements?select=id,slug'),
      'Failed to load achievements',
    ),
    readSupabaseRestJson<EarnedRow[]>(
      await supabaseRestFetch(auth.accessToken, `/apex_user_achievements?user_id=eq.${encode(auth.user.id)}&select=achievement_id,earned_at`),
      'Failed to load earned achievements',
    ),
  ])

  const slugById = new Map(ids.map((row) => [row.id, row.slug]))
  const earnedBySlug = new Map(earned.map((row) => [slugById.get(row.achievement_id), row.earned_at]))

  return catalog.map((item) => ({
    slug: item.slug,
    name: item.name,
    description: item.description,
    earned: earnedBySlug.has(item.slug),
    earnedAt: earnedBySlug.get(item.slug) ?? null,
  }))
}

/**
 * Same shape, but for viewing ANOTHER user's earned achievements on their
 * public profile — apex_user_achievements RLS is select-own only, so this
 * needs the service role rather than the viewer's token.
 */
export async function listPublicAchievements(targetUserId: string): Promise<ApexAchievement[]> {
  const [catalog, ids, earned] = await Promise.all([
    readSupabaseRestJson<CatalogRow[]>(
      await supabaseServiceFetch('/apex_achievements?select=slug,name,description&order=name.asc'),
      'Failed to load achievements',
    ),
    readSupabaseRestJson<AchievementIdRow[]>(
      await supabaseServiceFetch('/apex_achievements?select=id,slug'),
      'Failed to load achievements',
    ),
    readSupabaseRestJson<EarnedRow[]>(
      await supabaseServiceFetch(`/apex_user_achievements?user_id=eq.${encode(targetUserId)}&select=achievement_id,earned_at`),
      'Failed to load earned achievements',
    ),
  ])

  const slugById = new Map(ids.map((row) => [row.id, row.slug]))
  const earnedBySlug = new Map(earned.map((row) => [slugById.get(row.achievement_id), row.earned_at]))

  return catalog.map((item) => ({
    slug: item.slug,
    name: item.name,
    description: item.description,
    earned: earnedBySlug.has(item.slug),
    earnedAt: earnedBySlug.get(item.slug) ?? null,
  }))
}
