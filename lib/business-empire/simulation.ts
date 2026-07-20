import { getIndustryProfile } from '@/lib/business-empire/industries'
import {
  COMPETITOR_STRATEGY_PROFILES,
  type AdvertisingCampaign,
  type AdvertisingChannel,
  type BusinessEvent,
  type CashTransaction,
  type CashTransactionCategory,
  type Competitor,
  type CompetitorActionType,
  type CompetitorActivityEvent,
  type CompetitorStrategyProfile,
  type CompetitorStrategyType,
  type DifficultyProfile,
  type GameState,
  type IndustryProfile,
  type Product,
  type ProductQuality,
  type ProductionMethod,
  type PackagingQuality,
  type ProductReview,
  type ReputationCategory,
  type ReputationLevel,
  type ReputationReasonCategory,
  type ReputationTransaction,
  type ReviewSentiment,
} from '@/lib/business-empire/types'

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function randomInRange(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min)
}

// --- Central ledger ----------------------------------------------------------

/**
 * The one function allowed to change `GameState.cash`. Every purchase, sale,
 * wage/rent payment, tax, and refund routes through here, so there is always
 * exactly one place that reads the balance before, computes the balance
 * after, and appends the ledger entry that explains the difference.
 */
export function appendTransaction(
  state: GameState,
  params: { category: CashTransactionCategory; amount: number; description: string; relatedId?: string },
): GameState {
  const balanceBefore = state.cash
  const balanceAfter = balanceBefore + params.amount
  const transaction: CashTransaction = {
    id: createId('txn'),
    year: state.year,
    category: params.category,
    description: params.description,
    amount: params.amount,
    balanceBefore,
    balanceAfter,
    relatedId: params.relatedId,
    createdAt: new Date().toISOString(),
  }
  return { ...state, cash: balanceAfter, cashLedger: [...state.cashLedger, transaction] }
}

export function sumCashLedger(state: GameState): number {
  return state.cashLedger.reduce((sum, entry) => sum + entry.amount, 0)
}

export function sumLedgerCategoryForYear(state: GameState, category: CashTransactionCategory, year: number): number {
  return state.cashLedger
    .filter((entry) => entry.category === category && entry.year === year)
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0)
}

export function verifyLedgerIntegrity(state: GameState): { ok: boolean; expected: number; actual: number; difference: number } {
  const expected = sumCashLedger(state)
  const actual = state.cash
  const difference = actual - expected
  return { ok: Math.abs(difference) < 0.005, expected, actual, difference }
}

// --- Reputation ledger ---------------------------------------------------------

const REPUTATION_LEVEL_BANDS: { max: number; level: ReputationLevel }[] = [
  { max: 19, level: 'Disastrous' },
  { max: 39, level: 'Poor' },
  { max: 59, level: 'Average' },
  { max: 79, level: 'Strong' },
  { max: 100, level: 'Excellent' },
]

export function getReputationLevel(score: number): ReputationLevel {
  const band = REPUTATION_LEVEL_BANDS.find((entry) => score <= entry.max)
  return band ? band.level : 'Excellent'
}

/**
 * Maps every reputation trigger to the reputation front(s) it moves. Most
 * triggers touch one front; a few genuinely span several (founding a company
 * establishes baseline trust everywhere, a mishandled crisis damages both
 * investor confidence and customer trust at once, a save migration seeds all
 * six fronts from the carried-over score).
 */
export const REPUTATION_CATEGORY_MAP: Record<ReputationReasonCategory, ReputationCategory[]> = {
  COMPANY_FOUNDED: ['customer', 'employee', 'investor', 'government', 'environmental', 'supplier'],
  RELIABLE_PRODUCT: ['customer'],
  QUALITY_ISSUE: ['customer'],
  COMPLAINT_HANDLED: ['customer'],
  COMPLAINT_IGNORED: ['customer'],
  ON_TIME_DELIVERY: ['customer'],
  PRODUCTION_DELAY: ['supplier'],
  FAIR_TREATMENT: ['employee'],
  SUPPLIER_PAYMENT_LATE: ['supplier'],
  CRISIS_HANDLED_WELL: ['investor', 'customer'],
  CRISIS_MISHANDLED: ['investor', 'customer'],
  HONEST_ADVERTISING: ['customer'],
  MISLEADING_ADVERTISING: ['customer'],
  COMMUNITY_SUPPORT: ['environmental'],
  ENVIRONMENTAL_RESPONSIBILITY: ['environmental'],
  ENVIRONMENTAL_HARM: ['environmental', 'government'],
  SATISFACTION_STREAK: ['customer'],
  SATISFACTION_TREND: ['customer'],
  PRODUCT_RECALL: ['customer', 'government'],
  SCANDAL: ['government', 'investor'],
  REGULATION_BREACH: ['government'],
  UNFAIR_PRICING: ['customer'],
  PRODUCT_CANCELLED_POORLY: ['customer'],
  REPEATED_STOCKOUT: ['customer'],
  MULTI_YEAR_STABILITY: ['investor'],
  MEDIA_COVERAGE: ['customer', 'investor'],
  SAVE_MIGRATION: ['customer', 'employee', 'investor', 'government', 'environmental', 'supplier'],
}

/**
 * The one function allowed to change `GameState.brandReputation`. Mirrors
 * `appendTransaction` exactly: every reputation change is clamped to 0-100,
 * logged with a before/after value and a mandatory human-readable reason, and
 * appended to `reputationHistory` — reputation can never move silently. The
 * same delta also moves every reputation front the reason maps to, via
 * `REPUTATION_CATEGORY_MAP`, so the six-front breakdown can never desync from
 * the overall score — they are driven by the exact same transaction.
 */
export function appendReputationTransaction(
  state: GameState,
  params: { delta: number; reasonCategory: ReputationReasonCategory; description: string; relatedId?: string },
): GameState {
  const valueBefore = state.brandReputation
  const valueAfter = clamp(Math.round(valueBefore + params.delta), 0, 100)
  const actualDelta = valueAfter - valueBefore
  const categories = REPUTATION_CATEGORY_MAP[params.reasonCategory]
  const transaction: ReputationTransaction = {
    id: createId('rep'),
    year: state.year,
    delta: actualDelta,
    valueBefore,
    valueAfter,
    reasonCategory: params.reasonCategory,
    category: categories,
    description: params.description,
    relatedId: params.relatedId,
    createdAt: new Date().toISOString(),
  }
  let reputationCategories = state.reputationCategories
  for (const category of categories) {
    reputationCategories = { ...reputationCategories, [category]: clamp(Math.round(reputationCategories[category] + params.delta), 0, 100) }
  }
  return { ...state, brandReputation: valueAfter, reputationHistory: [...state.reputationHistory, transaction], reputationCategories }
}

