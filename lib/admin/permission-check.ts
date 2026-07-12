import type { AdminPermission } from './permissions'

/**
 * Pure permission resolution, split out from lib/admin/session.ts (which is
 * server-only and does the actual DB lookup) so the rule itself — super_admin
 * bypasses everything, everyone else needs an explicit grant — is
 * unit-testable without a Supabase connection.
 */
export type PermissionCheckSubject = { role: 'super_admin' | 'admin'; permissions: string[] }

export function hasPermission(admin: PermissionCheckSubject, permission: AdminPermission): boolean {
  if (admin.role === 'super_admin') return true
  return admin.permissions.includes(permission)
}
