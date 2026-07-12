import assert from 'node:assert/strict'
import { deriveFriendshipState } from '../lib/airnexus/relationship-state'
import { clampMotivationSyncInput } from '../lib/motivation-sync-clamp'

// --- deriveFriendshipState --------------------------------------------------
// Shared by the search results list and the profile view — both surfaces
// must agree on when to show "Friends", "Pending", or an add-friend action.

assert.equal(deriveFriendshipState(true, null), 'friends', 'an accepted friend shows as friends regardless of friendshipStatus')
assert.equal(deriveFriendshipState(true, 'pending'), 'friends', 'isFriend wins even if a stale pending status is also present')
assert.equal(deriveFriendshipState(false, 'pending'), 'pending', 'a non-friend with a pending request shows as pending')
assert.equal(deriveFriendshipState(false, 'accepted'), 'none', 'friendshipStatus accepted without isFriend still falls through to none — isFriend is the source of truth')
assert.equal(deriveFriendshipState(false, null), 'none', 'a stranger with no request shows the add-friend action')

// --- clampMotivationSyncInput -----------------------------------------------
// Self-reported stats are bounds-checked before being persisted — the client
// is untrusted even though nothing here is a spendable resource.

assert.deepEqual(
  clampMotivationSyncInput({ lifetimeXp: 500, currentStreakDays: 12, longestStreakDays: 30 }),
  { lifetimeXp: 500, currentStreakDays: 12, longestStreakDays: 30 },
  'ordinary in-range values pass through unchanged',
)

assert.deepEqual(
  clampMotivationSyncInput({ lifetimeXp: -100, currentStreakDays: -5, longestStreakDays: -1 }),
  { lifetimeXp: 0, currentStreakDays: 0, longestStreakDays: 0 },
  'negative values clamp to zero',
)

assert.deepEqual(
  clampMotivationSyncInput({ lifetimeXp: 50_000_000, currentStreakDays: 999_999, longestStreakDays: 999_999 }),
  { lifetimeXp: 1_000_000, currentStreakDays: 3650, longestStreakDays: 3650 },
  'huge values clamp to the configured ceilings',
)

assert.deepEqual(
  clampMotivationSyncInput({ lifetimeXp: 100, currentStreakDays: 40, longestStreakDays: 10 }),
  { lifetimeXp: 100, currentStreakDays: 40, longestStreakDays: 40 },
  'longest streak is raised to at least the current streak — a client cannot report a longest streak shorter than today\'s',
)

assert.deepEqual(
  clampMotivationSyncInput({ lifetimeXp: Number.NaN, currentStreakDays: Number.NaN, longestStreakDays: Number.NaN }),
  { lifetimeXp: 0, currentStreakDays: 0, longestStreakDays: 0 },
  'NaN input (e.g. a malformed client payload) fails closed to zero rather than persisting NaN',
)

assert.deepEqual(
  clampMotivationSyncInput({ lifetimeXp: 12.6, currentStreakDays: 5.4, longestStreakDays: 5.5 }),
  { lifetimeXp: 13, currentStreakDays: 5, longestStreakDays: 6 },
  'fractional values are rounded before storage',
)

console.log('Player Discovery pure-logic tests passed')