export function sumReputationHistory(state: GameState): number {
  if (state.reputationHistory.length === 0) return state.brandReputation
  return state.reputationHistory[0].valueBefore + state.reputationHistory.reduce((sum, entry) => sum + entry.delta, 0)
}

export function verifyReputationIntegrity(state: GameState): { ok: boolean; expected: number; actual: number } {
  const expected = clamp(sumReputationHistory(state), 0, 100)
  return { ok: Math.abs(expected - state.brandReputation) < 0.5, expected, actual: state.brandReputation }
}

// --- Production cost + quality --------------------------------------------

const QUALITY_COST_MULTIPLIER: Record<ProductQuality, number> = { budget: 0.6, standard: 1.0, premium: 1.6, luxury: 2.5 }
const QUALITY_BASE_SCORE: Record<ProductQuality, number> = { budget: 35, standard: 55, premium: 75, luxury: 90 }
const PRODUCTION_METHOD_COST: Record<ProductionMethod, number> = { manual: 1.3, 'standard-factory': 1.0, automated: 0.8, outsourced: 0.7 }
const PRODUCTION_METHOD_QUALITY_ADJUST: Record<ProductionMethod, number> = { manual: 5, 'standard-factory': 0, automated: -3, outsourced: -6 }
const PACKAGING_COST: Record<PackagingQuality, number> = { basic: 1.0, standard: 1.08, premium: 1.2 }
const PACKAGING_QUALITY_ADJUST: Record<PackagingQuality, number> = { basic: 0, standard: 3, premium: 8 }

export type ProductDraft = Pick<Product, 'quality' | 'productionMethod' | 'packagingQuality' | 'features' | 'rndBudget'>

/** Per-unit cash cost of manufacturing this product, before any units are sold. Shown to the player before they confirm production. */
export function computeCostPerUnit(industry: IndustryProfile, draft: ProductDraft, unitsManufactured: number, difficulty: DifficultyProfile): number {
  // 0.12 keeps cost-per-unit a healthy fraction of the industry's selling price even for the
  // most capital-intensive industries (e.g. Cars, productionCostFactor 2.4) at their most
  // expensive quality/packaging/difficulty combination — the old 0.4 constant let cost exceed
  // (or nearly exceed) sale price for those industries even at standard settings, which made
  // starting a company in them effectively unaffordable at any starting cash.
  const baseline = industry.averagePrice * industry.productionCostFactor * 0.12
  let cost = baseline * QUALITY_COST_MULTIPLIER[draft.quality] * PRODUCTION_METHOD_COST[draft.productionMethod] * PACKAGING_COST[draft.packagingQuality] * difficulty.costMultiplier
  // Bulk production efficiency — larger runs cost slightly less per unit, capped at a 15% discount.
  const bulkDiscount = clamp(unitsManufactured / 200_000, 0, 0.15)
  cost *= 1 - bulkDiscount
  return Math.max(0.5, Math.round(cost * 100) / 100)
}

/** 0-100 "how good is this product" score, feeding both demand and satisfaction. */
export function computeQualityScore(industry: IndustryProfile, draft: ProductDraft): number {
  const featureBonus = Math.min(20, draft.features.length * 4)
  const rndBonus = Math.min(15, (draft.rndBudget / (industry.averagePrice * 50)) * 15)
  const score = QUALITY_BASE_SCORE[draft.quality] + featureBonus + rndBonus + PRODUCTION_METHOD_QUALITY_ADJUST[draft.productionMethod] + PACKAGING_QUALITY_ADJUST[draft.packagingQuality]
  return clamp(Math.round(score), 0, 100)
}

// --- Overhead: rent + wages --------------------------------------------------

export function computeRent(industry: IndustryProfile, activeProductCount: number, difficulty: DifficultyProfile): number {
  const base = 1_500 + industry.productionCostFactor * 1_200
  return Math.round(base * (1 + activeProductCount * 0.1) * difficulty.costMultiplier)
}

/** Low morale means costly turnover — replacing and retraining staff pushes effective wage costs up. Fair treatment (morale >= 50) carries no surcharge. */
export function computeWages(totalUnitsPlanned: number, activeProductCount: number, difficulty: DifficultyProfile, staffMorale: number = 70): number {
  const base = 1_500 * Math.max(1, activeProductCount) + totalUnitsPlanned * 0.03
  const moraleSurcharge = staffMorale < 50 ? (50 - staffMorale) * 0.006 : 0
  return Math.round(base * difficulty.costMultiplier * (1 + moraleSurcharge))
}

/** Morale drifts toward being "fairly paid" (wages relative to a neutral per-product-line baseline) and is gently pulled toward the company's own reputation, since a well-regarded company finds it easier to keep staff motivated. */
export function computeStaffMorale(previousMorale: number, wages: number, activeProductCount: number, reputation: number): number {
  const wagePerProductLine = activeProductCount > 0 ? wages / activeProductCount : wages
  const fairWageBaseline = 1_800
  const wagePressure = clamp((wagePerProductLine - fairWageBaseline) / fairWageBaseline, -0.3, 0.3) * 10
  const reputationPull = (reputation - previousMorale) * 0.05
  return clamp(Math.round(previousMorale + wagePressure + reputationPull), 0, 100)
}

/** Storage (carried inventory), insurance (production volume + industry regulation intensity), and maintenance (active production lines) combined into one yearly operating line — itemized so nothing is a hidden number. */
export function computeOperatingCosts(industry: IndustryProfile, products: Product[], difficulty: DifficultyProfile): { total: number; storage: number; insurance: number; maintenance: number } {
  const carriedInventoryUnits = products.reduce((sum, p) => sum + p.inventory, 0)
  const storage = carriedInventoryUnits * (industry.perishable ? 0.05 : 0.15)
  const totalUnitsManufactured = products.reduce((sum, p) => sum + p.unitsManufactured, 0)
  const insurance = totalUnitsManufactured * industry.averagePrice * 0.0015 * (1 + industry.challengeProfile.regulationIntensity)
  const maintenance = products
    .filter((p) => !p.discontinued)
    .reduce((sum, p) => sum + (p.productionMethod === 'automated' ? 400 : p.productionMethod === 'standard-factory' ? 200 : 80), 0)
  const rawTotal = storage + insurance + maintenance
  return {
    total: Math.round(rawTotal * difficulty.costMultiplier),
    storage: Math.round(storage * difficulty.costMultiplier),
    insurance: Math.round(insurance * difficulty.costMultiplier),
    maintenance: Math.round(maintenance * difficulty.costMultiplier),
  }
}

