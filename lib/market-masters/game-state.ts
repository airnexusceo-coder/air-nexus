import { evaluateNewlyUnlockedAchievements, getAchievement } from '@/lib/market-masters/achievements'
import { pickDailyChallengeTask, todayDateKey, type DailyChallengeTask } from '@/lib/market-masters/daily-challenge'
import {
  appendCashTransaction,
  advanceTick,
  createInitialPriceHistory,
  createInitialPrices,
  computeHoldingsValue,
  computeIndustryAllocation,
  computePortfolioValue,
  sumCashLedger,
} from '@/lib/market-masters/market-engine'
import { isMarketOpenAt, nextMarketOpen } from '@/lib/market-masters/market-hours'
import { getLesson } from '@/lib/market-masters/lessons'
import { evaluateNewlyCompletedMissions, getMission } from '@/lib/market-masters/missions'
import { STOCKS } from '@/lib/market-masters/stocks'
import {
  CURRENT_SAVE_VERSION,
  DEFAULT_PREFERENCES,
  MARKET_TICK_INTERVAL_MS,
  type DecisionOptionQuality,
  type GamePreferences,
  type GameState,
  type NewsItem,
  type Stock,
} from '@/lib/market-masters/types'

export function createInitialState(preferences: GamePreferences = DEFAULT_PREFERENCES): GameState {
  const startedAt = new Date().toISOString()
  const base: GameState = {
    day: 0,
    cash: 0,
    holdings: {},
    prices: createInitialPrices(),
    priceHistory: createInitialPriceHistory(),
    cashLedger: [],
    news: [],
    watchlist: [],
    completedLessonIds: [],
    completedMissionIds: [],
    dismissedChallengeIds: [],
    decisionLog: [],
    identifiedMisleadingNewsIds: [],
    xp: 0,
    streakDays: 0,
    lastPlayedDateKey: null,
    preferences,
    unlockedAchievementIds: [],
    reflections: [],
    dailyChallenge: null,
    completedDailyChallengeDateKeys: [],
    quizScores: [],
    tutorialCompleted: false,
    hasSeenFirstPurchaseExplainer: false,
    portfolioHistory: [],
    startedAt,
    lastSavedAt: startedAt,
    lastTickAt: startedAt,
    currentSessionKey: null,
    saveVersion: CURRENT_SAVE_VERSION,
  }
  // Starting cash is itself logged as a RESET transaction — not an implicit
  // value outside the ledger — so `cash === sum(cashLedger)` holds from the
  // very first render of a brand new game, not just after the first trade.
  const seeded = appendCashTransaction(base, {
    type: 'RESET',
    amount: preferences.startingCash,
    description: 'Game started — starting balance',
  })
  return { ...seeded, portfolioHistory: [{ day: 0, value: seeded.cash }] }
}

export function levelFromXp(xp: number): number {
  return 1 + Math.floor(xp / 150)
}

export function xpProgressIntoLevel(xp: number): { current: number; needed: number } {
  return { current: xp % 150, needed: 150 }
}

export function buyStock(state: GameState, ticker: string, shares: number, stocks: Stock[] = STOCKS): { state: GameState; error?: string } {
  if (!Number.isInteger(shares) || shares <= 0) return { state, error: 'Enter a whole number of shares greater than zero.' }
  const price = state.prices[ticker]
  if (price == null) return { state, error: 'Unknown stock.' }
  const cost = price * shares
  if (cost > state.cash) return { state, error: 'Not enough cash for this purchase.' }

  const stock = stocks.find((item) => item.ticker === ticker)
  const existing = state.holdings[ticker]
  const totalShares = (existing?.shares ?? 0) + shares
  const totalCost = (existing ? existing.averageCost * existing.shares : 0) + cost
  const holdings = { ...state.holdings, [ticker]: { ticker, shares: totalShares, averageCost: totalCost / totalShares } }

  const withHoldings: GameState = { ...state, holdings }
  const withCash = appendCashTransaction(withHoldings, {
    type: 'BUY',
    amount: -cost,
    description: `Bought ${shares} share${shares === 1 ? '' : 's'} of ${stock?.name ?? ticker}`,
    relatedId: ticker,
    ticker,
    shares,
    pricePerShare: price,
  })
  return { state: withCash }
}

