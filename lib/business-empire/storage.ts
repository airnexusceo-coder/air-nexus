import { CURRENT_SAVE_VERSION, type GameState } from '@/lib/business-empire/types'
import { verifyLedgerIntegrity } from '@/lib/business-empire/simulation'

const STORAGE_PREFIX = 'airnexus-business-empire'

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasSavedGame(userId: string): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(storageKey(userId)) != null
}

export type LoadResult = {
  state: GameState | null
  /** Set when a previous save existed but could not be trusted — the UI should tell the player rather than silently discarding it. */
  resetNotice: string | null
}

/**
 * Never trusts a stored `cash` number on faith — it is only accepted if the
 * save is the current version AND the ledger it shipped with actually sums
 * to that cash value. Anything else is treated as unrecoverable rather than
 * silently repaired with a guessed balance, and the player starts a fresh
 * company instead.
 */
export function loadGameState(userId: string): LoadResult {
  if (typeof window === 'undefined') return { state: null, resetNotice: null }
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return { state: null, resetNotice: null }

    const parsed = JSON.parse(raw) as Partial<GameState> & { saveVersion?: number } | null
    if (!parsed || typeof parsed !== 'object') {
      return { state: null, resetNotice: 'Your previous Business Empire save could not be read, so it was not loaded.' }
    }
    if (parsed.saveVersion !== CURRENT_SAVE_VERSION || typeof parsed.cash !== 'number' || !Array.isArray(parsed.cashLedger) || !isRecord(parsed.preferences)) {
      return { state: null, resetNotice: 'Your previous Business Empire save was not in a format this version understands, so it was not loaded. No cash was created or lost.' }
    }

    const candidate = parsed as GameState
    const integrity = verifyLedgerIntegrity(candidate)
    if (!integrity.ok) {
      return { state: null, resetNotice: 'Your previous Business Empire save did not pass a cash integrity check, so it was not loaded rather than risk showing an incorrect balance.' }
    }

    return { state: candidate, resetNotice: null }
  } catch {
    return { state: null, resetNotice: 'Your previous Business Empire save was corrupted and could not be read.' }
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
}