/** A named, explainable year-to-year seasonal swing (the simulation operates in whole financial years, so "seasonality" is represented as an oscillation between stronger and weaker years rather than a within-year calendar effect). */
export function computeSeasonalMultiplier(industry: IndustryProfile, year: number): { multiplier: number; note: string } {
  if (industry.seasonality <= 0) return { multiplier: 1, note: '' }
  const phase = Math.sin((year * Math.PI) / 2)
  const multiplier = 1 + phase * industry.seasonality
  const percent = Math.round(phase * industry.seasonality * 100)
  const note = phase > 0.3
    ? `Seasonal demand was unusually strong for ${industry.industry} this year (+${percent}%).`
    : phase < -0.3
      ? `Seasonal demand was unusually weak for ${industry.industry} this year (${percent}%).`
      : ''
  return { multiplier, note }
}

/** Once an industry's addressable market is mostly captured (by the player plus competitors combined), further growth gets harder to find. */
export function computeMarketSaturation(marketShare: number, competitors: Competitor[]): { multiplier: number; note: string } {
  const totalCapturedShare = marketShare + competitors.reduce((sum, c) => sum + c.marketShare, 0)
  if (totalCapturedShare < 70) return { multiplier: 1, note: '' }
  const saturationExcess = clamp((totalCapturedShare - 70) / 30, 0, 1)
  const multiplier = 1 - saturationExcess * 0.25
  return { multiplier, note: `The market is becoming saturated (about ${Math.round(totalCapturedShare)}% of the addressable market already captured) — new growth is harder to find.` }
}

/** A product that hasn't been relaunched in a while starts to feel stale, at a rate set by the industry's `outdatedPenaltyRate` (fastest in Technology/Smartphones). Relaunching (an R&D refresh) resets the clock. */
export function computeProductAgePenalty(product: Product, industry: IndustryProfile, currentYear: number): { multiplier: number; note: string } {
  const yearsSinceRelaunch = currentYear - product.lastRelaunchedYear
  if (yearsSinceRelaunch <= 0) return { multiplier: 1, note: '' }
  const penalty = clamp(yearsSinceRelaunch * industry.challengeProfile.outdatedPenaltyRate, 0, 0.6)
  if (penalty < 0.05) return { multiplier: 1 - penalty, note: '' }
  return { multiplier: 1 - penalty, note: `${product.name} is starting to feel outdated (${yearsSinceRelaunch} year(s) since its last relaunch) — demand is softer than a fresh product would see.` }
}

/** Reputation and difficulty both affect how reliably suppliers deliver on time — a stronger reputation makes suppliers prioritize you. */
export function computeProductionDelayChance(reputation: number, difficulty: DifficultyProfile): number {
  const base = 0.08
  const reputationRelief = (reputation / 100) * 0.05
  return clamp((base - reputationRelief) * difficulty.volatility, 0, 0.25)
}

// --- Demand -------------------------------------------------------------------

export type DemandInput = {
  product: Product
  qualityScore: number
  industry: IndustryProfile
  competitors: Competitor[]
  brandReputation: number
  customerSatisfaction: number
  economicIndex: number
  difficulty: DifficultyProfile
  advertisingReach: number
  demandEventMultiplier: number
  isFirstYearForCompany: boolean
  rng: () => number
  /** 0-100 — loyal customers are less swayed by price than new ones (brand loyalty). Defaults to 0 (no dampening) for callers that don't track it yet. */
  customerLoyalty?: number
  /** From `computeSeasonalMultiplier` — a named, explainable year-to-year seasonal swing. Defaults to 1 (no swing). */
  seasonalMultiplier?: number
  /** From `computeMarketSaturation` — dampens growth once an industry is crowded. Defaults to 1 (no saturation). */
  saturationMultiplier?: number
  /** From `computeProductAgePenalty` — softens demand for a product that has gone stale without a relaunch. Defaults to 1 (no penalty). */
  agePenaltyMultiplier?: number
  /** 0-100 — how well-known this product is; new, low-awareness launches sell more slowly even at a good price. Defaults to 60 (an established product). */
  awareness?: number
}

/** Estimated number of customers who want to buy this year — driven by price, quality, advertising, reputation, competition, loyalty, seasonality, market saturation, and product freshness, with a bounded random swing on top so outcomes are never fully predictable in advance. */
export function computeDemand(input: DemandInput): number {
  const {
    product, qualityScore, industry, competitors, brandReputation, customerSatisfaction, economicIndex, difficulty,
    advertisingReach, demandEventMultiplier, isFirstYearForCompany, rng,
    customerLoyalty = 0, seasonalMultiplier = 1, saturationMultiplier = 1, agePenaltyMultiplier = 1, awareness = 60,
  } = input

  const groupCount = Math.max(1, industry.customerGroups.length)
  const potentialBuyers = industry.marketSize / groupCount

  // Loyal customers are less price-sensitive: at max loyalty, up to 30% of the raw price effect is pulled back toward neutral.
  const rawPriceMultiplier = clamp((industry.averagePrice / Math.max(1, product.price)) ** 0.8, 0.1, 2.5)
  const loyaltyBlend = clamp(customerLoyalty / 100, 0, 1) * 0.3
  const priceMultiplier = rawPriceMultiplier * (1 - loyaltyBlend) + loyaltyBlend

  // More demanding customers (higher difficulty) judge quality more strictly relative to the same score.
  const qualityMultiplier = clamp((qualityScore / 60) / Math.max(0.5, difficulty.demandingCustomers), 0.35, 1.7)
  const reputationMultiplier = clamp(0.7 + (brandReputation / 100) * 0.6, 0.5, 1.4)
  const satisfactionMultiplier = isFirstYearForCompany ? 1 : clamp(0.8 + (customerSatisfaction / 100) * 0.4, 0.7, 1.3)
  const awarenessMultiplier = clamp(0.7 + (awareness / 100) * 0.5, 0.7, 1.2)

  const competitionBaseline = industry.competitionLevel === 'high' ? 0.75 : industry.competitionLevel === 'medium' ? 0.9 : 1.05
  // A competitor only counts as a real threat if they undercut on price or out-reputation the player — heavy advertisers among those threats count for more.
  const competitorThreat = competitors.reduce((sum, c) => {
    if (c.price > product.price && c.reputation < brandReputation) return sum
    return sum + (0.7 + c.advertisingIntensity * 0.6)
  }, 0)
  const competitionMultiplier = clamp(competitionBaseline - competitorThreat * 0.03, 0.35, 1.1)

  const adImpact = clamp((advertisingReach / potentialBuyers) * 0.6, 0, 0.8)
  const advertisingMultiplier = 1 + adImpact

  const rawDemand =
    potentialBuyers *
    priceMultiplier *
    qualityMultiplier *
    reputationMultiplier *
    satisfactionMultiplier *
    awarenessMultiplier *
    competitionMultiplier *
    advertisingMultiplier *
    economicIndex *
    demandEventMultiplier *
    seasonalMultiplier *
    saturationMultiplier *
    agePenaltyMultiplier *
    difficulty.demandMultiplier

  const swing = difficulty.volatility * 0.15
  const randomized = rawDemand * (1 + randomInRange(-swing, swing, rng))
  return Math.max(0, Math.round(randomized))
}