export function sellStock(state: GameState, ticker: string, shares: number, stocks: Stock[] = STOCKS): { state: GameState; error?: string } {
  if (!Number.isInteger(shares) || shares <= 0) return { state, error: 'Enter a whole number of shares greater than zero.' }
  const holding = state.holdings[ticker]
  if (!holding || holding.shares < shares) return { state, error: 'You do not own that many shares.' }
  const price = state.prices[ticker]
  if (price == null) return { state, error: 'Unknown stock.' }

  const stock = stocks.find((item) => item.ticker === ticker)
  const proceeds = price * shares
  const remainingShares = holding.shares - shares
  const holdings = { ...state.holdings }
  if (remainingShares <= 0) delete holdings[ticker]
  else holdings[ticker] = { ...holding, shares: remainingShares }

  const withHoldings: GameState = { ...state, holdings }
  const withCash = appendCashTransaction(withHoldings, {
    type: 'SELL',
    amount: proceeds,
    description: `Sold ${shares} share${shares === 1 ? '' : 's'} of ${stock?.name ?? ticker}`,
    relatedId: ticker,
    ticker,
    shares,
    pricePerShare: price,
  })
  return { state: withCash }
}

/** Educational, non-blocking feedback shown after a buy that concentrates risk — mirrors the brief's example warning almost verbatim. */
export function evaluateBuyRiskFeedback(nextState: GameState, ticker: string, stocks: Stock[] = STOCKS): string | null {
  const stock = stocks.find((s) => s.ticker === ticker)
  const holding = nextState.holdings[ticker]
  const holdingsValue = computeHoldingsValue(nextState)
  if (!stock || !holding || holdingsValue <= 0) return null

  const positionValue = holding.shares * (nextState.prices[ticker] ?? 0)
  if (positionValue / holdingsValue >= 0.6) {
    return `You are investing most of your money in one company (${stock.name}). This could produce a high return, but it also increases your risk. Diversification means spreading investments across different companies or industries.`
  }

  const industryEntry = computeIndustryAllocation(nextState, stocks).find((entry) => entry.industry === stock.industry)
  if (industryEntry && industryEntry.percent >= 75) {
    return `Most of your portfolio is now in ${stock.industry}. If that industry has a bad month, your whole portfolio feels it. Consider spreading across a few different industries.`
  }

  const totalValue = computePortfolioValue(nextState)
  if (stock.risk === 'high' && totalValue > 0 && nextState.cash / totalValue < 0.1) {
    return `You now have very little cash left after buying a higher-risk stock (${stock.name}). Keeping some cash in reserve gives you flexibility if the market moves against you.`
  }

  return null
}

export function completeLesson(state: GameState, lessonId: string, quizResult?: { correct: number; total: number }): GameState {
  if (state.completedLessonIds.includes(lessonId)) return state
  const lesson = getLesson(lessonId)
  if (!lesson) return state
  const withProgress: GameState = {
    ...state,
    completedLessonIds: [...state.completedLessonIds, lessonId],
    xp: state.xp + lesson.xpReward,
    quizScores: quizResult
      ? [...state.quizScores, { lessonId, lessonTitle: lesson.title, correct: quizResult.correct, total: quizResult.total, completedAt: new Date().toISOString() }]
      : state.quizScores,
  }
  if (lesson.bonusCash <= 0) return withProgress
  return appendCashTransaction(withProgress, {
    type: 'QUIZ_REWARD',
    amount: lesson.bonusCash,
    description: `Quiz reward: completed "${lesson.title}"`,
    relatedId: lessonId,
  })
}

