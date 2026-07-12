export type CosmeticCategory = 'avatar' | 'badge'

export type CosmeticItem = {
  id: string
  category: CosmeticCategory
  name: string
  description: string
  cost: number
  /** Tailwind gradient utility applied to the avatar circle (category: avatar). */
  avatarGradient?: string
  /** Short label + color classes rendered as a pill next to the display name (category: badge). */
  badgeLabel?: string
  badgeClassName?: string
}

export const COSMETIC_CATALOG: CosmeticItem[] = [
  { id: 'avatar-sunset', category: 'avatar', name: 'Sunset Avatar', description: 'Warm orange-to-rose gradient for your avatar.', cost: 300, avatarGradient: 'from-orange-500 to-rose-500' },
  { id: 'avatar-ocean', category: 'avatar', name: 'Ocean Avatar', description: 'Cool blue-to-cyan gradient for your avatar.', cost: 300, avatarGradient: 'from-blue-500 to-cyan-400' },
  { id: 'avatar-emerald', category: 'avatar', name: 'Emerald Avatar', description: 'Rich green gradient for your avatar.', cost: 300, avatarGradient: 'from-emerald-500 to-teal-400' },
  { id: 'avatar-violet', category: 'avatar', name: 'Violet Avatar', description: 'Deep purple gradient for your avatar.', cost: 300, avatarGradient: 'from-violet-500 to-fuchsia-500' },
  { id: 'avatar-gold', category: 'avatar', name: 'Gold Avatar', description: 'Metallic gold gradient for your avatar.', cost: 450, avatarGradient: 'from-amber-400 to-yellow-600' },
  { id: 'badge-scholar', category: 'badge', name: 'Top Scholar', description: 'A Top Scholar badge next to your name.', cost: 500, badgeLabel: 'Top Scholar', badgeClassName: 'bg-blue-400/10 text-blue-200' },
  { id: 'badge-founder', category: 'badge', name: 'Founding Member', description: 'A Founding Member badge next to your name.', cost: 750, badgeLabel: 'Founding Member', badgeClassName: 'bg-amber-400/10 text-amber-200' },
  { id: 'badge-streak', category: 'badge', name: 'Streak Master', description: 'A Streak Master badge next to your name.', cost: 600, badgeLabel: 'Streak Master', badgeClassName: 'bg-orange-400/10 text-orange-200' },
  { id: 'badge-elite', category: 'badge', name: 'Elite Member', description: 'An Elite Member badge next to your name.', cost: 900, badgeLabel: 'Elite', badgeClassName: 'bg-violet-400/10 text-violet-200' },
]

export const DEFAULT_AVATAR_GRADIENT = 'from-zinc-600 to-zinc-800'

export function getCosmetic(id: string | null): CosmeticItem | null {
  if (!id) return null
  return COSMETIC_CATALOG.find((item) => item.id === id) ?? null
}

export function avatarGradientFor(equippedAvatar: string | null): string {
  return getCosmetic(equippedAvatar)?.avatarGradient ?? DEFAULT_AVATAR_GRADIENT
}
