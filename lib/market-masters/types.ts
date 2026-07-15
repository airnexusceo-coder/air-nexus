export type Industry =
  | 'Technology'
  | 'Artificial Intelligence'
  | 'Cybersecurity'
  | 'Healthcare'
  | 'Banking'
  | 'Insurance'
  | 'Renewable Energy'
  | 'Oil & Gas'
  | 'Retail'
  | 'Food & Beverages'
  | 'Entertainment'
  | 'Gaming'
  | 'Transport'
  | 'Airlines'
  | 'Automotive'
  | 'Construction'
  | 'Telecommunications'
  | 'Agriculture'
  | 'Manufacturing'
  | 'Real Estate'

export type RiskLevel = 'low' | 'medium' | 'high'

export type Stock = {
  ticker: string
  name: string
  industry: Industry
  risk: RiskLevel
  description: string
  startingPrice: number
  /** Approximate annual dividend yield as a percentage of share price; 0 means the company does not pay one. */
  dividendYield: number
  /** Baseline daily price-swing percentage for this specific company — lets two companies in the same risk tier still behave differently. */
  volatility: number
}

export type PricePoint = {
  day: number
  price: number
  /** Real-world moment this tick happened — powers the intraday chart tooltip. */
  timestamp?: string
}

export type NewsTone = 'positive' | 'negative' | 'neutral'

export type NewsItem = {
  id: string
  day: number
  headline: string
  body: string
  tickers: string[]
  tone: NewsTone
  /** True when the headline is written to sound more dramatic than the underlying event justifies — used to teach hype-spotting. */
  misleading: boolean
}

export type Holding = {
  ticker: string
  shares: number
  /** Cost-basis average price per share across all buys, used for profit/loss display. */
  averageCost: number
}

export type QuizQuestion = {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type Lesson = {
  id: string
  order: number
  title: string
  summary: string
  content: string[]
  quiz: QuizQuestion[]
  xpReward: number
  bonusCash: number
}

export type Mission = {
  id: string
  title: string
  description: string
  xpReward: number
  cashReward: number
}

export type DecisionOptionQuality = 'strong' | 'weak' | 'risky'

export type DecisionOption = {
  id: string
  label: string
  quality: DecisionOptionQuality
  feedback: string
}

export type DecisionChallenge = {
  id: string
  prompt: string
  context: string
  relatedTicker?: string
  options: DecisionOption[]
}

export type DecisionLogEntry = {
  challengeId: string
  optionId: string
  quality: DecisionOptionQuality
  day: number
}

export type PortfolioSnapshot = {
  day: number
  value: number
}

export type Reflection = {
  day: number
  text: string
  createdAt: string
}

export type DailyChallengeState = {
  dateKey: string
  taskId: string
  completed: boolean
}

export type QuizScore = {
  lessonId: string
  lessonTitle: string
  correct: number
  total: number
  completedAt: string
}

// --- Preferences -------------------------------------------------------------

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type LearningSupport = 'full' | 'occasional' | 'minimal' | 'sandbox'

export type GamePreferences = {
  difficulty: Difficulty
  startingCash: number
  learningSupport: LearningSupport
  reducedMotion: boolean
}

export const MIN_STARTING_CASH = 1000
export const MAX_STARTING_CASH = 50000
export const DEFAULT_STARTING_CASH = 10000
export const STARTING_CASH_STEP = 1000

export const DEFAULT_PREFERENCES: GamePreferences = {
  difficulty: 'beginner',
  startingCash: DEFAULT_STARTING_CASH,
  learningSupport: 'full',
  reducedMotion: false,
}

// --- Real market hours ---------------------------------------------------------

/** The market follows real local trading hours, like an actual exchange — not an abstract "speed" the player picks. */
export const MARKET_OPEN_HOUR = 9
export const MARKET_CLOSE_HOUR = 17
/** Real-world milliseconds between automatic price ticks while the market is open. */
export const MARKET_TICK_INTERVAL_MS = 5 * 60 * 1000
export const TRADING_MINUTES_PER_DAY = (MARKET_CLOSE_HOUR - MARKET_OPEN_HOUR) * 60
export const TICKS_PER_TRADING_DAY = Math.round((TRADING_MINUTES_PER_DAY * 60_000) / MARKET_TICK_INTERVAL_MS)

export type MarketStatus = 'open' | 'closed'

// --- Central cash ledger -------------------------------------------------------

/**
 * Every event that is allowed to change virtual cash. This is deliberately a
 * closed set — code elsewhere should never touch `GameState.cash` directly,
 * only through a function that appends one of these.
 */
export type CashTransactionType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'MISSION_REWARD'
  | 'QUIZ_REWARD'
  | 'DAILY_CHALLENGE_REWARD'
  | 'RESET'

export type CashTransaction = {
  id: string
  day: number
  simulatedDate: string
  type: CashTransactionType
  description: string
  /** Signed — positive for money in, negative for money out. */
  amount: number
  balanceBefore: number
  balanceAfter: number
  /** Ticker for BUY/SELL/DIVIDEND; mission/lesson/challenge id for reward types; absent for RESET. */
  relatedId?: string
  ticker?: string
  shares?: number
  pricePerShare?: number
  createdAt: string
}

export type GameState = {
  day: number
  cash: number
  holdings: Record<string, Holding>
  prices: Record<string, number>
  priceHistory: Record<string, PricePoint[]>
  /** The single source of truth for every cash change this game has ever made. `cash` must always equal the sum of every entry's `amount`. */
  cashLedger: CashTransaction[]
  news: NewsItem[]
  watchlist: string[]
  completedLessonIds: string[]
  completedMissionIds: string[]
  dismissedChallengeIds: string[]
  decisionLog: DecisionLogEntry[]
  /** News item ids the player correctly flagged as exaggerated/misleading. */
  identifiedMisleadingNewsIds: string[]
  xp: number
  streakDays: number
  lastPlayedDateKey: string | null
  preferences: GamePreferences
  unlockedAchievementIds: string[]
  reflections: Reflection[]
  dailyChallenge: DailyChallengeState | null
  completedDailyChallengeDateKeys: string[]
  quizScores: QuizScore[]
  tutorialCompleted: boolean
  hasSeenFirstPurchaseExplainer: boolean
  portfolioHistory: PortfolioSnapshot[]
  startedAt: string
  /** Real-world wall-clock ISO timestamp of the last save — used to silently catch up on ticks missed while away. */
  lastSavedAt: string
  /** Real-world wall-clock ISO timestamp of the last processed price tick — the schedule anchor for the next one. */
  lastTickAt: string
  /** Local calendar-date key (YYYY-MM-DD) of the trading session `day` currently belongs to. Null until the first tick ever processes. */
  currentSessionKey: string | null
  saveVersion: number
}

/** Bump whenever GameState's shape changes in a way that needs migration. */
export const CURRENT_SAVE_VERSION = 3
