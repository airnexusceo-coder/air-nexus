import { CURRENT_SAVE_VERSION, type AdvertisingCampaign, type AnnualReport, type Competitor, type GameState, type Product, type ReputationCategory, type ReputationTransaction } from '@/lib/business-empire/types'
import { REPUTATION_CATEGORY_MAP, backfillCompetitorStrategy, computeProductRating, createId, verifyLedgerIntegrity } from '@/lib/business-empire/simulation'

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
    ? (parsed.competitors as Record<string, unknown>[]).map((c, index) => backfillCompetitorStrategy({ ...c, advertisingIntensity: 0.3 } as unknown as Competitor, index))
    : []

  const advertisingCampaigns: AdvertisingCampaign[] = Array.isArray(parsed.advertisingCampaigns)
    ? (parsed.advertisingCampaigns as Record<string, unknown>[]).map((c) => ({ ...c, claimsHonesty: 'honest' }) as unknown as AdvertisingCampaign)
    : []

  const annualReports: AnnualReport[] = Array.isArray(parsed.annualReports)
    ? (parsed.annualReports as Record<string, unknown>[]).map((r) => ({ ...r, operatingCosts: 0, facilityUpkeep: 0, loanRepayments: 0, factorNotes: [], competitorActions: [] }) as unknown as AnnualReport)
    : []

  const migrationEntry: ReputationTransaction = {
    id: createId('rep'),
    year: typeof parsed.year === 'number' ? parsed.year : 1,
    delta: 0,
    valueBefore: legacyReputation,
    valueAfter: legacyReputation,
    reasonCategory: 'SAVE_MIGRATION',
    category: REPUTATION_CATEGORY_MAP.SAVE_MIGRATION,
    description: 'This save was upgraded to the new reputation-tracking system. The reputation score itself was carried over unchanged; only its history starts fresh from here.',
    createdAt: new Date().toISOString(),
  }
  const reputationCategories: Record<ReputationCategory, number> = {
    customer: legacyReputation,
    employee: legacyReputation,
    investor: legacyReputation,
    government: legacyReputation,
    environmental: legacyReputation,
    supplier: legacyReputation,
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
    reputationCategories,
    staffMorale: 70,
    loans: [],
    facilities: [],
    claimedRegions: [],
    economicIndex: typeof parsed.economicIndex === 'number' ? parsed.economicIndex : 1,
    economicCyclePhase: 'stable',
    strategicInitiatives: [],
    completedLessonIds: Array.isArray(parsed.completedLessonIds) ? (parsed.completedLessonIds as string[]) : [],
    unlockedFeatures: Array.isArray(parsed.unlockedFeatures) ? (parsed.unlockedFeatures as string[]) : [],
    startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
    saveVersion: CURRENT_SAVE_VERSION,
  }
}

/**
 * Upgrades a save from the pre-competitor-strategy format (version 2) into
 * the current shape (version 3). Cash, products, the reputation score, loans
 * and everything else already correct in v2 pass through unchanged.
 * Competitors are given a strategy archetype backfilled from their existing
 * quality/price "personality" rather than a blank default. Every existing
 * reputation transaction is tagged with the category (or categories) its
 * reason maps to, and the six-category breakdown starts from the current
 * overall score via one transparent "save upgraded" entry, exactly like the
 * v1 -> v2 migration did for reputation history itself.
 */
