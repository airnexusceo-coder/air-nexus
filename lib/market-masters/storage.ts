import { createInitialState } from '@/lib/market-masters/game-state'
import { appendCashTransaction } from '@/lib/market-masters/market-engine'
import { CURRENT_SAVE_VERSION, DEFAULT_PREFERENCES, type GamePreferences, type GameState, type LearningSupport } from '@/lib/market-masters/types'

const STORAGE_PREFIX = 'airnexus-market-masters'
const LEGACY_STORAGE_PREFIX = 'airnexus-market-masters-v1'
/** Every save before the ledger/preferences rewrite always started at this fixed amount. */
const LEGACY_STARTING_CASH = 10000

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidLearningSupport(value: unknown): value is LearningSupport {
  return value === 'full' || value === 'occasional' || value === 'minimal' || value === 'sandbox'
}

function isValidDifficulty(value: unknown): value is GamePreferences['difficulty'] {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced'
}

/** Recovers whatever usable preferences a save from any prior version carried, ignoring fields (like the now-removed `simulationSpeed`) that no longer exist. */
function recoverPreferences(parsed: Record<string, unknown>): GamePreferences {
  const rawPrefs = isRecord(parsed.preferences) ? parsed.preferences : {}
  return {
    difficulty: isValidDifficulty(rawPrefs.difficulty) ? rawPrefs.difficulty : DEFAULT_PREFERENCES.difficulty,
    startingCash: typeof rawPrefs.startingCash === 'number' ? rawPrefs.startingCash : LEGACY_STARTING_CASH,
    learningSupport: isValidLearningSupport(rawPrefs.learningSupport) ? rawPrefs.learningSupport : DEFAULT_PREFERENCES.learningSupport,
    reducedMotion: rawPrefs.reducedMotion === true,
  }
}

/**
 * Every save before the central ledger existed trusted a raw `cash` number
 * with no record of how it got there. Rather than carry that number forward
 * — which would silently carry forward any drift or bug along with it —
 * this replays whatever transaction history the save actually has into a
 * fresh ledger, so cash after migration is always exactly "starting balance
 * plus every transaction that actually happened," never a trusted-but-
 * unverifiable old field. Two source shapes are handled: the modern
 * `cashLedger` (saves from the real-time-market rewrite or later, just
 * missing a newer field) and the older pre-ledger `transactions` array.
 */
function migrateLegacySave(parsed: Record<string, unknown>): GameState | null {
  if (typeof parsed.day !== 'number' || !isRecord(parsed.holdings)) return null

  const preferences = recoverPreferences(parsed)
  let state = createInitialState(preferences)

  if (Array.isArray(parsed.cashLedger)) {
    const ordered = [...parsed.cashLedger].sort((a, b) => {
      const dayA = isRecord(a) && typeof a.day === 'number' ? a.day : 0
      const dayB = isRecord(b) && typeof b.day === 'number' ? b.day : 0
      return dayA - dayB
    })
    for (const raw of ordered) {
      if (!isRecord(raw)) continue
      const type = raw.type
      const amount = typeof raw.amount === 'number' ? raw.amount : null
      if (typeof type !== 'string' || amount == null || type === 'RESET') continue
      state = appendCashTransaction(state, {
        type: type as GameState['cashLedger'][number]['type'],
        amount,
        description: typeof raw.description === 'string' ? raw.description : 'Migrated transaction from an earlier save',
        relatedId: typeof raw.relatedId === 'string' ? raw.relatedId : undefined,
        ticker: typeof raw.ticker === 'string' ? raw.ticker : undefined,
        shares: typeof raw.shares === 'number' ? raw.shares : undefined,
        pricePerShare: typeof raw.pricePerShare === 'number' ? raw.pricePerShare : undefined,
      })
    }
  } else {
    const legacyTransactions = Array.isArray(parsed.transactions) ? parsed.transactions : []
    const ordered = [...legacyTransactions].sort((a, b) => {
      const dayA = isRecord(a) && typeof a.day === 'number' ? a.day : 0
      const dayB = isRecord(b) && typeof b.day === 'number' ? b.day : 0
      return dayA - dayB
    })
    for (const raw of ordered) {
      if (!isRecord(raw)) continue
      const ticker = typeof raw.ticker === 'string' ? raw.ticker : null
      const shares = typeof raw.shares === 'number' ? raw.shares : null
      const price = typeof raw.price === 'number' ? raw.price : null
      const total = typeof raw.total === 'number' ? raw.total : null
      if (!ticker || shares == null || price == null || total == null) continue

      if (raw.kind === 'buy') {
        state = appendCashTransaction(state, { type: 'BUY', amount: -total, description: `Bought ${shares} share(s) of ${ticker} (migrated from an earlier save)`, relatedId: ticker, ticker, shares, pricePerShare: price })
      } else if (raw.kind === 'sell') {
        state = appendCashTransaction(state, { type: 'SELL', amount: total, description: `Sold ${shares} share(s) of ${ticker} (migrated from an earlier save)`, relatedId: ticker, ticker, shares, pricePerShare: price })
      } else if (raw.kind === 'dividend') {
        state = appendCashTransaction(state, { type: 'DIVIDEND', amount: total, description: `Dividend from ${ticker} (migrated from an earlier save)`, relatedId: ticker, ticker, shares, pricePerShare: price })
      }
    }
  }

  return {
    ...state,
    day: parsed.day,
    holdings: parsed.holdings as GameState['holdings'],
    prices: isRecord(parsed.prices) ? (parsed.prices as GameState['prices']) : state.prices,
    priceHistory: isRecord(parsed.priceHistory) ? (parsed.priceHistory as GameState['priceHistory']) : state.priceHistory,
    portfolioHistory: Array.isArray(parsed.portfolioHistory) && parsed.portfolioHistory.length > 0 ? (parsed.portfolioHistory as GameState['portfolioHistory']) : state.portfolioHistory,
    watchlist: Array.isArray(parsed.watchlist) ? (parsed.watchlist as string[]) : state.watchlist,
    news: Array.isArray(parsed.news) ? (parsed.news as GameState['news']) : state.news,
    completedLessonIds: Array.isArray(parsed.completedLessonIds) ? (parsed.completedLessonIds as string[]) : [],
    completedMissionIds: Array.isArray(parsed.completedMissionIds) ? (parsed.completedMissionIds as string[]) : [],
    unlockedAchievementIds: Array.isArray(parsed.unlockedAchievementIds) ? (parsed.unlockedAchievementIds as string[]) : [],
    xp: typeof parsed.xp === 'number' ? parsed.xp : state.xp,
    tutorialCompleted: parsed.tutorialCompleted === true,
  }
}