// --- Advertising ---------------------------------------------------------------

/** A trusted brand's advertising lands better — word travels further and audiences are more receptive. A damaged reputation makes the same spend less effective. */
export function computeAdvertisingEffectivenessMultiplier(reputation: number): number {
  return clamp(0.75 + (reputation / 100) * 0.5, 0.75, 1.25)
}

export function estimateAdvertisingReach(channel: AdvertisingChannel, budget: number, reachPerDollar: number, industryEffectiveness: number, reputationMultiplier: number = 1): number {
  return Math.round(budget * reachPerDollar * industryEffectiveness * reputationMultiplier)
}

export function sumAdvertisingReachForProduct(campaigns: AdvertisingCampaign[], productId: string, year: number): number {
  return campaigns.filter((c) => c.productId === productId && c.year === year).reduce((sum, c) => sum + c.estimatedReach, 0)
}

// --- Competitors -----------------------------------------------------------------

const COMPETITOR_NAME_PREFIXES = ['Nova', 'Summit', 'Bright', 'Union', 'Harbor', 'Vertex', 'Cedar', 'Northwind', 'Silverline', 'Crestview', 'Ironwood', 'Bluepeak']
const COMPETITOR_NAME_SUFFIXES = ['Co.', 'Group', 'Holdings', 'Industries', 'Collective', '& Partners', 'Works', 'Brands']

function generateCompetitorName(rng: () => number, used: Set<string>): string {
  let name = ''
  let attempts = 0
  do {
    const prefix = COMPETITOR_NAME_PREFIXES[Math.floor(rng() * COMPETITOR_NAME_PREFIXES.length)]
    const suffix = COMPETITOR_NAME_SUFFIXES[Math.floor(rng() * COMPETITOR_NAME_SUFFIXES.length)]
    name = `${prefix} ${suffix}`
    attempts += 1
  } while (used.has(name) && attempts < 20)
  used.add(name)
  return name
}

const QUALITY_ORDER: ProductQuality[] = ['budget', 'standard', 'premium', 'luxury']

function pickStrategyForQuality(quality: ProductQuality, rng: () => number): CompetitorStrategyType {
  if (quality === 'luxury') return rng() < 0.6 ? 'luxury-leader' : 'innovation-leader'
  if (quality === 'premium') return rng() < 0.5 ? 'innovation-leader' : 'ethical-brand'
  if (quality === 'budget') return rng() < 0.6 ? 'price-cutter' : 'efficient-operator'
  const standardPool: CompetitorStrategyType[] = ['efficient-operator', 'marketing-giant', 'aggressive-expander', 'corporate-predator']
  return standardPool[Math.floor(rng() * standardPool.length)]
}

export function createCompetitorsForIndustry(industry: IndustryProfile, difficulty: DifficultyProfile, rng: () => number = Math.random): Competitor[] {
  const used = new Set<string>()
  return Array.from({ length: difficulty.competitorCount }, () => {
    const quality = QUALITY_ORDER[Math.floor(rng() * QUALITY_ORDER.length)]
    const strategyType = pickStrategyForQuality(quality, rng)
    return {
      id: createId('competitor'),
      name: generateCompetitorName(rng, used),
      industry: industry.industry,
      price: Math.round(industry.averagePrice * randomInRange(0.7, 1.35, rng) * 100) / 100,
      quality,
      marketShare: Math.round(randomInRange(5, 20, rng)),
      reputation: Math.round(randomInRange(40, 75, rng)),
      strengths: [quality === 'luxury' || quality === 'premium' ? 'Strong brand reputation' : 'Aggressive pricing'],
      weaknesses: [quality === 'budget' ? 'Inconsistent quality' : 'Higher prices than average'],
      advertisingIntensity: Math.round(randomInRange(0.2, 0.6, rng) * 100) / 100,
      strategyType,
      riskTolerance: Math.round(randomInRange(0.2, 0.8, rng) * 100) / 100,
      researchAbility: Math.round(randomInRange(0.2, 0.8, rng) * 100) / 100,
      marketingStrength: Math.round(randomInRange(0.2, 0.8, rng) * 100) / 100,
      productionEfficiency: Math.round(randomInRange(0.2, 0.8, rng) * 100) / 100,
    }
  })
}

/** Deterministic, explainable backfill for save-migration — quality/price/advertising already carry a "personality", this just names it and gives it the new trait numbers. */
export function backfillCompetitorStrategy(competitor: Competitor, index: number): Competitor {
  const rng = mulberry32(hashSeed(competitor.id) + index)
  const strategyType = pickStrategyForQuality(competitor.quality, rng)
  return {
    ...competitor,
    strategyType,
    riskTolerance: Math.round(randomInRange(0.3, 0.7, rng) * 100) / 100,
    researchAbility: Math.round(randomInRange(0.3, 0.7, rng) * 100) / 100,
    marketingStrength: Math.round(randomInRange(0.3, 0.7, rng) * 100) / 100,
    productionEfficiency: Math.round(randomInRange(0.3, 0.7, rng) * 100) / 100,
  }
}

