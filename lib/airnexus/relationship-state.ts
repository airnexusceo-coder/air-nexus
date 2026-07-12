export type FriendshipState = 'friends' | 'pending' | 'none'

/** Shared by the search results list and the profile view so both surfaces agree on when to show "Friends", "Pending", or an add-friend action. */
export function deriveFriendshipState(isFriend: boolean, friendshipStatus: 'pending' | 'accepted' | null): FriendshipState {
  if (isFriend) return 'friends'
  if (friendshipStatus === 'pending') return 'pending'
  return 'none'
}
