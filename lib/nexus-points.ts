import type { NexusPlan } from '@/lib/plans'
import { DEFAULT_UI_THEME, isUiThemeId, type UiThemeId } from '@/lib/cosmetics'

export type NexusTransaction = {
  id: string
  kind: 'earned' | 'spent'
  amount: number
  description: string
  createdAt: string
}

export type NexusRewardsState = {
  nexusPoints: number
  plan: NexusPlan
  planExpiry: string | null
  redeemedRewards: string[]
  transactions: NexusTransaction[]
  rewardedActions: string[]
  lastDailyLogin: string | null
  equippedAvatar: string | null
  equippedBadge: string | null
  equippedUiTheme: UiThemeId
}

export const NEXUS_REWARDS_STORAGE_KEY = 'airnexus-nexus-rewards-v1'
export const DAILY_LOGIN_REWARD = 25
export const TASK_COMPLETION_REWARD = 10

export function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function createTransaction(
  kind: NexusTransaction['kind'],
  amount: number,
  description: string,
  now = new Date(),
): NexusTransaction {
  return {
    id: `${now.getTime()}-${kind}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    amount,
    description,
    createdAt: now.toISOString(),
  }
}

export function canRedeem(balance: number, cost: number) {
  return Number.isFinite(balance) && Number.isFinite(cost) && balance >= cost && cost >= 0
}

export function parseRewardsState(value: string | null): NexusRewardsState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<NexusRewardsState>
    if (!Number.isFinite(parsed.nexusPoints) || (parsed.nexusPoints ?? -1) < 0) return null
    if (parsed.plan !== 'Free' && parsed.plan !== 'Plus' && parsed.plan !== 'Premium') return null
    return {
      nexusPoints: parsed.nexusPoints as number,
      plan: parsed.plan,
      planExpiry: typeof parsed.planExpiry === 'string' ? parsed.planExpiry : null,
      redeemedRewards: Array.isArray(parsed.redeemedRewards) ? parsed.redeemedRewards.filter((item): item is string => typeof item === 'string') : [],
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions.filter((item): item is NexusTransaction => Boolean(
          item && typeof item.id === 'string' && (item.kind === 'earned' || item.kind === 'spent') &&
          typeof item.amount === 'number' && item.amount > 0 && typeof item.description === 'string' && typeof item.createdAt === 'string',
        ))
        : [],
      rewardedActions: Array.isArray(parsed.rewardedActions) ? parsed.rewardedActions.filter((item): item is string => typeof item === 'string') : [],
      lastDailyLogin: typeof parsed.lastDailyLogin === 'string' ? parsed.lastDailyLogin : null,
      equippedAvatar: typeof parsed.equippedAvatar === 'string' ? parsed.equippedAvatar : null,
      equippedBadge: typeof parsed.equippedBadge === 'string' ? parsed.equippedBadge : null,
      equippedUiTheme: isUiThemeId(parsed.equippedUiTheme) ? parsed.equippedUiTheme : DEFAULT_UI_THEME,
    }
  } catch {
    return null
  }
}
