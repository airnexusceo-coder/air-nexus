import { computeDiversificationScore, computeIndustryAllocation, computePortfolioValue, computeProfitLoss } from '@/lib/market-masters/market-engine'
import { STOCKS } from '@/lib/market-masters/stocks'
import type { GameState, Mission, Stock } from '@/lib/market-masters/types'

type MissionDefinition = Mission & {
  isComplete: (state: GameState, stocks: Stock[]) => boolean
}

const activeHoldingCount = (state: GameState) => Object.values(state.holdings).filter((h) => h.shares > 0).length

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  {
    id: 'first-stock',
    title: 'Buy Your First Stock',
    description: 'Make your first purchase in the stock market.',
    xpReward: 30,
    cashReward: 100,
    isComplete: (state) => state.cashLedger.some((t) => t.type === 'BUY'),
  },
  {
    id: 'three-companies',
    title: 'Build a Portfolio of Three Companies',
    description: 'Hold shares in at least three different companies at once.',
    xpReward: 40,
    cashReward: 150,
    isComplete: (state) => activeHoldingCount(state) >= 3,
  },
  {
    id: 'three-industries',
    title: 'Invest Across Three Industries',
    description: 'Hold at least one stock from three different industries.',
    xpReward: 50,
    cashReward: 150,
    isComplete: (state, stocks) => computeIndustryAllocation(state, stocks).length >= 3,
  },
  {
    id: 'keep-cash-buffer',
    title: 'Keep a Cash Buffer',
    description: 'Hold at least 20% of your portfolio value in cash while invested.',
    xpReward: 30,
    cashReward: 100,
    isComplete: (state) => {
      if (activeHoldingCount(state) === 0) return false
      const total = computePortfolioValue(state)
      return total > 0 && state.cash / total >= 0.2
    },
  },
  {
    id: 'diversification-lesson',
    title: 'Learn About Diversification',
    description: 'Complete the diversification lesson in the Learning Centre.',
    xpReward: 30,
    cashReward: 0,
    isComplete: (state) => state.completedLessonIds.includes('diversification'),
  },
  {
    id: 'positive-return-4-weeks',
    title: 'Stay Positive for Four Weeks',
    description: 'Reach day 20 (four simulated weeks) with a positive overall return.',
    xpReward: 60,
    cashReward: 250,
    isComplete: (state) => state.day >= 20 && computeProfitLoss(state).value > 0,
  },
  {
    id: 'recover-from-downturn',
    title: 'Recover From a Downturn',
    description: 'Bounce back above your starting balance after your portfolio dropped below it.',
    xpReward: 50,
    cashReward: 200,
    isComplete: (state) => {
      const startingCash = state.preferences.startingCash
      const everDipped = state.portfolioHistory.some((point) => point.value < startingCash)
      return everDipped && computePortfolioValue(state) > startingCash
    },
  },
  {
    id: 'first-dividend',
    title: 'Receive Your First Dividend',
    description: 'Hold a dividend-paying stock long enough to receive a payout.',
    xpReward: 30,
    cashReward: 0,
    isComplete: (state) => state.cashLedger.some((t) => t.type === 'DIVIDEND'),
  },
  {
    id: 'spot-misleading-news',
    title: 'Spot a Misleading Headline',
    description: 'Correctly flag a news story that is exaggerating a company\'s actual news.',
    xpReward: 40,
    cashReward: 100,
    isComplete: (state) => state.identifiedMisleadingNewsIds.length > 0,
  },
  {
    id: 'balanced-portfolio',
    title: 'Build a Balanced Portfolio',
    description: 'Reach a diversification score of 60 or higher.',
    xpReward: 60,
    cashReward: 250,
    isComplete: (state, stocks) => computeDiversificationScore(state, stocks) >= 60,
  },
]

/** Returns mission ids that just became complete this update (were incomplete before, complete now). */
export function evaluateNewlyCompletedMissions(previous: GameState, next: GameState, stocks: Stock[] = STOCKS): string[] {
  return MISSION_DEFINITIONS
    .filter((mission) => !previous.completedMissionIds.includes(mission.id))
    .filter((mission) => mission.isComplete(next, stocks))
    .map((mission) => mission.id)
}

export function getMission(id: string): MissionDefinition | undefined {
  return MISSION_DEFINITIONS.find((mission) => mission.id === id)
}
