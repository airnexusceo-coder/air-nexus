import { getIndustryProfile } from '@/lib/business-empire/industries'
import type {
  AdvertisingCampaign,
  AdvertisingChannel,
  BusinessEvent,
  CashTransaction,
  CashTransactionCategory,
  Competitor,
  DifficultyProfile,
  GameState,
  IndustryProfile,
  Product,
  ProductQuality,
  ProductionMethod,
  PackagingQuality,
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

export function computeWages(totalUnitsPlanned: number, activeProductCount: number, difficulty: DifficultyProfile): number {
  const base = 1_500 * Math.max(1, activeProductCount) + totalUnitsPlanned * 0.03
  return Math.round(base * difficulty.costMultiplier)
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
}

/** Estimated number of customers who want to buy this year — driven by price, quality, advertising, reputation, and competition, with a bounded random swing on top so outcomes are never fully predictable in advance. */
export function computeDemand(input: DemandInput): number {
  const { product, qualityScore, industry, competitors, brandReputation, customerSatisfaction, economicIndex, difficulty, advertisingReach, demandEventMultiplier, isFirstYearForCompany, rng } = input

  const groupCount = Math.max(1, industry.customerGroups.length)
  const potentialBuyers = industry.marketSize / groupCount

  const priceMultiplier = clamp((industry.averagePrice / Math.max(1, product.price)) ** 0.8, 0.1, 2.5)
  const qualityMultiplier = clamp(qualityScore / 60, 0.4, 1.7)
  const reputationMultiplier = clamp(0.7 + (brandReputation / 100) * 0.6, 0.5, 1.4)
  const satisfactionMultiplier = isFirstYearForCompany ? 1 : clamp(0.8 + (customerSatisfaction / 100) * 0.4, 0.7, 1.3)

  const competitionBaseline = industry.competitionLevel === 'high' ? 0.75 : industry.competitionLevel === 'medium' ? 0.9 : 1.05
  const strongerCompetitors = competitors.filter((c) => c.price <= product.price && c.reputation >= brandReputation).length
  const competitionMultiplier = clamp(competitionBaseline - strongerCompetitors * 0.03, 0.35, 1.1)

  const adImpact = clamp((advertisingReach / potentialBuyers) * 0.6, 0, 0.8)
  const advertisingMultiplier = 1 + adImpact

  const rawDemand =
    potentialBuyers *
    priceMultiplier *
    qualityMultiplier *
    reputationMultiplier *
    satisfactionMultiplier *
    competitionMultiplier *
    advertisingMultiplier *
    economicIndex *
    demandEventMultiplier *
    difficulty.demandMultiplier

  const swing = difficulty.volatility * 0.15
  const randomized = rawDemand * (1 + randomInRange(-swing, swing, rng))
  return Math.max(0, Math.round(randomized))
}

// --- Advertising ---------------------------------------------------------------

export function estimateAdvertisingReach(channel: AdvertisingChannel, budget: number, reachPerDollar: number, industryEffectiveness: number): number {
  return Math.round(budget * reachPerDollar * industryEffectiveness)
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

export function createCompetitorsForIndustry(industry: IndustryProfile, difficulty: DifficultyProfile, rng: () => number = Math.random): Competitor[] {
  const used = new Set<string>()
  return Array.from({ length: difficulty.competitorCount }, () => {
    const quality = QUALITY_ORDER[Math.floor(rng() * QUALITY_ORDER.length)]
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
    }
  })
}

export function updateCompetitorsForYear(competitors: Competitor[], playerMarketShare: number, difficulty: DifficultyProfile, rng: () => number = Math.random): Competitor[] {
  const remainingShare = Math.max(0, 100 - playerMarketShare)
  const totalCompetitorWeight = competitors.reduce((sum, c) => sum + c.marketShare, 0) || 1
  return competitors.map((competitor) => {
    const priceDrift = randomInRange(-0.05, 0.05, rng) * difficulty.volatility
    const reputationDrift = randomInRange(-3, 3, rng) * difficulty.volatility
    const shareWeight = competitor.marketShare / totalCompetitorWeight
    return {
      ...competitor,
      price: Math.max(1, Math.round(competitor.price * (1 + priceDrift) * 100) / 100),
      reputation: clamp(Math.round(competitor.reputation + reputationDrift), 10, 95),
      marketShare: clamp(Math.round(remainingShare * shareWeight), 1, 60),
    }
  })
}

// --- Yearly events ---------------------------------------------------------------

export type SimulatedEvent = BusinessEvent & {
  costMultiplier: number
  demandMultiplier: number
  reputationDelta: number
  satisfactionDelta: number
  economicIndexDelta: number
  targetProductId?: string
}

type EventTemplate = {
  headline: string
  body: string
  impact: string
  weight: number
  build: (rng: () => number, targetProductId?: string) => Omit<SimulatedEvent, 'id' | 'year' | 'headline' | 'body' | 'impact'>
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
    build: (rng, targetProductId) => ({ costMultiplier: 1, demandMultiplier: 1 + randomInRange(0.15, 0.3, rng), reputationDelta: 2, satisfactionDelta: 0, economicIndexDelta: 0, targetProductId }),
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
    build: (rng, targetProductId) => ({ costMultiplier: 1, demandMultiplier: 1 - randomInRange(0.15, 0.25, rng), reputationDelta: -2, satisfactionDelta: -5, economicIndexDelta: 0, targetProductId }),
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
]

export function generateYearlyEvents(industry: IndustryProfile, difficulty: DifficultyProfile, activeProductIds: string[], year: number, rng: () => number = Math.random): SimulatedEvent[] {
  const pool = [...EVENT_TEMPLATES]
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0)
  const picked: SimulatedEvent[] = []
  const maxEvents = 2

  for (let i = 0; i < pool.length && picked.length < maxEvents; i++) {
    const template = pool[i]
    const chance = (template.weight / totalWeight) * 1.4 * difficulty.volatility
    if (rng() < chance) {
      const targetProductId = activeProductIds.length > 0 ? activeProductIds[Math.floor(rng() * activeProductIds.length)] : undefined
      const built = template.build(rng, targetProductId)
      picked.push({ id: createId('event'), year, headline: template.headline, body: template.body, impact: template.impact, ...built })
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

export function computeBrandReputation(previous: number, events: SimulatedEvent[], satisfaction: number): number {
  const eventDelta = events.reduce((sum, e) => sum + e.reputationDelta, 0)
  const satisfactionPull = (satisfaction - previous) * 0.1
  return clamp(Math.round(previous + eventDelta + satisfactionPull), 0, 100)
}

export function computeCompanyValue(cash: number, products: Product[], marketShare: number, reputation: number): number {
  const inventoryValue = products.reduce((sum, p) => sum + p.inventory * p.costPerUnit, 0)
  const goodwill = marketShare * 500 + reputation * 300
  return Math.round(cash + inventoryValue + goodwill)
}

export function getInitialCompetitors(industryName: GameState['industry'], difficulty: DifficultyProfile, rng: () => number = Math.random): Competitor[] {
  return createCompetitorsForIndustry(getIndustryProfile(industryName), difficulty, rng)
}
