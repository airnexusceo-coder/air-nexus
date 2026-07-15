export type Industry =
  | 'Clothing'
  | 'Sportswear'
  | 'Food & Beverages'
  | 'Restaurants'
  | 'Technology'
  | 'Smartphones'
  | 'Video Games'
  | 'Cosmetics'
  | 'Furniture'
  | 'Cars'
  | 'Education'
  | 'Fitness'
  | 'Entertainment'
  | 'Renewable Energy'
  | 'Online Retail'

export type CompetitionLevel = 'low' | 'medium' | 'high'

export type CustomerGroup = {
  id: string
  label: string
  description: string
}

export type AdvertisingChannel =
  | 'social-media'
  | 'video-ads'
  | 'search-ads'
  | 'television'
  | 'radio'
  | 'billboards'
  | 'influencer'
  | 'sponsorship'
  | 'discount-promo'
  | 'none'

export type IndustryProfile = {
  industry: Industry
  tagline: string
  customerGroups: CustomerGroup[]
  averagePrice: number
  /** Multiplies the baseline per-unit production cost curve — technology and cars run high, food and clothing run lower. */
  productionCostFactor: number
  competitionLevel: CompetitionLevel
  /** Total customers this industry's market can realistically reach in a year. */
  marketSize: number
  /** Typical annual market growth, as a percentage. */
  growthPotential: number
  /** 0-1 effectiveness multiplier per advertising channel, specific to this industry's typical customers. */
  advertisingEffectiveness: Record<AdvertisingChannel, number>
  commonRisks: string[]
  /** Multiplies research costs — technology/cars need expensive research, food/clothing are cheaper to study. */
  researchCostFactor: number
  /** Whether unsold inventory in this industry can expire (food, some entertainment tie-ins). */
  perishable: boolean
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type LearningSupport = 'full' | 'occasional' | 'minimal' | 'sandbox'

export type GamePreferences = {
  companyName: string
  founderName: string
  industry: Industry
  difficulty: Difficulty
  startingCash: number
  learningSupport: LearningSupport
  reducedMotion: boolean
}

export const DIFFICULTY_CASH_RANGE: Record<Difficulty, { min: number; max: number; default: number }> = {
  beginner: { min: 10_000, max: 100_000, default: 25_000 },
  intermediate: { min: 25_000, max: 250_000, default: 75_000 },
  advanced: { min: 50_000, max: 500_000, default: 150_000 },
}
export const STARTING_CASH_STEP = 5_000
export const GLOBAL_MIN_STARTING_CASH = 10_000
export const GLOBAL_MAX_STARTING_CASH = 500_000

export type DifficultyProfile = {
  /** Scales every production/research/rent/wage cost down (beginner) or up (advanced). */
  costMultiplier: number
  /** Scales how easily customers buy — higher demand multiplier is more forgiving. */
  demandMultiplier: number
  /** Scales random swings in demand/events — beginner is calmer, advanced is riskier. */
  volatility: number
  /** Extra fictional competitors seeded into the industry at this difficulty. */
  competitorCount: number
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  beginner: { costMultiplier: 0.8, demandMultiplier: 1.25, volatility: 0.5, competitorCount: 2 },
  intermediate: { costMultiplier: 1, demandMultiplier: 1, volatility: 1, competitorCount: 3 },
  advanced: { costMultiplier: 1.2, demandMultiplier: 0.85, volatility: 1.5, competitorCount: 4 },
}

export type ResearchLevel = 'basic' | 'standard' | 'detailed' | 'premium'

export type ResearchReport = {
  id: string
  year: number
  level: ResearchLevel
  cost: number
  estimatedDemandUnits: number
  priceRangeLow: number
  priceRangeHigh: number
  desiredQuality: ProductQuality
  targetGroupId: string
  marketSizeEstimate: number
  competitorPrices: { competitorId: string; competitorName: string; price: number }[]
  popularFeatures: string[]
  trend: string
  competitionLevel: CompetitionLevel
  /** 0-1: how close these estimates are likely to be to the real underlying numbers. Better research, higher accuracy. */
  accuracy: number
  createdAt: string
}

export type ProductQuality = 'budget' | 'standard' | 'premium' | 'luxury'
export type ProductionMethod = 'manual' | 'standard-factory' | 'automated' | 'outsourced'
export type PackagingQuality = 'basic' | 'standard' | 'premium'

export type ProductYearRecord = {
  year: number
  unitsProduced: number
  unitsSold: number
  unsoldAtYearEnd: number
  revenue: number
  costOfGoodsSold: number
  satisfaction: number
}

export type Product = {
  id: string
  name: string
  targetGroupId: string
  quality: ProductQuality
  features: string[]
  rndBudget: number
  unitsManufactured: number
  productionMethod: ProductionMethod
  packagingQuality: PackagingQuality
  price: number
  costPerUnit: number
  /** Unsold units carried over from previous years (before this year's production is added in). */
  inventory: number
  createdYear: number
  discontinued: boolean
  history: ProductYearRecord[]
  lifetimeUnitsSold: number
  lifetimeRevenue: number
  /** 0-100, updated after each year based on price/quality/availability fit. */
  satisfaction: number
}

export type AdvertisingChannelProfile = {
  id: AdvertisingChannel
  label: string
  description: string
  targetAudience: string
  /** Minimum sensible campaign budget for this channel. */
  minBudget: number
  /** How many people $1 of spend reaches, before industry/channel effectiveness is applied. */
  reachPerDollar: number
  effectivenessLabel: 'low' | 'medium' | 'high'
  risk: string
}

export type AdvertisingCampaign = {
  id: string
  year: number
  productId: string
  channel: AdvertisingChannel
  budget: number
  estimatedReach: number
  effectivenessScore: number
  createdAt: string
}

export type Competitor = {
  id: string
  name: string
  industry: Industry
  price: number
  quality: ProductQuality
  marketShare: number
  reputation: number
  strengths: string[]
  weaknesses: string[]
}

export type CashTransactionCategory =
  | 'STARTING_CAPITAL'
  | 'RESEARCH_COST'
  | 'PRODUCTION_COST'
  | 'ADVERTISING_COST'
  | 'WAGES'
  | 'RENT'
  | 'SALES_REVENUE'
  | 'TAX'
  | 'REFUND'
  | 'LOAN'
  | 'LOAN_REPAYMENT'
  | 'INVESTMENT'
  | 'OTHER_EXPENSE'

export type CashTransaction = {
  id: string
  year: number
  category: CashTransactionCategory
  description: string
  /** Signed — positive for money in, negative for money out. */
  amount: number
  balanceBefore: number
  balanceAfter: number
  relatedId?: string
  createdAt: string
}

export type BusinessEvent = {
  id: string
  year: number
  headline: string
  body: string
  /** Plain-language explanation of exactly how this changed the company's numbers this year. */
  impact: string
}

export type AnnualReport = {
  year: number
  openingCash: number
  unitsProduced: number
  unitsSold: number
  unsoldInventory: number
  totalRevenue: number
  productionCosts: number
  researchCosts: number
  advertisingCosts: number
  wages: number
  rent: number
  taxes: number
  refunds: number
  totalExpenses: number
  grossProfit: number
  netProfit: number
  closingCash: number
  companyValue: number
  marketShare: number
  customerSatisfaction: number
  brandReputation: number
  perProduct: {
    productId: string
    productName: string
    unitsProduced: number
    unitsSold: number
    unsoldAtYearEnd: number
    revenue: number
    costOfGoodsSold: number
  }[]
  events: BusinessEvent[]
  learningSummary: {
    workedWell: string[]
    causedProblems: string[]
    whyProfitOrLoss: string
    considerNextYear: string[]
  }
}

export type UnsoldInventoryAction = 'keep' | 'discount' | 'dispose' | 'relaunch'

export type LessonQuizQuestion = {
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
  quiz: LessonQuizQuestion[]
}

export type GameState = {
  companyName: string
  founderName: string
  industry: Industry
  preferences: GamePreferences
  /** The year currently being planned/played. Advances by 1 each time "Complete Financial Year" is confirmed. */
  year: number
  cash: number
  /** The single source of truth for every cash change this company has ever made. `cash` must always equal the sum of every entry's `amount`. */
  cashLedger: CashTransaction[]
  products: Product[]
  competitors: Competitor[]
  researchReports: ResearchReport[]
  advertisingCampaigns: AdvertisingCampaign[]
  annualReports: AnnualReport[]
  companyValue: number
  marketShare: number
  customerSatisfaction: number
  brandReputation: number
  /** 1.0 = neutral; nudged up/down by yearly events to represent broader economic conditions. */
  economicIndex: number
  completedLessonIds: string[]
  unlockedFeatures: string[]
  startedAt: string
  lastSavedAt: string
  saveVersion: number
}

export const CURRENT_SAVE_VERSION = 1
