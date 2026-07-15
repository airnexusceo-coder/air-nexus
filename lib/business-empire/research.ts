import { createId } from '@/lib/business-empire/simulation'
import type { Competitor, IndustryProfile, ProductQuality, ResearchLevel, ResearchReport } from '@/lib/business-empire/types'

export type ResearchLevelConfig = {
  id: ResearchLevel
  label: string
  description: string
  costFactor: number
  /** 0-1: how close the report's numbers land to the real underlying figures. */
  accuracy: number
}

export const RESEARCH_LEVELS: ResearchLevelConfig[] = [
  { id: 'basic', label: 'Basic Research', description: 'A rough, cheap snapshot. Useful for a first guess, but treat the numbers loosely.', costFactor: 0.5, accuracy: 0.5 },
  { id: 'standard', label: 'Standard Research', description: 'A solid general picture of demand, pricing, and competitors.', costFactor: 1, accuracy: 0.7 },
  { id: 'detailed', label: 'Detailed Research', description: 'A thorough study with narrower, more trustworthy estimates.', costFactor: 2, accuracy: 0.85 },
  { id: 'premium', label: 'Premium Research', description: 'The most accurate report available, at the highest price.', costFactor: 3.5, accuracy: 0.95 },
]

export function getResearchLevelConfig(level: ResearchLevel): ResearchLevelConfig {
  const config = RESEARCH_LEVELS.find((entry) => entry.id === level)
  if (!config) throw new Error(`Unknown research level: ${level}`)
  return config
}

export function computeResearchCost(industry: IndustryProfile, level: ResearchLevel): number {
  const config = getResearchLevelConfig(level)
  // 0.2 keeps even Premium research on the most capital-intensive industry (Cars: averagePrice
  // 28,000, researchCostFactor 2.5) well under the $500k starting-cash ceiling — the old constant
  // of 40 put Basic research on Cars past $1.4M, making the entire Research page unaffordable
  // (and thus dead functionality) for that industry at any starting cash.
  const cost = industry.averagePrice * 0.2 * config.costFactor * industry.researchCostFactor
  return Math.max(50, Math.round(cost))
}

export const PRODUCT_FEATURE_OPTIONS = [
  'Extra durability', 'Eco-friendly materials', 'Sleek, modern design', 'Bonus accessories included',
  'Extended warranty', 'Customization options', 'Premium materials', 'Smart / connected features',
  'Faster performance', 'Improved packaging', 'Lightweight build', 'Easier to use',
]
const FEATURE_POOL = PRODUCT_FEATURE_OPTIONS

const TREND_POOL = [
  'Customers are increasingly comparing prices online before buying.',
  'Interest is shifting toward products with sustainable or eco-friendly claims.',
  'Word-of-mouth and online reviews are driving more purchase decisions than advertising alone.',
  'Customers are showing more loyalty to brands with strong reputations.',
  'Demand is becoming more sensitive to price than it was last year.',
  'Interest in premium, higher-quality options is slowly growing.',
]

function randomInRange(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min)
}

function pickN<T>(pool: T[], n: number, rng: () => number): T[] {
  const shuffled = [...pool].sort(() => rng() - 0.5)
  return shuffled.slice(0, n)
}

const QUALITY_ORDER: ProductQuality[] = ['budget', 'standard', 'premium', 'luxury']

/**
 * Produces a research report whose numbers cluster around the real
 * underlying industry figures, with noise that shrinks as the chosen
 * research level's accuracy rises. Research narrows uncertainty — it never
 * removes it entirely, so the player still has to make a judgment call.
 */
export function generateResearchReport(
  industry: IndustryProfile,
  level: ResearchLevel,
  targetGroupId: string,
  competitors: Competitor[],
  year: number,
  rng: () => number = Math.random,
): ResearchReport {
  const config = getResearchLevelConfig(level)
  const noise = 1 - config.accuracy

  const groupCount = Math.max(1, industry.customerGroups.length)
  const trueDemand = (industry.marketSize / groupCount) * randomInRange(0.6, 1.0, rng)
  const estimatedDemandUnits = Math.max(0, Math.round(trueDemand * (1 + randomInRange(-noise, noise, rng))))

  const priceCenter = industry.averagePrice * randomInRange(0.9, 1.1, rng)
  const spread = industry.averagePrice * (0.15 + noise * 0.35)
  const priceRangeLow = Math.max(1, Math.round((priceCenter - spread) * 100) / 100)
  const priceRangeHigh = Math.round((priceCenter + spread) * 100) / 100

  const desiredQuality = QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, Math.floor(rng() * (2 + config.accuracy * 2)))]

  const marketSizeEstimate = Math.round(industry.marketSize * (1 + randomInRange(-noise * 0.3, noise * 0.3, rng)))

  const competitorPrices = competitors.map((competitor) => ({
    competitorId: competitor.id,
    competitorName: competitor.name,
    price: Math.max(1, Math.round(competitor.price * (1 + randomInRange(-noise * 0.2, noise * 0.2, rng)) * 100) / 100),
  }))

  const popularFeatures = pickN(FEATURE_POOL, 2 + Math.round(config.accuracy * 2), rng)
  const trend = TREND_POOL[Math.floor(rng() * TREND_POOL.length)]

  return {
    id: createId('research'),
    year,
    level,
    cost: computeResearchCost(industry, level),
    estimatedDemandUnits,
    priceRangeLow,
    priceRangeHigh,
    desiredQuality,
    targetGroupId,
    marketSizeEstimate,
    competitorPrices,
    popularFeatures,
    trend,
    competitionLevel: industry.competitionLevel,
    accuracy: config.accuracy,
    createdAt: new Date().toISOString(),
  }
}
