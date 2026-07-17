import { CURRENT_SAVE_VERSION, type AdvertisingCampaign, type AnnualReport, type Competitor, type GameState, type Product, type ReputationTransaction } from '@/lib/business-empire/types'
import { computeProductRating, createId, verifyLedgerIntegrity } from '@/lib/business-empire/simulation'

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
 * Upgrades a save from the pre-reputation-system format (version 1) into the
 * current shape. Every field the old save already had is kept exactly as-is
 * — nothing is silently reset. Brand-new fields (reputation history, loans,
 * per-product reviews/reliability, etc.) get sensible, clearly-labelled
 * defaults derived from the data the save already has, never zeros pretending
 * to be real history. Returns `null` if the save doesn't even match the known
 * v1 shape, so the caller can fall back to a full reset rather than guess.
 */
export function migrateLegacySave(parsed: Record<string, unknown>): GameState | null {
  if (typeof parsed.cash !== 'number' || !Array.isArray(parsed.cashLedger) || !isRecord(parsed.preferences)) return null
  if (typeof parsed.companyName !== 'string' || typeof parsed.industry !== 'string' || typeof parsed.year !== 'number') return null

  const legacyReputation = typeof parsed.brandReputation === 'number' ? parsed.brandReputation : 50

  const products: Product[] = Array.isArray(parsed.products)
    ? (parsed.products as Record<string, unknown>[]).map((p) => {
        const satisfaction = typeof p.satisfaction === 'number' ? p.satisfaction : 60
        const reliability = satisfaction
        return {
          ...p,
          rating: computeProductRating(satisfaction, reliability),
          reviews: [],
          reliability,
          returnRate: 0.05,
          complaintRate: 0.05,
          awareness: 50,
          customerLoyalty: 30,
          lastRelaunchedYear: typeof p.createdYear === 'number' ? p.createdYear : (typeof parsed.year === 'number' ? parsed.year : 1),
        } as unknown as Product
      })
    : []

  const competitors: Competitor[] = Array.isArray(parsed.competitors)
    ? (parsed.competitors as Record<string, unknown>[]).map((c) => ({ ...c, advertisingIntensity: 0.3 }) as unknown as Competitor)
    : []

  const advertisingCampaigns: AdvertisingCampaign[] = Array.isArray(parsed.advertisingCampaigns)
    ? (parsed.advertisingCampaigns as Record<string, unknown>[]).map((c) => ({ ...c, claimsHonesty: 'honest' }) as unknown as AdvertisingCampaign)
    : []

  const annualReports: AnnualReport[] = Array.isArray(parsed.annualReports)
    ? (parsed.annualReports as Record<string, unknown>[]).map((r) => ({ ...r, operatingCosts: 0, loanRepayments: 0, factorNotes: [] }) as unknown as AnnualReport)
    : []

  const migrationEntry: ReputationTransaction = {
    id: createId('rep'),
    year: typeof parsed.year === 'number' ? parsed.year : 1,
    delta: 0,
    valueBefore: legacyReputation,
    valueAfter: legacyReputation,
    reasonCategory: 'SAVE_MIGRATION',
    description: 'This save was upgraded to the new reputation-tracking system. The reputation score itself was carried over unchanged; only its history starts fresh from here.',
    createdAt: new Date().toISOString(),
  }

  return {
    companyName: parsed.companyName as string,
    founderName: typeof parsed.founderName === 'string' ? parsed.founderName : '',
    industry: parsed.industry as GameState['industry'],
    preferences: parsed.preferences as GameState['preferences'],
    year: parsed.year as number,
    cash: parsed.cash as number,
    cashLedger: parsed.cashLedger as GameState['cashLedger'],
    products,
    competitors,
    researchReports: Array.isArray(parsed.researchReports) ? (parsed.researchReports as GameState['researchReports']) : [],
    advertisingCampaigns,
    annualReports,
    companyValue: typeof parsed.companyValue === 'number' ? parsed.companyValue : parsed.cash,
    marketShare: typeof parsed.marketShare === 'number' ? parsed.marketShare : 0,
    customerSatisfaction: typeof parsed.customerSatisfaction === 'number' ? parsed.customerSatisfaction : 70,
    brandReputation: legacyReputation,
    reputationHistory: [migrationEntry],
    staffMorale: 70,
    loans: [],
    economicIndex: typeof parsed.economicIndex === 'number' ? parsed.economicIndex : 1,
    economicCyclePhase: 'stable',
    completedLessonIds: Array.isArray(parsed.completedLessonIds) ? (parsed.completedLessonIds as string[]) : [],
    unlockedFeatures: Array.isArray(parsed.unlockedFeatures) ? (parsed.unlockedFeatures as string[]) : [],
    startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
    saveVersion: CURRENT_SAVE_VERSION,
  }
}

/**
 * Never trusts a stored `cash` number on faith — it is only accepted if the
 * ledger it shipped with actually sums to that cash value. A save at the
 * current version is loaded directly; a save at the known older version is
 * upgraded through `migrateLegacySave`; anything else is treated as
 * unrecoverable rather than silently repaired with a guessed balance.
 */
export function loadGameState(userId: string): LoadResult {
  if (typeof window === 'undefined') return { state: null, resetNotice: null }
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return { state: null, resetNotice: null }

    const parsed = JSON.parse(raw) as (Partial<GameState> & { saveVersion?: number }) | null
    if (!parsed || typeof parsed !== 'object') {
      return { state: null, resetNotice: 'Your previous Business Empire save could not be read, so it was not loaded.' }
    }

    let candidate: GameState | null = null
    if (parsed.saveVersion === CURRENT_SAVE_VERSION && typeof parsed.cash === 'number' && Array.isArray(parsed.cashLedger) && isRecord(parsed.preferences)) {
      candidate = parsed as GameState
    } else if (parsed.saveVersion === 1 || parsed.saveVersion === undefined) {
      candidate = migrateLegacySave(parsed as Record<string, unknown>)
    }

    if (!candidate) {
      return { state: null, resetNotice: 'Your previous Business Empire save was not in a format this version understands, so it was not loaded. No cash was created or lost.' }
    }

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
