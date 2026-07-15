import { computeDiversificationScore, computePortfolioValue } from '@/lib/market-masters/market-engine'
import { LESSONS } from '@/lib/market-masters/lessons'
import { MISSION_DEFINITIONS } from '@/lib/market-masters/missions'
import { STOCKS } from '@/lib/market-masters/stocks'
import type { GameState, RiskLevel, Stock } from '@/lib/market-masters/types'

export type AchievementCategory = 'trading' | 'learning' | 'risk' | 'progress'

export type Achievement = {
  id: string
  title: string
  description: string
  category: AchievementCategory
  xpReward: number
}

type AchievementDefinition = Achievement & {
  isComplete: (state: GameState, stocks: Stock[]) => boolean
}

const tradeCount = (state: GameState) => state.cashLedger.filter((t) => t.type === 'BUY' || t.type === 'SELL').length
const dividendCount = (state: GameState) => state.cashLedger.filter((t) => t.type === 'DIVIDEND').length
const strongDecisionCount = (state: GameState) => state.decisionLog.filter((entry) => entry.quality === 'strong').length

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first-trade',
    title: 'First Trade',
    description: 'Make your very first stock purchase.',
    category: 'trading',
    xpReward: 20,
    isComplete: (state) => state.cashLedger.some((t) => t.type === 'BUY'),
  },
  {
    id: 'active-trader',
    title: 'Active Trader',
    description: 'Complete 5 total trades.',
    category: 'trading',
    xpReward: 30,
    isComplete: (state) => tradeCount(state) >= 5,
  },
  {
    id: 'diversified-investor',
    title: 'Diversified Investor',
    description: 'Reach a diversification score of 60 or higher.',
    category: 'risk',
    xpReward: 40,
    isComplete: (state, stocks) => computeDiversificationScore(state, stocks) >= 60,
  },
  {
    id: 'risk-aware',
    title: 'Risk Aware',
    description: 'Hold at least one low, one medium, and one high risk stock at the same time.',
    category: 'risk',
    xpReward: 40,
    isComplete: (state, stocks) => {
      const byTicker = Object.fromEntries(stocks.map((s) => [s.ticker, s]))
      const risks = new Set<RiskLevel>()
      for (const holding of Object.values(state.holdings)) {
        if (holding.shares <= 0) continue
        const stock = byTicker[holding.ticker]
        if (stock) risks.add(stock.risk)
      }
      return risks.has('low') && risks.has('medium') && risks.has('high')
    },
  },
  {
    id: 'scholar',
    title: 'Scholar',
    description: 'Complete every lesson in the Learning Centre.',
    category: 'learning',
    xpReward: 50,
    isComplete: (state) => state.completedLessonIds.length >= LESSONS.length,
  },
  {
    id: 'week-one',
    title: 'Week One',
    description: 'Reach day 5 of the simulation.',
    category: 'progress',
    xpReward: 15,
    isComplete: (state) => state.day >= 5,
  },
  {
    id: 'four-week-veteran',
    title: 'Four-Week Veteran',
    description: 'Reach day 20 of the simulation.',
    category: 'progress',
    xpReward: 30,
    isComplete: (state) => state.day >= 20,
  },
  {
    id: 'dividend-collector',
    title: 'Dividend Collector',
    description: 'Receive 3 separate dividend payments.',
    category: 'trading',
    xpReward: 30,
    isComplete: (state) => dividendCount(state) >= 3,
  },
  {
    id: 'mission-master',
    title: 'Mission Master',
    description: 'Complete every mission.',
    category: 'progress',
    xpReward: 60,
    isComplete: (state) => state.completedMissionIds.length >= MISSION_DEFINITIONS.length,
  },
  {
    id: 'news-detective',
    title: 'News Detective',
    description: 'Correctly flag 3 misleading news headlines.',
    category: 'learning',
    xpReward: 40,
    isComplete: (state) => state.identifiedMisleadingNewsIds.length >= 3,
  },
  {
    id: 'thoughtful-investor',
    title: 'Thoughtful Investor',
    description: 'Make the strongest choice in 3 decision challenges.',
    category: 'learning',
    xpReward: 40,
    isComplete: (state) => strongDecisionCount(state) >= 3,
  },
  {
    id: 'comeback',
    title: 'Comeback',
    description: 'Recover above your starting balance after a downturn.',
    category: 'progress',
    xpReward: 40,
    isComplete: (state) => {
      const startingCash = state.preferences.startingCash
      return state.portfolioHistory.some((point) => point.value < startingCash) && computePortfolioValue(state) > startingCash
    },
  },
  {
    id: 'big-portfolio',
    title: 'Fifty-Percent Club',
    description: 'Grow your portfolio value to 150% of your starting balance.',
    category: 'progress',
    xpReward: 50,
    isComplete: (state) => computePortfolioValue(state) >= state.preferences.startingCash * 1.5,
  },
]

export function evaluateNewlyUnlockedAchievements(previous: GameState, next: GameState, stocks: Stock[] = STOCKS): string[] {
  return ACHIEVEMENT_DEFINITIONS
    .filter((achievement) => !previous.unlockedAchievementIds.includes(achievement.id))
    .filter((achievement) => achievement.isComplete(next, stocks))
    .map((achievement) => achievement.id)
}

export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === id)
}
