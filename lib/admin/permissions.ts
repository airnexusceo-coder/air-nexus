/**
 * The full admin permission taxonomy. Every permission listed here exists in
 * code and renders in the admin UI's permission reference — but only the
 * ones marked 'live' in PERMISSION_STATUS actually do anything. 'locked'
 * permissions are visibly disabled with a reason, never a working fake
 * button: most of this taxonomy names systems (quests, items, clans,
 * seasons, events, moderation reports, announcements, feature flags) that
 * don't exist in AirNexus yet. Building a real permission check for a system
 * that isn't there would just be a different shape of fake feature.
 */

export const ADMIN_PERMISSION_GROUPS = {
  users: ['view', 'create', 'edit', 'suspend', 'ban', 'delete', 'impersonate'],
  nexus_points: ['view', 'grant', 'remove', 'set', 'audit'],
  subscriptions: ['view', 'gift', 'revoke'],
  xp: ['view', 'grant', 'remove', 'set'],
  levels: ['view', 'edit'],
  clashes: ['view', 'create', 'edit', 'cancel', 'force_result', 'reset'],
  quests: ['view', 'create', 'edit', 'delete', 'assign'],
  achievements: ['view', 'create', 'edit', 'delete', 'grant', 'revoke'],
  items: ['view', 'create', 'edit', 'delete', 'grant', 'revoke'],
  inventory: ['view', 'edit'],
  shop: ['view', 'edit', 'publish'],
  clans: ['view', 'edit', 'disband'],
  leaderboards: ['view', 'edit', 'reset'],
  seasons: ['view', 'create', 'edit', 'start', 'end'],
  events: ['view', 'create', 'edit', 'start', 'end'],
  reports: ['view', 'resolve'],
  moderation: ['view', 'warn', 'mute', 'suspend', 'ban'],
  announcements: ['view', 'create', 'edit', 'delete'],
  system: ['view', 'edit'],
  feature_flags: ['view', 'edit'],
  audit_logs: ['view'],
  admin: ['view', 'create', 'edit', 'remove'],
  apex: ['full_access'],
  rooms: ['create'],
  market_masters: ['view'],
} as const

type PermissionGroups = typeof ADMIN_PERMISSION_GROUPS
type FlattenGroup<G extends keyof PermissionGroups> = `${G}.${PermissionGroups[G][number]}`

export type AdminPermission = {
  [G in keyof PermissionGroups]: FlattenGroup<G>
}[keyof PermissionGroups]

export const ADMIN_PERMISSIONS: AdminPermission[] = (Object.entries(ADMIN_PERMISSION_GROUPS) as [keyof PermissionGroups, readonly string[]][]).flatMap(
  ([group, actions]) => actions.map((action) => `${group}.${action}` as AdminPermission),
)

/**
 * Live = backed by a real system, actually mutates/reads real data.
 * Anything not listed here is locked by default (see PERMISSION_LOCKED_REASON).
 */
const LIVE_PERMISSIONS: AdminPermission[] = [
  'users.view', 'users.create', 'users.edit', 'users.suspend', 'users.ban', 'users.delete',
  'nexus_points.view', 'nexus_points.grant', 'nexus_points.remove', 'nexus_points.audit',
  'subscriptions.view', 'subscriptions.gift', 'subscriptions.revoke',
  'xp.view', 'xp.grant', 'xp.remove', 'xp.set',
  'clashes.view', 'clashes.cancel', 'clashes.force_result',
  'achievements.view', 'achievements.create', 'achievements.edit', 'achievements.delete', 'achievements.grant', 'achievements.revoke',
  'system.view',
  'audit_logs.view',
  'admin.view', 'admin.create', 'admin.edit', 'admin.remove',
  'apex.full_access',
  'rooms.create',
  'market_masters.view',
]
const LIVE_SET = new Set(LIVE_PERMISSIONS)

export function isPermissionLive(permission: AdminPermission): boolean {
  return LIVE_SET.has(permission)
}

