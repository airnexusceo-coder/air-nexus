import { computeIndustryAllocation, computePortfolioValue } from '@/lib/market-masters/market-engine'
import { STOCKS } from '@/lib/market-masters/stocks'
import type { GameState, Stock } from '@/lib/market-masters/types'

/**
 * Challenge Mode's single built-in objective. Kept as one fixed, computable
 * goal rather than a full goal-picker system — the brief asks for "specific
 * portfolio goals with fewer hints," not a goal-authoring tool.
 */
export const CHALLENGE_GOAL = {
  title: 'Beat the Challenge',
  description: 'Reach $11,500 in portfolio value while holding stocks from at least 3 different industries, by day 20.',
  targetValue: 11500,
  minIndustries: 3,
  targetDay: 20,
}

export function isChallengeGoalAchieved(state: GameState, stocks: Stock[] = STOCKS): boolean {
  return computePortfolioValue(state) >= CHALLENGE_GOAL.targetValue && computeIndustryAllocation(state, stocks).length >= CHALLENGE_GOAL.minIndustries
}

export function isChallengeGoalFailed(state: GameState): boolean {
  return state.day > CHALLENGE_GOAL.targetDay
}
