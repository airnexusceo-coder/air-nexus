import 'server-only'

import {
  readSupabaseRestJson,
  supabaseRestFetch,
  SupabaseRequestError,
  type ServerAuthSession,
} from '@/lib/supabase/server'

/**
 * AirNexus friend graph — shared across AirGPT and Apex (one friend system, no
 * duplicates). Backed by the `friendships` table + `airnexus_*` RPCs from
 * migration 0002. All calls use the caller's own token (RLS-scoped).
 */

function encode(value: string) {
  return encodeURIComponent(value)
}

export type AcceptedFriendRow = {
  user_id: string
  display_name: string
  apex_xp: number
  allow_nexus_challenges: boolean
}

export type FriendRequestRow = {
  id: string
  direction: 'incoming' | 'outgoing'
  other_user_id: string
  display_name: string
  status: string
  created_at: string
}

export type ProfileSearchResult = {
  userId: string
  displayName: string
  apexXp: number
  isFriend: boolean
  isFollowing: boolean
  friendshipStatus: 'pending' | 'accepted' | null
}

export type PublicProfile = {
  userId: string
  displayName: string
  apexXp: number
  lifetimeXp: number
  currentStreakDays: number
  longestStreakDays: number
  statsSyncedAt: string | null
  isFriend: boolean
  isFollowing: boolean
  isFollowedBy: boolean
  friendshipStatus: 'pending' | 'accepted' | null
  followerCount: number
  followingCount: number
}

export async function getAcceptedFriends(auth: ServerAuthSession): Promise<AcceptedFriendRow[]> {
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_accepted_friends')
  return readSupabaseRestJson<AcceptedFriendRow[]>(response, 'Failed to load friends')
}

export async function listFriendRequests(auth: ServerAuthSession): Promise<FriendRequestRow[]> {
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_list_friend_requests')
  return readSupabaseRestJson<FriendRequestRow[]>(response, 'Failed to load friend requests')
}

export async function sendFriendRequest(auth: ServerAuthSession, email: string) {
  const target = typeof email === 'string' ? email.trim() : ''
  if (!/^\S+@\S+\.\S+$/.test(target)) throw new SupabaseRequestError('Enter a valid email address.', 400)
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_send_friend_request', {
    method: 'POST',
    body: JSON.stringify({ target_email: target }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not send friend request')
}

/** Same as sendFriendRequest, keyed by user id — used from search results/profiles, which never expose email. */
export async function sendFriendRequestById(auth: ServerAuthSession, targetUserId: string) {
  if (typeof targetUserId !== 'string' || !targetUserId) throw new SupabaseRequestError('User id required.', 400)
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_send_friend_request_by_id', {
    method: 'POST',
    body: JSON.stringify({ p_target_user_id: targetUserId }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not send friend request')
}

export async function respondFriendRequest(auth: ServerAuthSession, friendshipId: string, action: 'accept' | 'block') {
  if (typeof friendshipId !== 'string' || !friendshipId) throw new SupabaseRequestError('Friendship id required.', 400)
  const status = action === 'accept' ? 'accepted' : 'blocked'
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/friendships?id=eq.${encode(friendshipId)}&addressee_id=eq.${encode(auth.user.id)}`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status }) },
  )
  const rows = await readSupabaseRestJson<unknown[]>(response, 'Could not update friend request')
  if (rows.length === 0) throw new SupabaseRequestError('Friend request not found.', 404)
}

export async function setAllowNexusChallenges(auth: ServerAuthSession, allow: boolean) {
  const response = await supabaseRestFetch(auth.accessToken, `/profiles?user_id=eq.${encode(auth.user.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ allow_nexus_challenges: Boolean(allow) }),
  })
  await readSupabaseRestJson(response, 'Could not update setting')
}

/**
 * Writes the real `profiles.display_name` — what the friend graph, room
 * chat, mentions, and notifications actually show to other users. Keep this
 * in sync with any client-side display-name rename (e.g. the Settings
 * profile field), which previously only touched localStorage.
 */
