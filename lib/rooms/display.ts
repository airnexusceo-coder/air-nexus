/**
 * Pure, client-safe display helpers shared by every UI surface that renders
 * a real room member (context panel, room leaderboard) — deterministic, so
 * the same person renders with the same initials/color everywhere without a
 * server round trip.
 */

const MEMBER_GRADIENTS = [
  'from-white to-zinc-200',
  'from-white to-zinc-300',
  'from-zinc-300 to-zinc-500',
  'from-zinc-400 to-zinc-600',
  'from-zinc-500 to-zinc-700',
  'from-zinc-600 to-zinc-800',
]

export function initialsFor(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function colorForUser(userId: string) {
  let hash = 0
  for (let index = 0; index < userId.length; index += 1) hash = (hash * 31 + userId.charCodeAt(index)) >>> 0
  return MEMBER_GRADIENTS[hash % MEMBER_GRADIENTS.length]
}