function hashSeed(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type CompetitorPlayerContext = {
  averagePrice: number
  /** 0-100 quality score, comparable to `computeQualityScore`'s output. */
  averageQualityScore: number
  marketShare: number
}

const COMPETITOR_ACTION_TYPES: CompetitorActionType[] = ['price-change', 'product-launch', 'quality-improvement', 'ad-campaign', 'market-entry', 'wage-increase', 'hiring', 'acquisition-attempt']

function pickWeightedAction(profile: CompetitorStrategyProfile, competitor: Competitor, player: CompetitorPlayerContext, rng: () => number, allowAcquisition: boolean): CompetitorActionType | 'hold-steady' {
  const holdChance = clamp(0.45 - competitor.riskTolerance * 0.35, 0.05, 0.5)
  if (rng() < holdChance) return 'hold-steady'

  const weights: Partial<Record<CompetitorActionType, number>> = { ...profile.actionWeights }
  // Respond to the player's own strategy, not just their own archetype.
  if (player.averagePrice > 0 && player.averagePrice < competitor.price * 0.9) {
    weights['price-change'] = (weights['price-change'] ?? 0.15) + 1.5
  }
  if (player.averageQualityScore > QUALITY_BASE_SCORE[competitor.quality] + 15) {
    weights['quality-improvement'] = (weights['quality-improvement'] ?? 0.15) + 1.2
  }
  if (player.marketShare > 25) {
    weights['market-entry'] = (weights['market-entry'] ?? 0.15) + 0.8
  }

  const entries = COMPETITOR_ACTION_TYPES
    .filter((action) => action !== 'acquisition-attempt' || allowAcquisition)
    .map((action): [CompetitorActionType, number] => [action, weights[action] ?? 0.15])
    .filter(([, weight]) => weight > 0)
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0)
  if (totalWeight <= 0) return 'hold-steady'
  let roll = rng() * totalWeight
  for (const [action, weight] of entries) {
    roll -= weight
    if (roll <= 0) return action
  }
  return entries[entries.length - 1][0]
}

function makeActivityEvent(competitor: Competitor, year: number, actionType: CompetitorActionType, headline: string, detail: string, demandImpactPercent: number): CompetitorActivityEvent {
  return { id: createId('competitor-action'), year, competitorId: competitor.id, competitorName: competitor.name, strategyType: competitor.strategyType, actionType, headline, detail, demandImpactPercent: Math.round(demandImpactPercent) }
}

/**
 * Competitors take one deliberate action a year, driven by their strategy
 * archetype and how they read the player's current price/quality/market
 * share — replacing the old pure random walk. Runs before this year's demand
 * is computed, so a competitor's price cut or product launch actually
 * affects the same year's sales, matching the activity-feed explanation the
 * player sees (`demandImpactPercent` is an estimate for that explanation;
 * the real effect flows through the updated `Competitor` fields into
 * `computeDemand`'s existing competition formula).
 */
export function runCompetitorActionsForYear(
  competitors: Competitor[],
  player: CompetitorPlayerContext,
  year: number,
  rng: () => number = Math.random,
): { competitors: Competitor[]; activity: CompetitorActivityEvent[] } {
  const activity: CompetitorActivityEvent[] = []
  const removedIds = new Set<string>()
  const nextPool: Competitor[] = []

  for (const competitor of competitors) {
    if (removedIds.has(competitor.id)) continue
    const profile = COMPETITOR_STRATEGY_PROFILES[competitor.strategyType]
    const activeCount = competitors.length - removedIds.size
    const allowAcquisition = activeCount > 2 && (competitor.strategyType === 'corporate-predator' || competitor.strategyType === 'aggressive-expander')
    const action = pickWeightedAction(profile, competitor, player, rng, allowAcquisition)

    if (action === 'hold-steady') {
      nextPool.push(competitor)
      continue
    }

    if (action === 'price-change') {
      const magnitude = randomInRange(0.03, 0.15, rng) * (0.5 + competitor.riskTolerance)
      const direction = profile.priceBias + randomInRange(-0.3, 0.3, rng) >= 0 ? 1 : -1
      const newPrice = Math.max(1, Math.round(competitor.price * (1 + direction * magnitude) * 100) / 100)
      nextPool.push({ ...competitor, price: newPrice })
      const changePercent = Math.round(magnitude * 100)
      activity.push(makeActivityEvent(competitor, year, 'price-change',
        direction < 0 ? `${competitor.name} cut its price by ${changePercent}%` : `${competitor.name} raised its price by ${changePercent}%`,
        direction < 0 ? 'Your product is now relatively less attractive to price-sensitive customers.' : 'Your product now looks relatively better value by comparison.',
        direction < 0 ? -changePercent * 0.4 : changePercent * 0.22))
      continue
    }

    if (action === 'quality-improvement') {
      const currentIndex = QUALITY_ORDER.indexOf(competitor.quality)
      const nextIndex = Math.min(QUALITY_ORDER.length - 1, currentIndex + 1)
      if (nextIndex === currentIndex) { nextPool.push(competitor); continue }
      nextPool.push({ ...competitor, quality: QUALITY_ORDER[nextIndex] })
      activity.push(makeActivityEvent(competitor, year, 'quality-improvement',
        `${competitor.name} upgraded its product to ${QUALITY_ORDER[nextIndex]} quality`,
        'Customers comparing quality now see less of a gap between your product and theirs.',
        -randomInRange(2, 6, rng)))
      continue
    }

    if (action === 'ad-campaign') {
      const boost = randomInRange(0.15, 0.3, rng) * (0.5 + competitor.marketingStrength)
      nextPool.push({ ...competitor, advertisingIntensity: clamp(Math.round((competitor.advertisingIntensity + boost) * 100) / 100, 0.05, 0.95) })
      activity.push(makeActivityEvent(competitor, year, 'ad-campaign',
        `${competitor.name} launched a major advertising campaign`,
        'Their increased visibility pulled some attention away from your products this year.',
        -randomInRange(2, 7, rng) * (0.5 + competitor.marketingStrength)))
      continue
    }

    if (action === 'product-launch') {
      const shareBump = randomInRange(2, 5, rng)
      nextPool.push({ ...competitor, marketShare: clamp(Math.round(competitor.marketShare + shareBump), 1, 60), advertisingIntensity: clamp(Math.round((competitor.advertisingIntensity + 0.05) * 100) / 100, 0.05, 0.95) })
      activity.push(makeActivityEvent(competitor, year, 'product-launch',
        `${competitor.name} launched a new product`,
        'Customers now have an additional option in the market, softening demand for your products.',
        -randomInRange(3, 8, rng)))
      continue
    }

    if (action === 'market-entry') {
      const shareBump = randomInRange(5, 10, rng) * (0.5 + competitor.riskTolerance)
      nextPool.push({ ...competitor, marketShare: clamp(Math.round(competitor.marketShare + shareBump), 1, 60) })
      activity.push(makeActivityEvent(competitor, year, 'market-entry',
        `${competitor.name} expanded aggressively into new customer segments`,
        'Their expansion reached customers who might otherwise have considered your products.',
        -randomInRange(5, 12, rng)))
      continue
    }

    if (action === 'wage-increase' || action === 'hiring') {
      const repBump = Math.round(randomInRange(2, 5, rng))
      nextPool.push({ ...competitor, reputation: clamp(competitor.reputation + repBump, 10, 95) })
      activity.push(makeActivityEvent(competitor, year, action,
        action === 'wage-increase' ? `${competitor.name} raised wages to retain staff` : `${competitor.name} expanded its workforce`,
        'This strengthened their standing as an employer, with little direct effect on your sales.',
        0))
      continue
    }

    if (action === 'acquisition-attempt') {
      const targets = competitors.filter((c) => c.id !== competitor.id && !removedIds.has(c.id))
      const target = targets.reduce<Competitor | null>((weakest, c) => (weakest === null || c.marketShare < weakest.marketShare ? c : weakest), null)
      if (!target) { nextPool.push(competitor); continue }
      const acquirerStrength = competitor.marketingStrength + competitor.productionEfficiency + competitor.riskTolerance
      const successChance = clamp(0.25 + acquirerStrength * 0.15 - target.reputation / 300, 0.1, 0.75)
      if (rng() < successChance) {
        removedIds.add(target.id)
        nextPool.push({ ...competitor, marketShare: clamp(Math.round(competitor.marketShare + target.marketShare), 1, 70) })
        activity.push(makeActivityEvent(competitor, year, 'acquisition-attempt',
          `${competitor.name} acquired ${target.name}`,
          'The combined company now holds a larger share of the market, increasing competitive pressure on you.',
          -randomInRange(4, 10, rng)))
      } else {
        nextPool.push(competitor)
        activity.push(makeActivityEvent(competitor, year, 'acquisition-attempt',
          `${competitor.name} attempted to acquire ${target.name}, but the deal fell through`,
          'No immediate effect on your business, though the industry took notice of the attempt.',
          0))
      }
      continue
    }

    nextPool.push(competitor)
  }

  return { competitors: nextPool, activity }
}