/** Diffs mission completion before/after an action and awards XP + a documented cash reward for anything newly finished. */
export function applyMissionProgress(previous: GameState, next: GameState, stocks: Stock[] = STOCKS): { state: GameState; newlyCompletedIds: string[] } {
  const newlyCompletedIds = evaluateNewlyCompletedMissions(previous, next, stocks)
  if (newlyCompletedIds.length === 0) return { state: next, newlyCompletedIds }

  let result: GameState = {
    ...next,
    completedMissionIds: [...next.completedMissionIds, ...newlyCompletedIds],
    xp: next.xp + newlyCompletedIds.reduce((sum, id) => sum + (getMission(id)?.xpReward ?? 0), 0),
  }
  for (const id of newlyCompletedIds) {
    const mission = getMission(id)
    if (!mission || mission.cashReward <= 0) continue
    result = appendCashTransaction(result, {
      type: 'MISSION_REWARD',
      amount: mission.cashReward,
      description: `Mission reward: ${mission.title}`,
      relatedId: id,
    })
  }
  return { state: result, newlyCompletedIds }
}

export function recordDecision(state: GameState, challengeId: string, optionId: string, quality: DecisionOptionQuality): GameState {
  return {
    ...state,
    dismissedChallengeIds: [...state.dismissedChallengeIds, challengeId],
    decisionLog: [...state.decisionLog, { challengeId, optionId, quality, day: state.day }],
  }
}

