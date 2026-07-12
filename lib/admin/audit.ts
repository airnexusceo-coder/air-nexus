import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch } from '@/lib/supabase/server'
import type { AdminUser } from './session'

/**
 * Every mutating admin action calls this. Best-effort (a logging hiccup
 * should never block a real action like a ban), but awaited rather than
 * fire-and-forget so a hard failure at least surfaces in server logs.
 */
export async function recordAuditLog(
  admin: AdminUser,
  action: string,
  targetType: string | null,
  targetId: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await supabaseServiceFetch('/admin_audit_log', {
    method: 'POST',
    body: JSON.stringify({ admin_user_id: admin.id, action, target_type: targetType, target_id: targetId, detail }),
  }).catch((error: unknown) => {
    console.error('admin audit log write failed', error)
  })
}

export type AuditLogEntry = {
  id: string
  adminUsername: string
  action: string
  targetType: string | null
  targetId: string | null
  detail: Record<string, unknown>
  createdAt: string
}

type AuditLogRow = {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  detail: Record<string, unknown>
  created_at: string
  admin_users: { username: string }
}

export async function listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const response = await supabaseServiceFetch(
    `/admin_audit_log?select=id,action,target_type,target_id,detail,created_at,admin_users(username)&order=created_at.desc&limit=${limit}`,
  )
  const rows = await readSupabaseRestJson<AuditLogRow[]>(response, 'Failed to load audit log')
  return rows.map((row) => ({
    id: row.id,
    adminUsername: row.admin_users.username,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    detail: row.detail,
    createdAt: row.created_at,
  }))
}