// --- Yearly events ---------------------------------------------------------------

export type SimulatedEvent = BusinessEvent & {
  costMultiplier: number
  demandMultiplier: number
  reputationDelta: number
  /** The named reason a nonzero `reputationDelta` should be recorded under in `reputationHistory` — required whenever `reputationDelta` is nonzero. */
  reputationReasonCategory?: ReputationReasonCategory
  satisfactionDelta: number
  economicIndexDelta: number
  targetProductId?: string
}

type EventTemplate = {
  headline: string
  body: string
  impact: string
  weight: number
  /** Some events (like a crisis) roll a different outcome depending on the company's current reputation, so how well-prepared the company is — not luck alone — decides the result. */
  build: (rng: () => number, targetProductId: string | undefined, currentReputation: number) => Omit<SimulatedEvent, 'id' | 'year' | 'headline' | 'body' | 'impact'> & Partial<Pick<SimulatedEvent, 'headline' | 'body' | 'impact'>>
}

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    headline: 'Production costs increase',
    body: 'Raw material and supplier prices rose industry-wide this year.',
    impact: 'Production cost per unit was higher than usual for every product manufactured this year.',
    weight: 3,
    build: (rng) => ({ costMultiplier: 1 + randomInRange(0.08, 0.15, rng), demandMultiplier: 1, reputationDelta: 0, satisfactionDelta: 0, economicIndexDelta: 0 }),
  },
  {
    headline: 'A new competitor enters the market',
    body: 'A new company launched in your industry this year, adding to the competition.',
    impact: 'Demand softened slightly as customers had a new option to consider.',
    weight: 2,
    build: (rng) => ({ costMultiplier: 1, demandMultiplier: 1 - randomInRange(0.03, 0.07, rng), reputationDelta: 0, satisfactionDelta: 0, economicIndexDelta: 0 }),
  },
  {
    headline: 'A product became popular online',
    body: 'One of your products started getting shared and talked about online.',
    impact: 'Demand for that product rose well beyond what advertising alone would explain.',
    weight: 2,
    build: (rng, targetProductId) => ({ costMultiplier: 1, demandMultiplier: 1 + randomInRange(0.15, 0.3, rng), reputationDelta: 2, reputationReasonCategory: 'MEDIA_COVERAGE', satisfactionDelta: 0, economicIndexDelta: 0, targetProductId }),
  },
  {
    headline: 'Customer preferences changed',
    body: 'What customers want shifted slightly this year, for reasons outside your control.',
    impact: 'Demand moved compared to last year based on how well your lineup matched the new preference.',
    weight: 3,
    build: (rng) => ({ costMultiplier: 1, demandMultiplier: 1 + randomInRange(-0.1, 0.1, rng), reputationDelta: 0, satisfactionDelta: 0, economicIndexDelta: 0 }),
  },
  {
    headline: 'A supplier offered a discount',
    body: 'One of your suppliers offered a limited-time discount on materials.',
    impact: 'Production cost per unit was lower than usual for every product manufactured this year.',
    weight: 2,
    build: (rng) => ({ costMultiplier: 1 - randomInRange(0.08, 0.15, rng), demandMultiplier: 1, reputationDelta: 0, satisfactionDelta: 0, economicIndexDelta: 0 }),
  },
  {
    headline: 'A product received poor reviews',
    body: 'Customers left critical reviews about one of your products this year.',
    impact: 'Demand and customer satisfaction for that product both took a hit.',
    weight: 2,
    build: (rng, targetProductId) => ({ costMultiplier: 1, demandMultiplier: 1 - randomInRange(0.15, 0.25, rng), reputationDelta: -2, reputationReasonCategory: 'QUALITY_ISSUE', satisfactionDelta: -5, economicIndexDelta: 0, targetProductId }),
  },
  {
    headline: 'The economy slowed down',
    body: 'Broader economic conditions weakened this year, affecting customer spending.',
    impact: 'Demand was lower across the board, and this effect will fade gradually over future years.',
    weight: 2,
    build: (rng) => ({ costMultiplier: 1, demandMultiplier: 1 - randomInRange(0.03, 0.08, rng), reputationDelta: 0, satisfactionDelta: 0, economicIndexDelta: -randomInRange(0.05, 0.12, rng) }),
  },
  {
    headline: 'Industry demand increased',
    body: 'Overall demand in your industry grew faster than expected this year.',
    impact: 'Demand for all of your products rose, reflecting the wider industry growth.',
    weight: 2,
    build: (rng) => ({ costMultiplier: 1, demandMultiplier: 1 + randomInRange(0.1, 0.2, rng), reputationDelta: 0, satisfactionDelta: 0, economicIndexDelta: randomInRange(0.02, 0.06, rng) }),
  },
  {
    headline: 'New regulations increased costs',
    body: 'New industry regulations came into effect this year.',
    impact: 'Production cost per unit was higher than usual to meet the new requirements.',
    weight: 1,
    build: (rng) => ({ costMultiplier: 1 + randomInRange(0.05, 0.12, rng), demandMultiplier: 1, reputationDelta: 0, satisfactionDelta: 0, economicIndexDelta: 0 }),
  },
  {
    headline: 'A minor operational crisis hit the company',
    body: 'An unexpected problem (a shipment mix-up, a short outage, a scheduling failure) put the company under pressure this year.',
    impact: 'How well this was handled depended on the company’s standing going in.',
    weight: 2,
    build: (rng, _targetProductId, currentReputation) => {
      const handledWell = currentReputation >= 55
      return handledWell
        ? {
            headline: 'A crisis was handled responsibly',
            body: 'An unexpected operational problem came up this year, and the company’s existing standing meant customers gave it the benefit of the doubt while it was resolved.',
            impact: 'The crisis was resolved without lasting damage, and handling it transparently was noticed.',
            costMultiplier: 1 + randomInRange(0.02, 0.05, rng),
            demandMultiplier: 1,
            reputationDelta: 2,
            reputationReasonCategory: 'CRISIS_HANDLED_WELL' as const,
            satisfactionDelta: 0,
            economicIndexDelta: 0,
          }
        : {
            headline: 'A crisis was mishandled',
            body: 'An unexpected operational problem came up this year, and a shaky starting reputation meant customers were quick to assume the worst.',
            impact: 'The crisis caused real reputational damage on top of the direct cost.',
            costMultiplier: 1 + randomInRange(0.05, 0.1, rng),
            demandMultiplier: 1 - randomInRange(0.03, 0.08, rng),
            reputationDelta: -4,
            reputationReasonCategory: 'CRISIS_MISHANDLED' as const,
            satisfactionDelta: 0,
            economicIndexDelta: 0,
          }
    },
  },
  {
    headline: 'Positive press coverage',
    body: 'A journalist or industry publication featured the company favorably this year.',
    impact: 'Awareness and trust both got a small, explainable boost.',
    weight: 1,
    build: (rng) => ({ costMultiplier: 1, demandMultiplier: 1 + randomInRange(0.03, 0.08, rng), reputationDelta: 2, reputationReasonCategory: 'MEDIA_COVERAGE', satisfactionDelta: 0, economicIndexDelta: 0 }),
  },
  {
    headline: 'A repeated stockout frustrated customers',
    body: 'One of your products ran out of stock again this year, and customers noticed the pattern.',
    impact: 'Repeated availability problems cost more than one bad year of sales — they cost trust.',
    weight: 1,
    build: (rng, targetProductId) => ({ costMultiplier: 1, demandMultiplier: 1 - randomInRange(0.05, 0.1, rng), reputationDelta: -2, reputationReasonCategory: 'REPEATED_STOCKOUT', satisfactionDelta: -3, economicIndexDelta: 0, targetProductId }),
  },
]

