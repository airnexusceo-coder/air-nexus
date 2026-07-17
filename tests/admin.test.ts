import assert from 'node:assert/strict'
import { hasPermission } from '../lib/admin/permission-check'
import { ADMIN_PERMISSIONS, isPermissionLive, PERMISSION_LOCKED_REASON } from '../lib/admin/permissions'
import { hashPassword, verifyPassword } from '../lib/admin/password'

// --- hasPermission ---------------------------------------------------------

assert.equal(hasPermission({ role: 'super_admin', permissions: [] }, 'users.delete'), true, 'super_admin bypasses every permission, even with an empty grants array')
assert.equal(hasPermission({ role: 'admin', permissions: ['users.view'] }, 'users.view'), true, 'an explicitly granted permission passes')
assert.equal(hasPermission({ role: 'admin', permissions: ['users.view'] }, 'users.ban'), false, 'a permission not in the grants array is denied')
assert.equal(hasPermission({ role: 'admin', permissions: [] }, 'users.view'), false, 'an admin with no grants has no permissions at all')

// --- permission taxonomy consistency ---------------------------------------
// Hand-written live/locked map — this catches typos: every locked
// permission must actually be absent from the live set, and vice versa.

for (const permission of ADMIN_PERMISSIONS) {
  const live = isPermissionLive(permission)
  const reason = PERMISSION_LOCKED_REASON[permission]
  if (live) {
    assert.equal(reason, undefined, `"${permission}" is marked live but also has a locked reason — contradictory`)
  } else {
    assert.ok(typeof reason === 'string' && reason.length > 0, `"${permission}" is locked but has no reason shown to the admin`)
  }
}

assert.ok(ADMIN_PERMISSIONS.includes('rooms.create'), 'rooms.create exists in the taxonomy — the concrete original ask')
assert.equal(isPermissionLive('rooms.create'), true, 'rooms.create is live — it is the one permission this whole feature exists to enforce')
assert.equal(isPermissionLive('nexus_points.grant'), true, 'nexus_points.grant is live — admin gifts are backed by nexus_point_grants')
assert.equal(isPermissionLive('nexus_points.remove'), false, 'nexus_points.remove stays locked until there is a full server balance ledger')
assert.equal(isPermissionLive('subscriptions.gift'), true, 'subscriptions.gift is live — admin plan gifts are stored separately from Stripe')
assert.equal(isPermissionLive('subscriptions.revoke'), true, 'subscriptions.revoke is live — admin plan gifts can be cleared')
assert.equal(isPermissionLive('users.impersonate'), false, 'impersonation stays locked — flagged as a separate follow-up, not silently built')

// --- password hashing --------------------------------------------------

const stored = hashPassword('correct horse battery staple')
assert.equal(verifyPassword('correct horse battery staple', stored), true, 'the correct password verifies')
assert.equal(verifyPassword('wrong password', stored), false, 'an incorrect password is rejected')
assert.equal(verifyPassword('correct horse battery staple', hashPassword('correct horse battery staple')), true, 'hashing the same password twice still verifies correctly (independent salts)')
assert.notEqual(hashPassword('same password'), hashPassword('same password'), 'two hashes of the same password differ — each call uses a fresh random salt')
assert.equal(verifyPassword('anything', 'not-a-valid-stored-hash'), false, 'a malformed stored hash fails closed, not open')
assert.equal(verifyPassword('anything', ''), false, 'an empty stored hash fails closed')

console.log('Admin permission/password tests passed')