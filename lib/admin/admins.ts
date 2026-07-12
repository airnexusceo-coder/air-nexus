import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import { hashPassword } from './password'
import { recordAuditLog } from './audit'
import { ADMIN_PERMISSIONS, type AdminPermission } from './permissions'
import type { AdminUser } from './session'

function encode(value: string) {
  return encodeURIComponent(value)
}

export type AdminAccountView = {
  id: string
  username: string
  role: 'super_admin' | 'admin'
  permissions: string[]
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
}

type AdminAccountRow = {
  id: string
  username: string
  role: string
  permissions: string[]
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

function toView(row: AdminAccountRow): AdminAccountView {
  return {
    id: row.id,
    username: row.username,
    role: row.role as AdminAccountView['role'],
    permissions: row.permissions,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }
}

export async function listAdmins(): Promise<AdminAccountView[]> {
  const response = await supabaseServiceFetch('/admin_users?select=id,username,role,permissions,is_active,created_at,last_login_at&order=created_at.asc')
  const rows = await readSupabaseRestJson<AdminAccountRow[]>(response, 'Failed to load admins')
  return rows.map(toView)
}

export async function createAdmin(
  actor: AdminUser,
  username: string,
  password: string,
  role: 'super_admin' | 'admin',
  permissions: AdminPermission[],
): Promise<AdminAccountView> {
  const trimmed = username.trim()
  if (trimmed.length < 3) throw new SupabaseRequestError('Username must be at least 3 characters.', 400)
  if (password.length < 12) throw new SupabaseRequestError('Use a password of at least 12 characters.', 400)
  const invalid = permissions.filter((permission) => !ADMIN_PERMISSIONS.includes(permission))
  if (invalid.length > 0) throw new SupabaseRequestError(`Unknown permission(s): ${invalid.join(', ')}`, 400)

  const response = await supabaseServiceFetch('/admin_users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      username: trimmed,
      password_hash: hashPassword(password),
      role,
      permissions: role === 'super_admin' ? [] : permissions,
      created_by: actor.id,
    }),
  })
  const rows = await readSupabaseRestJson<AdminAccountRow[]>(response, 'Could not create admin — username may already be taken')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Could not create admin.', 502)
  await recordAuditLog(actor, 'admin.create', 'admin', row.id, { username: trimmed, role })
  return toView(row)
}

export async function updateAdminPermissions(actor: AdminUser, adminId: string, permissions: AdminPermission[]): Promise<void> {
  const invalid = permissions.filter((permission) => !ADMIN_PERMISSIONS.includes(permission))
  if (invalid.length > 0) throw new SupabaseRequestError(`Unknown permission(s): ${invalid.join(', ')}`, 400)
  const response = await supabaseServiceFetch(`/admin_users?id=eq.${encode(adminId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not update admin')
  await recordAuditLog(actor, 'admin.edit', 'admin', adminId, { permissions })
}

/** "Remove" deactivates (is_active=false) rather than deleting the row — keeps audit_log foreign keys intact and the action reversible. */
export async function removeAdmin(actor: AdminUser, adminId: string): Promise<void> {
  if (adminId === actor.id) throw new SupabaseRequestError('You cannot remove your own admin account.', 400)
  const response = await supabaseServiceFetch(`/admin_users?id=eq.${encode(adminId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: false }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not remove admin')
  await recordAuditLog(actor, 'admin.remove', 'admin', adminId, {})
}