export function flagNewsItem(state: GameState, newsId: string): { state: GameState; wasMisleading: boolean } {
  const news = state.news.find((item) => item.id === newsId)
  if (!news || !news.misleading) return { state, wasMisleading: false }
  if (state.identifiedMisleadingNewsIds.includes(newsId)) return { state, wasMisleading: true }
  return { state: { ...state, identifiedMisleadingNewsIds: [...state.identifiedMisleadingNewsIds, newsId] }, wasMisleading: true }
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

/** Advances the learning streak once per real-world calendar day the student opens the game. */
export function refreshStreak(state: GameState): GameState {
  const today = dateKey(new Date())
  if (state.lastPlayedDateKey === today) return state
  const yesterday = dateKey(new Date(Date.now() - 86_400_000))
  const continuesStreak = state.lastPlayedDateKey === yesterday
  return {
    ...state,
    streakDays: state.lastPlayedDateKey == null ? 1 : continuesStreak ? state.streakDays + 1 : 1,
    lastPlayedDateKey: today,
  }
}

/** Diffs achievement unlocks the same way applyMissionProgress diffs missions. Achievements are XP-only — the badge itself is the reward — so no ledger entry is created. */
export function applyAchievementProgress(previous: GameState, next: GameState, stocks: Stock[] = STOCKS): { state: GameState; newlyUnlockedIds: string[] } {
  const newlyUnlockedIds = evaluateNewlyUnlockedAchievements(previous, next, stocks)
  if (newlyUnlockedIds.length === 0) return { state: next, newlyUnlockedIds }
  const xpGain = newlyUnlockedIds.reduce((sum, id) => sum + (getAchievement(id)?.xpReward ?? 0), 0)
  return {
    state: { ...next, unlockedAchievementIds: [...next.unlockedAchievementIds, ...newlyUnlockedIds], xp: next.xp + xpGain },
    newlyUnlockedIds,
  }
}

/** Assigns a fresh daily challenge if none is active yet or the calendar date has rolled over. */
export function refreshDailyChallenge(state: GameState): GameState {
  const today = todayDateKey()
  if (state.dailyChallenge?.dateKey === today) return state
  const task = pickDailyChallengeTask(today)
  return { ...state, dailyChallenge: { dateKey: today, taskId: task.id, completed: false } }
}

/** Marks today's daily challenge complete if the given action matches it, and pays its documented reward. No-op otherwise (including if already done — this is the guard that stops a re-render or duplicate call from paying twice). */
export function markDailyChallengeProgress(state: GameState, actionId: string): { state: GameState; task: DailyChallengeTask | null } {
  const challenge = state.dailyChallenge
  if (!challenge || challenge.completed || challenge.taskId !== actionId) return { state, task: null }
  const task = pickDailyChallengeTask(challenge.dateKey)
  const withProgress: GameState = {
    ...state,
    dailyChallenge: { ...challenge, completed: true },
    completedDailyChallengeDateKeys: [...state.completedDailyChallengeDateKeys, challenge.dateKey],
    xp: state.xp + task.xpReward,
  }
  const withCash = task.bonusCash > 0
    ? appendCashTransaction(withProgress, {
      type: 'DAILY_CHALLENGE_REWARD',
      amount: task.bonusCash,
      description: `Daily challenge reward: ${task.title}`,
      relatedId: challenge.dateKey,
    })
    : withProgress
  return { state: withCash, task }
}

export function addReflection(state: GameState, text: string): GameState {
  const trimmed = text.trim().slice(0, 2000)
  if (!trimmed) return state
  return {
    ...state,
    reflections: [...state.reflections, { day: state.day, text: trimmed, createdAt: new Date().toISOString() }].slice(-10),
  }
}

export function markTutorialCompleted(state: GameState): GameState {
  if (state.tutorialCompleted) return state
  return { ...state, tutorialCompleted: true }
}

export function markFirstPurchaseExplainerSeen(state: GameState): GameState {
  if (state.hasSeenFirstPurchaseExplainer) return state
  return { ...state, hasSeenFirstPurchaseExplainer: true }
}

export function toggleWatchlist(state: GameState, ticker: string): GameState {
  const isWatched = state.watchlist.includes(ticker)
  return { ...state, watchlist: isWatched ? state.watchlist.filter((item) => item !== ticker) : [...state.watchlist, ticker] }
}

/** Settings-page changes — everything except starting cash, which cannot change without a full reset (it is baked into the ledger's seed transaction). */
export function updatePreferences(state: GameState, partial: Partial<Omit<GamePreferences, 'startingCash'>>): GameState {
  return { ...state, preferences: { ...state.preferences, ...partial } }
}

export type ProcessTicksResult = { state: GameState; news: NewsItem[]; ticksProcessed: number }

/**
 * The single entry point the live market timer (and the silent on-load
 * catch-up) call. Walks forward from `state.lastTickAt` in fixed
 * `MARKET_TICK_INTERVAL_MS` steps, only actually simulating a tick when that
 * moment falls inside real market hours — closed-hours periods are skipped
 * over entirely, never simulated, so nothing (prices or cash) ever moves
 * while the market is shut. Bounded by `maxTicks` so a long absence can't
 * trigger an unbounded loop; ticks never touch cash, so catching up silently
 * (no confirmation dialog) can never create unexplained money.
 */
export function processDueTicks(state: GameState, stocks: Stock[] = STOCKS, rng: () => number = Math.random, now: Date = new Date(), maxTicks = 1): ProcessTicksResult {
  let current = state
  const allNews: NewsItem[] = []
  let ticksProcessed = 0
  let cursor = new Date(current.lastTickAt).getTime()
  const nowMs = now.getTime()

  while (ticksProcessed < maxTicks) {
    const candidateMs = cursor + MARKET_TICK_INTERVAL_MS
    if (candidateMs > nowMs) break
    const candidateDate = new Date(candidateMs)
    if (!isMarketOpenAt(candidateDate)) {
      // Closed-hours periods are never simulated — fast-forward the schedule to the next open instead.
      cursor = nextMarketOpen(candidateDate).getTime() - MARKET_TICK_INTERVAL_MS
      continue
    }
    const result = advanceTick(current, stocks, rng, candidateDate)
    current = result.state
    allNews.push(...result.news)
    cursor = candidateMs
    ticksProcessed += 1
  }
  return { state: current, news: allNews, ticksProcessed }
}

/** Dev-mode safety net: the displayed cash balance must always equal the sum of every ledger entry. Any mismatch means something wrote to `cash` outside appendCashTransaction. */
export function verifyLedgerIntegrity(state: GameState): { ok: boolean; expected: number; actual: number; difference: number } {
  const expected = sumCashLedger(state)
  const actual = state.cash
  const difference = actual - expected
  return { ok: Math.abs(difference) < 0.005, expected, actual, difference }
}