export function generateYearlyEvents(industry: IndustryProfile, difficulty: DifficultyProfile, activeProductIds: string[], year: number, currentReputation: number, rng: () => number = Math.random): SimulatedEvent[] {
  const pool = [...EVENT_TEMPLATES]
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0)
  const picked: SimulatedEvent[] = []
  const maxEvents = 2

  for (let i = 0; i < pool.length && picked.length < maxEvents; i++) {
    const template = pool[i]
    const chance = (template.weight / totalWeight) * 1.4 * difficulty.volatility
    if (rng() < chance) {
      const targetProductId = activeProductIds.length > 0 ? activeProductIds[Math.floor(rng() * activeProductIds.length)] : undefined
      const built = template.build(rng, targetProductId, currentReputation)
      picked.push({
        id: createId('event'),
        year,
        headline: built.headline ?? template.headline,
        body: built.body ?? template.body,
        impact: built.impact ?? template.impact,
        ...built,
      })
    }
  }
  return picked
}

// --- Satisfaction, reputation, company value --------------------------------------

export function computeProductSatisfaction(qualityScore: number, price: number, industry: IndustryProfile, availableStock: number, unitsSold: number): number {
  const pricePosition = clamp(price / (industry.averagePrice * 3), 0, 1)
  const qualityPosition = qualityScore / 100
  const priceFairness = clamp(100 - Math.abs(pricePosition - qualityPosition) * 140, 0, 100)
  const stockoutPenalty = availableStock > 0 && unitsSold >= availableStock ? 10 : 0
  const score = qualityScore * 0.6 + priceFairness * 0.3 + (100 - stockoutPenalty) * 0.1
  return clamp(Math.round(score), 0, 100)
}

export function computeCompanySatisfaction(products: Product[], previous: number): number {
  const active = products.filter((p) => !p.discontinued && p.history.length > 0)
  if (active.length === 0) return previous
  const average = active.reduce((sum, p) => sum + p.satisfaction, 0) / active.length
  return clamp(Math.round(previous * 0.4 + average * 0.6), 0, 100)
}

