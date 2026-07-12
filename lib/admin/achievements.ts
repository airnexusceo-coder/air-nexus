import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import { recordAuditLog } from './audit'
import type { AdminUser } from './session'

function encode(value: string) {
  return encodeURIComponent(value)
}

export type AdminAchievement = { id: string; slug: string; name: string; description: string; earnedCount: number }
type CatalogRow = { id: string; slug: string; name: string; description: string }

export async function listAchievements(): Promise<AdminAchievement[]> {
  const [catalogResponse, earnedResponse] = await Promise.all([
    supabaseServiceFetch('/apex_achievements?select=id,slug,name,description&order=name.asc'),
    supabaseServiceFetch('/apex_user_achievements?select=achievement_id'),
  ])
  const catalog = await readSupabaseRestJson<CatalogRow[]>(catalogResponse, 'Failed to load achievements')
  const earned = await readSupabaseRestJson<{ achievement_id: string }[]>(earnedResponse, 'Failed to load achievement counts')
  const counts = new Map<string, number>()
  for (const row of earned) counts.set(row.achievement_id, (counts.get(row.achievement_id) ?? 0) + 1)
  return catalog.map((item) => ({ ...item, earnedCount: counts.get(item.id) ?? 0 }))
}

export async function createAchievement(admin: AdminUser, slug: string, name: string, description: string): Promise<AdminAchievement> {
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
  if (!cleanSlug || !name.trim()) throw new SupabaseRequestError('Slug and name are required.', 400)
  const response = await supabaseServiceFetch('/apex_achievements', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ slug: cleanSlug, name: name.trim(), description: description.trim() }),
  })
  const rows = await readSupabaseRestJson<CatalogRow[]>(response, 'Could not create achievement')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Could not create achievement.', 502)
  await recordAuditLog(admin, 'achievements.create', 'achievement', row.id, { slug: cleanSlug })
  return { ...row, earnedCount: 0 }
}

export async function updateAchievement(admin: AdminUser, id: string, name: string, description: string): Promise<void> {
  if (!name.trim()) throw new SupabaseRequestError('Name is required.', 400)
  const response = await supabaseServiceFetch(`/apex_achievements?id=eq.${encode(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: name.trim(), description: description.trim() }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not update achievement')
  await recordAuditLog(admin, 'achievements.edit', 'achievement', id, { name, description })
}

export async function deleteAchievement(admin: AdminUser, id: string): Promise<void> {
  const response = await supabaseServiceFetch(`/apex_achievements?id=eq.${encode(id)}`, { method: 'DELETE' })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not delete achievement')
  await recordAuditLog(admin, 'achievements.delete', 'achievement', id, {})
}

export async function grantAchievement(admin: AdminUser, userId: string, achievementId: string): Promise<void> {
  const response = await supabaseServiceFetch('/apex_user_achievements', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId, achievement_id: achievementId }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not grant achievement')
  await recordAuditLog(admin, 'achievements.grant', 'user', userId, { achievementId })
}

export async function revokeAchievement(admin: AdminUser, userId: string, achievementId: string): Promise<void> {
  const response = await supabaseServiceFetch(
    `/apex_user_achievements?user_id=eq.${encode(userId)}&achievement_id=eq.${encode(achievementId)}`,
    { method: 'DELETE' },
  )
  if (!response.ok) await readSupabaseRestJson(response, 'Could not revoke achievement')
  await recordAuditLog(admin, 'achievements.revoke', 'user', userId, { achievementId })
}
