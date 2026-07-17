import 'server-only'

import { supabaseServiceFetch } from '@/lib/supabase/server'
import { countRows } from './count'
import { countClashesSince } from './clashes'

export type AdminDashboardStats = {
  totalPlayers: number
  clashesToday: number
  clashesThisWeek: number
  activeGiftedSubscriptions: number
  pendingNexusPointGifts: number
  systemStatus: 'ok' | 'degraded'
}

export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const now = new Date().toISOString()

  const [totalPlayers, clashesToday, clashesThisWeek, activeGiftedSubscriptions, pendingNexusPointGifts, healthResponse] = await Promise.all([
    countRows('/profiles?select=user_id'),
    countClashesSince(startOfToday.toISOString()),
    countClashesSince(startOfWeek.toISOString()),
    countRows(`/profiles?select=user_id&admin_granted_plan=not.is.null&admin_plan_expires_at=gt.${encodeURIComponent(now)}`),
    countRows('/nexus_point_grants?select=id&claimed_at=is.null'),
    supabaseServiceFetch('/profiles?select=user_id&limit=1').catch(() => null),
  ])

  return {
    totalPlayers,
    clashesToday,
    clashesThisWeek,
    activeGiftedSubscriptions,
    pendingNexusPointGifts,
    systemStatus: healthResponse?.ok ? 'ok' : 'degraded',
  }
}