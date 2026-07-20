export type CosmeticCategory = 'avatar' | 'badge' | 'ui'

export type UiThemeId = 'standard' | 'lunar-path' | 'daybreak' | 'neon-city' | 'plasma-core' | 'starlit-focus'

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
  /** Full workspace theme applied after a UI cosmetic is equipped. */
  uiTheme?: UiThemeId
  marketplaceTag?: string
}

export const DEFAULT_UI_THEME: UiThemeId = 'standard'

export const UI_THEME_IDS: UiThemeId[] = ['standard', 'lunar-path', 'daybreak', 'neon-city', 'plasma-core', 'starlit-focus']

export const COSMETIC_CATALOG: CosmeticItem[] = [
  { id: 'avatar-sunset', category: 'avatar', name: 'Sunset Avatar', description: 'Warm orange-to-rose gradient for your avatar.', cost: 300, avatarGradient: 'from-orange-500 to-rose-500' },
  { id: 'avatar-ocean', category: 'avatar', name: 'Ocean Avatar', description: 'Cool blue-to-cyan gradient for your avatar.', cost: 300, avatarGradient: 'from-blue-500 to-cyan-400' },
  { id: 'avatar-emerald', category: 'avatar', name: 'Emerald Avatar', description: 'Rich green gradient for your avatar.', cost: 300, avatarGradient: 'from-emerald-500 to-teal-400' },
  { id: 'avatar-violet', category: 'avatar', name: 'Violet Avatar', description: 'Deep purple gradient for your avatar.', cost: 300, avatarGradient: 'from-violet-500 to-fuchsia-500' },
  { id: 'avatar-gold', category: 'avatar', name: 'Gold Avatar', description: 'Metallic gold gradient for your avatar.', cost: 450, avatarGradient: 'from-amber-400 to-yellow-600' },
  { id: 'avatar-blossom', category: 'avatar', name: 'Cherry Blossom Avatar', description: 'Soft pink-to-rose gradient for your avatar.', cost: 300, avatarGradient: 'from-pink-300 to-rose-400' },
  { id: 'avatar-mint', category: 'avatar', name: 'Mint Fresh Avatar', description: 'Cool teal-to-lime gradient for your avatar.', cost: 300, avatarGradient: 'from-teal-400 to-lime-300' },
  { id: 'avatar-steel', category: 'avatar', name: 'Steel Avatar', description: 'Understated slate gradient for your avatar.', cost: 300, avatarGradient: 'from-slate-500 to-slate-700' },
  { id: 'avatar-galaxy', category: 'avatar', name: 'Galaxy Avatar', description: 'Deep-space indigo-to-pink gradient for your avatar.', cost: 400, avatarGradient: 'from-indigo-600 via-purple-600 to-pink-500' },
  { id: 'avatar-aurora', category: 'avatar', name: 'Aurora Avatar', description: 'Cyan-to-emerald gradient inspired by the northern lights.', cost: 500, avatarGradient: 'from-cyan-400 via-teal-300 to-emerald-400' },
  { id: 'avatar-inferno', category: 'avatar', name: 'Inferno Avatar', description: 'Blazing red-to-amber gradient for your avatar.', cost: 500, avatarGradient: 'from-red-600 via-orange-500 to-amber-400' },
  { id: 'avatar-cosmic', category: 'avatar', name: 'Cosmic Avatar', description: 'Violet-to-pink three-stop gradient for your avatar.', cost: 550, avatarGradient: 'from-violet-600 via-fuchsia-500 to-pink-400' },
  { id: 'avatar-midnight-gold', category: 'avatar', name: 'Midnight Gold Avatar', description: 'Rare near-black-to-gold gradient for your avatar.', cost: 850, avatarGradient: 'from-zinc-900 via-amber-600 to-yellow-300' },
  { id: 'badge-scholar', category: 'badge', name: 'Top Scholar', description: 'A Top Scholar badge next to your name.', cost: 500, badgeLabel: 'Top Scholar', badgeClassName: 'bg-blue-400/10 text-blue-200' },
  { id: 'badge-founder', category: 'badge', name: 'Founding Member', description: 'A Founding Member badge next to your name.', cost: 750, badgeLabel: 'Founding Member', badgeClassName: 'bg-amber-400/10 text-amber-200' },
  { id: 'badge-streak', category: 'badge', name: 'Streak Master', description: 'A Streak Master badge next to your name.', cost: 600, badgeLabel: 'Streak Master', badgeClassName: 'bg-orange-400/10 text-orange-200' },
  { id: 'badge-elite', category: 'badge', name: 'Elite Member', description: 'An Elite Member badge next to your name.', cost: 900, badgeLabel: 'Elite', badgeClassName: 'bg-violet-400/10 text-violet-200' },
  { id: 'badge-night-owl', category: 'badge', name: 'Night Owl', description: 'For the ones still studying at midnight.', cost: 400, badgeLabel: 'Night Owl', badgeClassName: 'bg-indigo-400/10 text-indigo-200' },
  { id: 'badge-early-bird', category: 'badge', name: 'Early Bird', description: 'First one in the study room, every time.', cost: 400, badgeLabel: 'Early Bird', badgeClassName: 'bg-sky-400/10 text-sky-200' },
  { id: 'badge-caffeine', category: 'badge', name: 'Caffeine Powered', description: 'Runs on coffee, tea, and ambition.', cost: 450, badgeLabel: 'Caffeine Powered', badgeClassName: 'bg-yellow-400/10 text-yellow-200' },
  { id: 'badge-mathlete', category: 'badge', name: 'Mathlete', description: 'Numbers fear this one.', cost: 500, badgeLabel: 'Mathlete', badgeClassName: 'bg-cyan-400/10 text-cyan-200' },
  { id: 'badge-wordsmith', category: 'badge', name: 'Wordsmith', description: 'Essays that actually flow.', cost: 500, badgeLabel: 'Wordsmith', badgeClassName: 'bg-fuchsia-400/10 text-fuchsia-200' },
  { id: 'badge-comeback-kid', category: 'badge', name: 'Comeback Kid', description: 'Bounced back stronger than ever.', cost: 550, badgeLabel: 'Comeback Kid', badgeClassName: 'bg-lime-400/10 text-lime-200' },
  { id: 'badge-deadline-slayer', category: 'badge', name: 'Deadline Slayer', description: 'Never late, always ready.', cost: 600, badgeLabel: 'Deadline Slayer', badgeClassName: 'bg-rose-400/10 text-rose-200' },
  { id: 'badge-last-minute-legend', category: 'badge', name: 'Last-Minute Legend', description: 'Somehow it always works out.', cost: 500, badgeLabel: 'Last-Minute Legend', badgeClassName: 'bg-teal-400/10 text-teal-200' },
  { id: 'badge-perfectionist', category: 'badge', name: 'Perfectionist', description: '100% or it does not count.', cost: 800, badgeLabel: 'Perfectionist', badgeClassName: 'bg-red-400/10 text-red-200' },
  { id: 'ui-lunar-path', category: 'ui', name: 'Lunar Path UI', description: 'Moonlit cloudscape with a soft comet trail and hover-lit controls.', cost: 900, uiTheme: 'lunar-path', marketplaceTag: 'Moonlight' },
  { id: 'ui-daybreak', category: 'ui', name: 'Daybreak UI', description: 'Bright sky glass with airy clouds and a gentle study glow.', cost: 1100, uiTheme: 'daybreak', marketplaceTag: 'Light mode' },
  { id: 'ui-neon-city', category: 'ui', name: 'Neon City UI', description: 'Futuristic skyline, electric blue trails, and sharper interactive chrome.', cost: 1450, uiTheme: 'neon-city', marketplaceTag: 'Cyber' },
  { id: 'ui-plasma-core', category: 'ui', name: 'Plasma Core UI', description: 'Reactive ember blobs and dark molten glass for high-focus sessions.', cost: 1650, uiTheme: 'plasma-core', marketplaceTag: 'Reactive' },
  { id: 'ui-starlit-focus', category: 'ui', name: 'Starlit Focus UI', description: 'The premium highlighted-input theme. Its light ribbons move only while you type.', cost: 2400, uiTheme: 'starlit-focus', marketplaceTag: 'Costliest' },
]

export const DEFAULT_AVATAR_GRADIENT = 'from-zinc-600 to-zinc-800'

export function getCosmetic(id: string | null): CosmeticItem | null {
  if (!id) return null
  return COSMETIC_CATALOG.find((item) => item.id === id) ?? null
}

export function isUiThemeId(value: unknown): value is UiThemeId {
  return typeof value === 'string' && UI_THEME_IDS.includes(value as UiThemeId)
}

export function avatarGradientFor(equippedAvatar: string | null): string {
  return getCosmetic(equippedAvatar)?.avatarGradient ?? DEFAULT_AVATAR_GRADIENT
}