const LIMITED_NEXUS_LEDGER = 'Nexus Points now support admin grant/remove adjustments, but set needs a full server balance ledger rather than the user-local wallet.'
const NO_SYSTEM = (name: string) => `No ${name} system exists in AirNexus yet.`
const NO_SEMANTICS = (what: string) => `No real ${what} to act on yet.`

export const PERMISSION_LOCKED_REASON: Partial<Record<AdminPermission, string>> = {
  'users.impersonate': 'Requires a Supabase Admin API session-exchange design — a separate security feature, not built this pass.',
  'nexus_points.set': LIMITED_NEXUS_LEDGER,
  'levels.view': NO_SYSTEM('numeric level'),
  'levels.edit': NO_SYSTEM('numeric level'),
  'clashes.create': NO_SEMANTICS('breach to author'),
  'clashes.edit': NO_SEMANTICS('breach field to edit'),
  'clashes.reset': NO_SEMANTICS('breach state to reset'),
  'quests.view': NO_SYSTEM('quest'),
  'quests.create': NO_SYSTEM('quest'),
  'quests.edit': NO_SYSTEM('quest'),
  'quests.delete': NO_SYSTEM('quest'),
  'quests.assign': NO_SYSTEM('quest'),
  'items.view': NO_SYSTEM('item/inventory'),
  'items.create': NO_SYSTEM('item/inventory'),
  'items.edit': NO_SYSTEM('item/inventory'),
  'items.delete': NO_SYSTEM('item/inventory'),
  'items.grant': NO_SYSTEM('item/inventory'),
  'items.revoke': NO_SYSTEM('item/inventory'),
  'inventory.view': NO_SYSTEM('item/inventory'),
  'inventory.edit': NO_SYSTEM('item/inventory'),
  'shop.view': NO_SYSTEM('admin-manageable shop'),
  'shop.edit': NO_SYSTEM('admin-manageable shop'),
  'shop.publish': NO_SYSTEM('admin-manageable shop'),
  'clans.view': NO_SYSTEM('clan'),
  'clans.edit': NO_SYSTEM('clan'),
  'clans.disband': NO_SYSTEM('clan'),
  'leaderboards.view': NO_SYSTEM('stored leaderboard'),
  'leaderboards.edit': NO_SYSTEM('stored leaderboard'),
  'leaderboards.reset': NO_SYSTEM('stored leaderboard'),
  'seasons.view': NO_SYSTEM('season'),
  'seasons.create': NO_SYSTEM('season'),
  'seasons.edit': NO_SYSTEM('season'),
  'seasons.start': NO_SYSTEM('season'),
  'seasons.end': NO_SYSTEM('season'),
  'events.view': NO_SYSTEM('event'),
  'events.create': NO_SYSTEM('event'),
  'events.edit': NO_SYSTEM('event'),
  'events.start': NO_SYSTEM('event'),
  'events.end': NO_SYSTEM('event'),
  'reports.view': NO_SYSTEM('user report'),
  'reports.resolve': NO_SYSTEM('user report'),
  'moderation.view': 'Use Users → suspend/ban instead — this is the same underlying data under a different name.',
  'moderation.warn': NO_SYSTEM('warning/mute'),
  'moderation.mute': NO_SYSTEM('warning/mute'),
  'moderation.suspend': 'Use Users → suspend instead — this is the same underlying data under a different name.',
  'moderation.ban': 'Use Users → ban instead — this is the same underlying data under a different name.',
  'announcements.view': NO_SYSTEM('announcement'),
  'announcements.create': NO_SYSTEM('announcement'),
  'announcements.edit': NO_SYSTEM('announcement'),
  'announcements.delete': NO_SYSTEM('announcement'),
  'system.edit': 'No system configuration store exists yet.',
  'feature_flags.view': NO_SYSTEM('feature flag'),
  'feature_flags.edit': NO_SYSTEM('feature flag'),
}