export type LoadResult = {
  state: GameState
  /** Set when the previous save could not be trusted/repaired and a fresh game was started instead — the UI should tell the player this happened rather than silently swapping their balance. */
  resetNotice: string | null
}

/** Distinguishes "brand new player" (show preferences screen) from "returning player" (load straight into the game) without constructing a full state. */
export function hasSavedGame(userId: string): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(storageKey(userId)) != null || window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}:${userId}`) != null
}

export function loadGameState(userId: string): LoadResult {
  if (typeof window === 'undefined') return { state: createInitialState(), resetNotice: null }
  try {
    const raw = window.localStorage.getItem(storageKey(userId)) ?? window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}:${userId}`)
    if (!raw) return { state: createInitialState(), resetNotice: null }

    const parsed = JSON.parse(raw) as Partial<GameState> & { saveVersion?: number } | null
    if (!parsed || typeof parsed !== 'object') {
      return { state: createInitialState(), resetNotice: 'Your previous Market Masters save could not be read, so a fresh game was started.' }
    }

    if (parsed.saveVersion === CURRENT_SAVE_VERSION && typeof parsed.cash === 'number' && isRecord(parsed.holdings) && Array.isArray(parsed.cashLedger) && isRecord(parsed.preferences)) {
      // Current-version save with the fields the rest of the app depends on present — safe to trust as-is.
      return { state: { ...createInitialState(parsed.preferences as GamePreferences), ...parsed }, resetNotice: null }
    }

    const migrated = migrateLegacySave(parsed as Record<string, unknown>)
    if (migrated) {
      return { state: migrated, resetNotice: 'Your save was upgraded to the new version. Cash was rebuilt from your transaction history, and a few older fields were reset.' }
    }

    return { state: createInitialState(), resetNotice: 'Your previous Market Masters save was not in a format this version understands, so a fresh game was started. No cash was created or lost — you are back at your chosen starting balance.' }
  } catch {
    return { state: createInitialState(), resetNotice: 'Your previous Market Masters save was corrupted and could not be repaired, so a fresh game was started.' }
  }
}

export function saveGameState(userId: string, state: GameState) {
  if (typeof window === 'undefined') return
  try {
    const withTimestamp: GameState = { ...state, lastSavedAt: new Date().toISOString() }
    window.localStorage.setItem(storageKey(userId), JSON.stringify(withTimestamp))
  } catch {
    // Storage can fail (quota, private browsing) — losing this save is not fatal, the game keeps running in memory.
  }
}

export function clearGameState(userId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(storageKey(userId))
  window.localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}:${userId}`)
}