/** The slow pull of reputation toward customer satisfaction — reputation events themselves are applied one at a time through `appendReputationTransaction` in the yearly close-out, each with its own explained reason; this is only the ambient "reputation tends to follow satisfaction over time" component. */
export function computeSatisfactionReputationPull(previousReputation: number, satisfaction: number, difficulty: DifficultyProfile): number {
  return Math.round((satisfaction - previousReputation) * 0.1 * difficulty.reputationVolatility)
}

export function computeCompanyValue(cash: number, products: Product[], marketShare: number, reputation: number): number {
  const inventoryValue = products.reduce((sum, p) => sum + p.inventory * p.costPerUnit, 0)
  const goodwill = marketShare * 500 + reputation * 300
  return Math.round(cash + inventoryValue + goodwill)
}

// --- Loans -----------------------------------------------------------------------

export type LoanApprovalOdds = { odds: number; factors: string[] }

/** Approval odds are transparent, never a hidden coin flip — every factor that moved the odds is returned alongside the number so the player can see exactly why. */
export function computeLoanApprovalOdds(reputation: number, existingLoanBalance: number, companyValue: number, requestedAmount: number, difficulty: DifficultyProfile): LoanApprovalOdds {
  const factors: string[] = []
  let odds = 0.5

  const reputationFactor = (reputation - 50) / 100
  odds += reputationFactor * 0.6
  factors.push(reputationFactor >= 0 ? `Reputation ${reputation}/100 improves approval odds.` : `Reputation ${reputation}/100 reduces approval odds.`)

  const debtToValue = companyValue > 0 ? (existingLoanBalance + requestedAmount) / companyValue : 1
  const debtPenalty = clamp(debtToValue * 0.4, 0, 0.5)
  odds -= debtPenalty
  if (debtPenalty > 0.05) factors.push('Existing debt relative to company value reduces approval odds.')

  odds /= difficulty.loanApprovalDifficulty
  factors.push(
    difficulty.loanApprovalDifficulty > 1
      ? 'This difficulty makes lenders stricter.'
      : difficulty.loanApprovalDifficulty < 1
        ? 'This difficulty makes lenders more lenient.'
        : 'Lender strictness is standard for this difficulty.',
  )

  return { odds: clamp(odds, 0.05, 0.95), factors }
}

/** Better reputation earns a lower interest rate — lenders see less risk in a trusted company. */
export function computeLoanInterestRate(reputation: number, difficulty: DifficultyProfile): number {
  const base = 0.05 + (1 - reputation / 100) * 0.1
  return Math.round(base * difficulty.loanApprovalDifficulty * 1000) / 1000
}

// --- Product reviews, ratings, reliability ----------------------------------------

export function computeProductReliability(qualityScore: number, rng: () => number): number {
  return clamp(Math.round(qualityScore * 0.9 + randomInRange(-8, 8, rng)), 0, 100)
}

export function computeProductReturnRate(reliability: number, satisfaction: number): number {
  const rate = clamp((100 - reliability) * 0.003 + (100 - satisfaction) * 0.002, 0.01, 0.4)
  return Math.round(rate * 1000) / 1000
}

export function computeProductComplaintRate(reliability: number, satisfaction: number): number {
  const rate = clamp((100 - reliability) * 0.004 + (100 - satisfaction) * 0.003, 0.005, 0.5)
  return Math.round(rate * 1000) / 1000
}

export function computeProductRating(satisfaction: number, reliability: number): number {
  const score = ((satisfaction * 0.6 + reliability * 0.4) / 100) * 5
  return Math.round(score * 10) / 10
}

export function computeCustomerLoyalty(previous: number, satisfaction: number, reliability: number): number {
  const target = satisfaction * 0.5 + reliability * 0.5
  return clamp(Math.round(previous * 0.6 + target * 0.4), 0, 100)
}

/** Awareness grows with advertising reach and real sales activity, and decays slowly without reinforcement — a product stops being "front of mind" if it's neither advertised nor selling. */
export function computeAwarenessGrowth(previous: number, advertisingReach: number, potentialBuyers: number, unitsSold: number): number {
  const adGrowth = clamp((advertisingReach / Math.max(1, potentialBuyers)) * 40, 0, 15)
  const salesGrowth = unitsSold > 0 ? 5 : 0
  return clamp(Math.round(previous + adGrowth + salesGrowth - 3), 0, 100)
}

const POSITIVE_REVIEW_POOL = [
  'Exactly what I needed — works reliably every time.',
  'Great value for the price. Would buy again.',
  'Better quality than I expected.',
  'Arrived in good shape and does the job well.',
  'Solid choice — no complaints so far.',
]
const NEUTRAL_REVIEW_POOL = [
  'It does what it says, nothing more.',
  'Decent, but I have seen better for the price.',
  'Works fine, though the packaging could be better.',
  'Average experience overall.',
]
const NEGATIVE_REVIEW_POOL = [
  'Stopped working properly after a short time.',
  'Not worth the price — expected better quality.',
  'Had to return mine due to a defect.',
  'Customer support was slow when I had an issue.',
  'Quality feels lower than advertised.',
]

export function generateProductReview(rating: number, year: number, rng: () => number): ProductReview {
  const sentiment: ReviewSentiment = rating >= 3.5 ? 'positive' : rating >= 2.5 ? 'neutral' : 'negative'
  const pool = sentiment === 'positive' ? POSITIVE_REVIEW_POOL : sentiment === 'neutral' ? NEUTRAL_REVIEW_POOL : NEGATIVE_REVIEW_POOL
  const text = pool[Math.floor(rng() * pool.length)]
  return { id: createId('review'), year, sentiment, text, createdAt: new Date().toISOString() }
}

/** Weak-reliability products in recall-prone industries (Cars, Food) can trigger a genuine recall — this is the concrete mechanic behind "product defects can lower product and company reputation." */
export function checkForProductRecall(reliability: number, industry: IndustryProfile, rng: () => number): boolean {
  if (reliability >= 30) return false
  return rng() < industry.challengeProfile.recallRisk
}

export function getInitialCompetitors(industryName: GameState['industry'], difficulty: DifficultyProfile, rng: () => number = Math.random): Competitor[] {
  return createCompetitorsForIndustry(getIndustryProfile(industryName), difficulty, rng)
}