export async function setDisplayName(auth: ServerAuthSession, name: string) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed || trimmed.length > 80) throw new SupabaseRequestError('Enter a name (1-80 characters).', 400)
  const response = await supabaseRestFetch(auth.accessToken, `/profiles?user_id=eq.${encode(auth.user.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ display_name: trimmed }),
  })
  await readSupabaseRestJson(response, 'Could not update display name')
}

type SearchProfileRow = {
  user_id: string
  display_name: string
  apex_xp: number
  is_friend: boolean
  is_following: boolean
  friendship_status: string | null
}

/** Player search — the only path to a non-friend's profile. Never returns email; see airnexus_search_profiles in migration 0007. */
export async function searchProfiles(auth: ServerAuthSession, query: string): Promise<ProfileSearchResult[]> {
  const trimmed = typeof query === 'string' ? query.trim() : ''
  if (trimmed.length < 2) throw new SupabaseRequestError('Enter at least 2 characters to search.', 400)
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_search_profiles', {
    method: 'POST',
    body: JSON.stringify({ p_query: trimmed }),
  })
  const rows = await readSupabaseRestJson<SearchProfileRow[]>(response, 'Search failed')
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    apexXp: row.apex_xp,
    isFriend: row.is_friend,
    isFollowing: row.is_following,
    friendshipStatus: row.friendship_status as ProfileSearchResult['friendshipStatus'],
  }))
}

type PublicProfileRow = {
  user_id: string
  display_name: string
  apex_xp: number
  lifetime_xp: number
  current_streak_days: number
  longest_streak_days: number
  stats_synced_at: string | null
  is_friend: boolean
  is_following: boolean
  is_followed_by: boolean
  friendship_status: string | null
  follower_count: number
  following_count: number
}

export async function getPublicProfile(auth: ServerAuthSession, targetUserId: string): Promise<PublicProfile> {
  if (typeof targetUserId !== 'string' || !targetUserId) throw new SupabaseRequestError('User id required.', 400)
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_public_profile', {
    method: 'POST',
    body: JSON.stringify({ p_target_user_id: targetUserId }),
  })
  const rows = await readSupabaseRestJson<PublicProfileRow[]>(response, 'Failed to load profile')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Profile not found.', 404)
  return {
    userId: row.user_id,
    displayName: row.display_name,
    apexXp: row.apex_xp,
    lifetimeXp: row.lifetime_xp,
    currentStreakDays: row.current_streak_days,
    longestStreakDays: row.longest_streak_days,
    statsSyncedAt: row.stats_synced_at,
    isFriend: row.is_friend,
    isFollowing: row.is_following,
    isFollowedBy: row.is_followed_by,
    friendshipStatus: row.friendship_status as PublicProfile['friendshipStatus'],
    followerCount: row.follower_count,
    followingCount: row.following_count,
  }
}

export async function followUser(auth: ServerAuthSession, targetUserId: string): Promise<void> {
  if (typeof targetUserId !== 'string' || !targetUserId) throw new SupabaseRequestError('User id required.', 400)
  if (targetUserId === auth.user.id) throw new SupabaseRequestError('You cannot follow yourself.', 400)
  const response = await supabaseRestFetch(auth.accessToken, '/follows', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ follower_id: auth.user.id, followed_id: targetUserId }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not follow user')
}

export async function unfollowUser(auth: ServerAuthSession, targetUserId: string): Promise<void> {
  if (typeof targetUserId !== 'string' || !targetUserId) throw new SupabaseRequestError('User id required.', 400)
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/follows?follower_id=eq.${encode(auth.user.id)}&followed_id=eq.${encode(targetUserId)}`,
    { method: 'DELETE' },
  )
  if (!response.ok) await readSupabaseRestJson(response, 'Could not unfollow user')
}
