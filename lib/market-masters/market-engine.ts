import { generateTickEvents } from '@/lib/market-masters/events'
import { localDateKey } from '@/lib/market-masters/market-hours'
import { STOCKS } from '@/lib/market-masters/stocks'
import { TICKS_PER_TRADING_DAY, type CashTransaction, type CashTransactionType, type Difficulty, type GameState, type Industry, type NewsItem, type PricePoint, type Stock } from '@/lib/market-masters/types'

const MIN_PRICE = 1
/** Roughly every 20 real trading days ("a month of sessions") dividend-paying holdings pay out. */
const DIVIDEND_INTERVAL_DAYS = 20
/** Bounds how many price points/ledger-adjacent history entries we keep per series, so weeks of real play don't bloat localStorage. */
const MAX_HISTORY_POINTS = 600

/** Beginner reduces price swings, advanced amplifies them — same underlying per-company volatility, scaled by the player's chosen difficulty. */
const DIFFICULTY_VOLATILITY_MULTIPLIER: Record<Difficulty, number> = {
  beginner: 0.6,
  intermediate: 1,
  advanced: 1.5,
}

function randomInRange(min: number, max: number, rng: () => number) {
  return min + rng() * (max - min)
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createInitialPrices(stocks: Stock[] = STOCKS): Record<string, number> {
  return Object.fromEntries(stocks.map((stock) => [stock.ticker, stock.startingPrice]))
}

export function createInitialPriceHistory(stocks: Stock[] = STOCKS): Record<string, PricePoint[]> {
  const now = new Date().toISOString()
  return Object.fromEntries(stocks.map((stock) => [stock.ticker, [{ day: 0, price: stock.startingPrice, timestamp: now }]]))
}

function trim<T>(list: T[], max: number): T[] {
  return list.length > max ? list.slice(list.length - max) : list
}

/**
 * Per-tick price drift, scaled down from each company's baseline volatility
 * so that many small real ticks across a full trading session (roughly
 * `TICKS_PER_TRADING_DAY` of them) add up to about as much movement as one
 * old single "big move" used to — real markets wiggle continuously in small
 * steps, not in one lurch.
 */
function applyTickDrift(prices: Record<string, number>, stocks: Stock[], rng: () => number, difficultyMultiplier: number): Record<string, number> {
  const tickScale = 1 / Math.sqrt(TICKS_PER_TRADING_DAY)
  const marketDrift = randomInRange(-0.4, 0.4, rng) * difficultyMultiplier * tickScale
  const next: Record<string, number> = { ...prices }
  for (const stock of stocks) {
    const volatility = stock.volatility * difficultyMultiplier * tickScale
    const idiosyncratic = randomInRange(-volatility, volatility, rng)
    const changePercent = marketDrift + idiosyncratic
    const current = next[stock.ticker] ?? stock.startingPrice
    next[stock.ticker] = Math.max(MIN_PRICE, current * (1 + changePercent / 100))
  }
  return next
}

function applyEventImpacts(prices: Record<string, number>, impacts: { ticker: string; percent: number }[]): Record<string, number> {
  const next = { ...prices }
  for (const impact of impacts) {
    const current = next[impact.ticker]
    if (current == null) continue
    next[impact.ticker] = Math.max(MIN_PRICE, current * (1 + impact.percent / 100))
  }
  return next
}

/**
 * The one function allowed to change `GameState.cash`. Every caller — buying,
 * selling, dividends, mission/quiz/daily-challenge rewards, resets — routes
 * through here, so there is exactly one place that reads the balance before,
 * computes the new balance, and appends the ledger entry that explains the
 * difference. Nothing else may write `state.cash` directly.
 */
export function appendCashTransaction(
  state: GameState,
  params: {
    type: CashTransactionType
    amount: number
    description: string
    relatedId?: string
    ticker?: string
    shares?: number
    pricePerShare?: number
  },
): GameState {
  const balanceBefore = state.cash
  const balanceAfter = balanceBefore + params.amount
  const transaction: CashTransaction = {
    id: createId('cash'),
    day: state.day,
    simulatedDate: new Date().toISOString().slice(0, 10),
    type: params.type,
    description: params.description,
    amount: params.amount,
    balanceBefore,
    balanceAfter,
    relatedId: params.relatedId,
    ticker: params.ticker,
    shares: params.shares,
    pricePerShare: params.pricePerShare,
    createdAt: new Date().toISOString(),
  }
  return { ...state, cash: balanceAfter, cashLedger: [...state.cashLedger, transaction] }
}

/** Sum of every ledger entry — must always equal `state.cash`. Used by the dev-mode balance checker and by the "cash equals starting balance plus all transactions" invariant. */
export function sumCashLedger(state: GameState): number {
  return state.cashLedger.reduce((sum, entry) => sum + entry.amount, 0)
}

export function computeEducationalRewardsEarned(state: GameState): number {
  return state.cashLedger
    .filter((entry) => entry.type === 'MISSION_REWARD' || entry.type === 'QUIZ_REWARD' || entry.type === 'DAILY_CHALLENGE_REWARD')
    .reduce((sum, entry) => sum + entry.amount, 0)
}

export function computeDividendsReceived(state: GameState): number {
  return state.cashLedger.filter((entry) => entry.type === 'DIVIDEND').reduce((sum, entry) => sum + entry.amount, 0)
}

function payDividends(state: GameState, stocks: Stock[]): GameState {
  const byTicker = Object.fromEntries(stocks.map((s) => [s.ticker, s]))
  let next = state
  for (const holding of Object.values(state.holdings)) {
    if (holding.shares <= 0) continue
    const stock = byTicker[holding.ticker]
    if (!stock || stock.dividendYield <= 0) continue
    const perShare = (stock.dividendYield / 100 / 4) * holding.averageCost
    const total = perShare * holding.shares
    if (total <= 0) continue
    next = appendCashTransaction(next, {
      type: 'DIVIDEND',
      amount: total,
      description: `Dividend from ${stock.name} (${holding.shares} share${holding.shares === 1 ? '' : 's'})`,
      relatedId: stock.ticker,
      ticker: stock.ticker,
      shares: holding.shares,
      pricePerShare: perShare,
    })
  }
  return next
}

export function computeHoldingsValue(state: GameState, prices: Record<string, number> = state.prices): number {
  return Object.values(state.holdings).reduce((sum, holding) => sum + holding.shares * (prices[holding.ticker] ?? 0), 0)
}

export function computePortfolioValue(state: GameState, prices: Record<string, number> = state.prices): number {
  return state.cash + computeHoldingsValue(state, prices)
}

/** Total spent acquiring current holdings, at cost — used for the invested/unrealized-P&L breakdown. */
export function computeTotalInvested(state: GameState): number {
  return Object.values(state.holdings).reduce((sum, holding) => sum + holding.shares * holding.averageCost, 0)
}

export function computeUnrealizedProfitLoss(state: GameState): { value: number; percent: number } {
  const invested = computeTotalInvested(state)
  const currentValue = computeHoldingsValue(state)
  const value = currentValue - invested
  const percent = invested > 0 ? (value / invested) * 100 : 0
  return { value, percent }
}

/** Realized P&L: proceeds from every SELL minus the cost basis of the shares sold, recovered from the ledger's per-sale metadata. */
export function computeRealizedProfitLoss(state: GameState): number {
  return state.cashLedger
    .filter((entry): entry is CashTransaction & { shares: number; pricePerShare: number } => entry.type === 'SELL' && entry.shares != null && entry.pricePerShare != null)
    .reduce((sum, entry) => sum + entry.amount, 0)
}

export type AdvanceResult = {
  state: GameState
  news: NewsItem[]
}

/**
 * Simulates one real 5-minute price tick at the given real-world moment:
 * small per-company + market-wide drift, 0-3 richly-written news events, and
 * — only on the first tick of a new real trading day — dividends for that
 * day. `day` itself only increases when the calendar date (in the player's
 * timezone) actually changes, so it always means "real trading days
 * experienced," not "ticks elapsed." Pure aside from the injectable rng and
 * `now`, so callers can pass a seeded generator and a fixed clock in tests.
 */
export function advanceTick(state: GameState, stocks: Stock[] = STOCKS, rng: () => number = Math.random, now: Date = new Date()): AdvanceResult {
  const sessionKey = localDateKey(now)
  const isNewSession = sessionKey !== state.currentSessionKey
  const nextDay = isNewSession ? state.day + 1 : state.day

  const difficultyMultiplier = DIFFICULTY_VOLATILITY_MULTIPLIER[state.preferences.difficulty]
  const events = generateTickEvents({ stocks, rng, day: nextDay })
  let prices = applyTickDrift(state.prices, stocks, rng, difficultyMultiplier)
  for (const event of events) {
    prices = applyEventImpacts(prices, event.impacts)
  }

  const priceHistory: Record<string, PricePoint[]> = { ...state.priceHistory }
  for (const stock of stocks) {
    const history = priceHistory[stock.ticker] ?? []
    priceHistory[stock.ticker] = trim([...history, { day: nextDay, price: prices[stock.ticker], timestamp: now.toISOString() }], MAX_HISTORY_POINTS)
  }

  const news: NewsItem[] = events.map((event) => ({
    id: createId('news'),
    day: nextDay,
    headline: event.headline,
    body: event.body,
    tickers: event.impacts.map((impact) => impact.ticker),
    tone: event.tone,
    misleading: event.misleading,
  }))

  let next: GameState = {
    ...state,
    day: nextDay,
    currentSessionKey: sessionKey,
    prices,
    priceHistory,
    news: trim([...state.news, ...news], MAX_HISTORY_POINTS),
    lastTickAt: now.toISOString(),
  }
  if (isNewSession && nextDay % DIVIDEND_INTERVAL_DAYS === 0) {
    next = payDividends(next, stocks)
  }

  const portfolioValue = computePortfolioValue(next, prices)
  return {
    state: { ...next, portfolioHistory: trim([...state.portfolioHistory, { day: nextDay, value: portfolioValue }], MAX_HISTORY_POINTS) },
    news,
  }
}

export function computeIndustryAllocation(state: GameState, stocks: Stock[] = STOCKS): { industry: Industry; value: number; percent: number }[] {
  const byTicker = Object.fromEntries(stocks.map((s) => [s.ticker, s]))
  const holdingsValue = computeHoldingsValue(state)
  const totals = new Map<Industry, number>()
  for (const holding of Object.values(state.holdings)) {
    if (holding.shares <= 0) continue
    const stock = byTicker[holding.ticker]
    if (!stock) continue
    const value = holding.shares * (state.prices[stock.ticker] ?? 0)
    totals.set(stock.industry, (totals.get(stock.industry) ?? 0) + value)
  }
  return Array.from(totals.entries())
    .map(([industry, value]) => ({ industry, value, percent: holdingsValue > 0 ? (value / holdingsValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)
}

/**
 * 0-100 score rewarding spread across industries and penalising concentration
 * in a single position. Built from a Herfindahl-style concentration index
 * (sum of squared allocation shares) so a portfolio split evenly across many
 * industries scores near 100, and one all-in position scores near 0.
 */
export function computeDiversificationScore(state: GameState, stocks: Stock[] = STOCKS): number {
  const allocation = computeIndustryAllocation(state, stocks)
  const holdingsValue = computeHoldingsValue(state)
  if (holdingsValue <= 0 || allocation.length === 0) return 0
  const herfindahl = allocation.reduce((sum, entry) => sum + (entry.percent / 100) ** 2, 0)
  return Math.round((1 - herfindahl) * 100)
}

/** Total return against the player's chosen starting cash — not a fixed constant, since starting cash is now configurable per game. */
export function computeProfitLoss(state: GameState): { value: number; percent: number } {
  const portfolioValue = computePortfolioValue(state)
  const startingCash = state.preferences.startingCash
  const value = portfolioValue - startingCash
  const percent = startingCash > 0 ? (value / startingCash) * 100 : 0
  return { value, percent }
}