export function migrateV2ToV3(parsed: Record<string, unknown>): GameState | null {
  if (typeof parsed.cash !== 'number' || !Array.isArray(parsed.cashLedger) || !isRecord(parsed.preferences)) return null
  if (typeof parsed.companyName !== 'string' || typeof parsed.industry !== 'string' || typeof parsed.year !== 'number') return null
  if (typeof parsed.brandReputation !== 'number' || !Array.isArray(parsed.reputationHistory)) return null

  const legacyReputation = parsed.brandReputation

  const competitors: Competitor[] = Array.isArray(parsed.competitors)
    ? (parsed.competitors as Record<string, unknown>[]).map((c, index) => backfillCompetitorStrategy(c as unknown as Competitor, index))
    : []

  const reputationHistory: ReputationTransaction[] = (parsed.reputationHistory as Record<string, unknown>[]).map((entry) => {
    const reasonCategory = (typeof entry.reasonCategory === 'string' ? entry.reasonCategory : 'SAVE_MIGRATION') as ReputationTransaction['reasonCategory']
    return { ...entry, category: REPUTATION_CATEGORY_MAP[reasonCategory] ?? REPUTATION_CATEGORY_MAP.SAVE_MIGRATION } as unknown as ReputationTransaction
  })

  const migrationEntry: ReputationTransaction = {
    id: createId('rep'),
    year: typeof parsed.year === 'number' ? parsed.year : 1,
    delta: 0,
    valueBefore: legacyReputation,
    valueAfter: legacyReputation,
    reasonCategory: 'SAVE_MIGRATION',
    category: REPUTATION_CATEGORY_MAP.SAVE_MIGRATION,
    description: 'This save was upgraded to track six separate reputation categories (customer, employee, investor, government, environmental, supplier). Each starts from the current overall score.',
    createdAt: new Date().toISOString(),
  }
  const reputationCategories: Record<ReputationCategory, number> = {
    customer: legacyReputation,
    employee: legacyReputation,
    investor: legacyReputation,
    government: legacyReputation,
    environmental: legacyReputation,
    supplier: legacyReputation,
  }

  const annualReports: AnnualReport[] = Array.isArray(parsed.annualReports)
    ? (parsed.annualReports as Record<string, unknown>[]).map((r) => {
        const record = r as { competitorActions?: unknown; facilityUpkeep?: unknown }
        return {
          ...r,
          competitorActions: Array.isArray(record.competitorActions) ? record.competitorActions : [],
          facilityUpkeep: typeof record.facilityUpkeep === 'number' ? record.facilityUpkeep : 0,
        } as unknown as AnnualReport
      })
    : []

  return {
    ...(parsed as unknown as GameState),
    competitors,
    reputationHistory: [...reputationHistory, migrationEntry],
    reputationCategories,
    annualReports,
    saveVersion: 3,
    lastSavedAt: new Date().toISOString(),
  }
}

/**
 * Upgrades a save from the pre-land-and-facilities format (version 3) into
 * the current shape (version 4). Nothing about cash, products, competitors
 * or reputation changes — the only new fields are an empty facilities list
 * and an empty claimed-regions list, since a save from before this feature
 * existed genuinely owns no property yet.
 */
export function migrateV3ToV4(parsed: Record<string, unknown>): GameState | null {
  if (typeof parsed.cash !== 'number' || !Array.isArray(parsed.cashLedger) || !isRecord(parsed.preferences)) return null
  if (typeof parsed.companyName !== 'string' || typeof parsed.industry !== 'string' || typeof parsed.year !== 'number') return null

  return {
    ...(parsed as unknown as GameState),
    facilities: Array.isArray(parsed.facilities) ? (parsed.facilities as GameState['facilities']) : [],
    claimedRegions: Array.isArray(parsed.claimedRegions) ? (parsed.claimedRegions as GameState['claimedRegions']) : [],
    saveVersion: CURRENT_SAVE_VERSION,
    lastSavedAt: new Date().toISOString(),
  }
}

/**
 * Never trusts a stored `cash` number on faith — it is only accepted if the
 * ledger it shipped with actually sums to that cash value. A save at the
 * current version is loaded directly; a save at a known older version is
 * upgraded through the matching migration step; anything else is treated as
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
    } else if (parsed.saveVersion === 3) {
      candidate = migrateV3ToV4(parsed as Record<string, unknown>)
    } else if (parsed.saveVersion === 2) {
      const v3 = migrateV2ToV3(parsed as Record<string, unknown>)
      candidate = v3 ? migrateV3ToV4(v3 as unknown as Record<string, unknown>) : null
    } else if (parsed.saveVersion === 1 || parsed.saveVersion === undefined) {
      candidate = migrateLegacySave(parsed as Record<string, unknown>)
    }

    if (!candidate) {
      return { state: null, resetNotice: 'Your previous Business Empire save was not in a format this version understands, so it was not loaded. No cash was created or lost.' }
    }
    if (!Array.isArray(candidate.strategicInitiatives)) candidate = { ...candidate, strategicInitiatives: [] }

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
