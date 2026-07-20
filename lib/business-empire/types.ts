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

/** The specific shape of difficulty each industry presents, beyond price/cost/competition — gives each industry a genuinely different challenge instead of just different numbers in the same formulas. */
export type IndustryChallengeProfile = {
  /** Extra yearly demand decay for products that go stale without a relaunch (trend-driven industries like Clothing/Cosmetics). */
  trendVolatility: number
  /** 0-1 chance per year a weak-quality product triggers a recall-worthy defect (high for Cars, Food). */
  recallRisk: number
  /** Extra unpredictability in demand beyond normal volatility (audience/hit-driven industries like Entertainment, Video Games). */
  audienceVolatility: number
  /** Fraction of demand lost per year a product goes without a relaunch, once it starts to age (Technology especially). */
  outdatedPenaltyRate: number
  /** Adds to yearly operating costs as a stand-in for industry-specific compliance/regulation overhead (Food health standards, Cars safety standards). */
  regulationIntensity: number
}

export type IndustryRealityProfile = {
  salesCycle: 'impulse' | 'short' | 'considered' | 'enterprise' | 'contract'
  capitalIntensity: 'low' | 'medium' | 'high' | 'extreme'
  marginStructure: string
  supplyChain: string
  regulatoryPressure: string
  realWorldDrivers: string[]
  strategicLevers: { label: string; tradeoff: string }[]
  kpis: { label: string; value: string }[]
}

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
  /** Typical annual market growth, as a percentage — scales marketSize slightly each year. */
  growthPotential: number
  /** 0-1 amplitude of seasonal demand swing across the year (e.g. Fitness peaks in January, Entertainment peaks around holidays). */
  seasonality: number
  /** 0-1 effectiveness multiplier per advertising channel, specific to this industry's typical customers. */
  advertisingEffectiveness: Record<AdvertisingChannel, number>
  commonRisks: string[]
  /** Multiplies research costs — technology/cars need expensive research, food/clothing are cheaper to study. */
  researchCostFactor: number
  /** Whether unsold inventory in this industry can expire (food, some entertainment tie-ins). */
  perishable: boolean
  challengeProfile: IndustryChallengeProfile
}

/** Hardcore is a distinct fourth tier — toughest economic settings, plus it's the only difficulty that requires building starting capital through a real job before a company can be founded, instead of picking a starting-cash amount freely. */
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'hardcore'
export type LearningSupport = 'full' | 'occasional' | 'minimal' | 'sandbox'

/** A fictional degree chosen at the start of Hardcore Mode — determines which jobs are open, and gives a small starting-reputation bonus if it matches the industry the player goes on to found a company in. */
export type Degree = 'business' | 'engineering' | 'arts-design' | 'trade' | 'none'

export type DegreeProfile = {
  id: Degree
  label: string
  description: string
  relevantIndustries: Industry[]
}

/** A fictional entry-level-to-mid job available in Hardcore Mode's pre-game career phase. */
export type HardcoreJob = {
  id: string
  title: string
  employer: string
  requiredDegree: Degree | 'any'
  annualSalary: number
  description: string
}

/** One question in the one-time high-school entrance quiz that determines university placement in Hardcore Mode. */
export type EntranceQuizQuestion = {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
}

export type CareerFinanceBreakdown = {
  grossIncome: number
  incomeTax: number
  housingAndBills: number
  foodAndTransport: number
  studentDebtPayments: number
  emergencyExpenses: number
  totalExpenses: number
  totalDeductions: number
  netSavings: number
  finalSalary: number
}

export type JobInterviewQuestion = {
  id: string
  prompt: string
  options: {
    label: string
    score: number
    note: string
  }[]
}

/** Recorded on GamePreferences only for companies founded from Hardcore Mode's career phase - a factual record of how the founder earned their starting capital, not a mechanic that continues once the company exists. */
export type CareerBackground = {
  /** 0-100 - the founder's score on the one-time high-school entrance quiz, which determined their university placement. */
  universityQuality: number
  degree: Degree
  /** The job offer earned through the interview phase. In Hardcore Mode this is not guaranteed. */
  jobId: string
  interviewScore?: number
  interviewPassed?: boolean
  yearsWorked: number
  totalSavings: number
  careerFinance?: CareerFinanceBreakdown
  /** The founder's age when the company is founded (starting age + university years if applicable + years worked). */
  foundingAge: number
}

export type GamePreferences = {
  companyName: string
  founderName: string
  industry: Industry
  difficulty: Difficulty
  startingCash: number
  learningSupport: LearningSupport
  reducedMotion: boolean
  careerBackground?: CareerBackground
}

export const DIFFICULTY_CASH_RANGE: Record<Difficulty, { min: number; max: number; default: number }> = {
  beginner: { min: 10_000, max: 100_000, default: 25_000 },
  intermediate: { min: 25_000, max: 250_000, default: 75_000 },
  advanced: { min: 50_000, max: 500_000, default: 150_000 },
  // Hardcore doesn't use a slider — starting cash is earned through the career phase — this range only
  // bounds the realistic outcomes of that phase for reference (e.g. tooltip copy).
  hardcore: { min: 0, max: 120_000, default: 15_000 },
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
  /** Multiplies every reputation change — beginner loses reputation slower and builds it faster; advanced swings harder in both directions. */
  reputationVolatility: number
  /** Multiplies research-report noise — beginner gets more accurate reports, advanced gets noisier ones. */
  researchNoiseMultiplier: number
  /** Tightens (>1) or loosens (<1) how strictly customers judge price-for-quality fairness — higher means more demanding customers. */
  demandingCustomers: number
  /** Multiplies how hard loan/investment approval is to earn — beginner easier, advanced harder. */
  loanApprovalDifficulty: number
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  beginner: { costMultiplier: 0.8, demandMultiplier: 1.25, volatility: 0.5, competitorCount: 2, reputationVolatility: 0.6, researchNoiseMultiplier: 0.7, demandingCustomers: 0.8, loanApprovalDifficulty: 0.7 },
  intermediate: { costMultiplier: 1, demandMultiplier: 1, volatility: 1, competitorCount: 3, reputationVolatility: 1, researchNoiseMultiplier: 1, demandingCustomers: 1, loanApprovalDifficulty: 1 },
  advanced: { costMultiplier: 1.2, demandMultiplier: 0.85, volatility: 1.5, competitorCount: 4, reputationVolatility: 1.4, researchNoiseMultiplier: 1.3, demandingCustomers: 1.2, loanApprovalDifficulty: 1.3 },
  hardcore: { costMultiplier: 1.35, demandMultiplier: 0.75, volatility: 1.8, competitorCount: 5, reputationVolatility: 1.6, researchNoiseMultiplier: 1.5, demandingCustomers: 1.35, loanApprovalDifficulty: 1.6 },
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

export type ReviewSentiment = 'positive' | 'neutral' | 'negative'

/** Short, generated customer-review flavor text — one entry represents the tone of that year's buyers, not literally one row per unit sold. */
export type ProductReview = {
  id: string
  year: number
  sentiment: ReviewSentiment
  text: string
  createdAt: string
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
  /** 0-5, derived from satisfaction/reliability/value each year the product has sold. */
  rating: number
  /** Capped rolling list of generated customer-review flavor text, newest last. */
  reviews: ProductReview[]
  /** 0-100 — how consistently the product performs as advertised; low reliability drives complaints and returns. */
  reliability: number
  /** 0-1 fraction of units sold that get returned. */
  returnRate: number
  /** 0-1 fraction of buyers who file a complaint. */
  complaintRate: number
  /** 0-100 — how well-known this product is to potential customers, separate from company-wide reputation. */
  awareness: number
  /** 0-100 — how likely existing buyers are to purchase again rather than switch on a price change. */
  customerLoyalty: number
  /** Year this product was last relaunched (R&D refresh) — used to compute how "outdated" it is. Starts equal to createdYear. */
  lastRelaunchedYear: number
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

export type ClaimsHonesty = 'honest' | 'exaggerated'

export type AdvertisingCampaign = {
  id: string
  year: number
  productId: string
  channel: AdvertisingChannel
  budget: number
  estimatedReach: number
  effectivenessScore: number
  /** Exaggerated claims boost this campaign's reach, but risk a reputation hit at year-end if the product's real quality doesn't back the claim up. */
  claimsHonesty: ClaimsHonesty
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
  /** 0-1 — how aggressively this competitor advertises; random-walks year to year like price and reputation, and factors into how threatening they are. */
  advertisingIntensity: number
}

export type CashTransactionCategory =
  | 'STARTING_CAPITAL'
  | 'RESEARCH_COST'
  | 'PRODUCTION_COST'
  | 'ADVERTISING_COST'
  | 'WAGES'
  | 'RENT'
  | 'OPERATING_COSTS'
  | 'SALES_REVENUE'
  | 'TAX'
  | 'REFUND'
  | 'LOAN'
  | 'LOAN_REPAYMENT'
  | 'INVESTMENT'
  | 'OTHER_EXPENSE'

export type LoanPurpose = 'expansion' | 'working-capital' | 'equipment' | 'recovery'

/** A real amortizing loan — `remainingBalance` (principal + accrued interest still owed) is charged down automatically each year via LOAN_REPAYMENT. */
export type Loan = {
  id: string
  principal: number
  remainingBalance: number
  /** Annual interest rate, e.g. 0.08 = 8%. */
  interestRate: number
  termYears: number
  yearsRemaining: number
  purpose: LoanPurpose
  takenYear: number
}

export type ReputationLevel = 'Disastrous' | 'Poor' | 'Average' | 'Strong' | 'Excellent'

/** Every distinct trigger that can move company reputation — used so a reputation change is always traceable to a specific, named cause, never a bare number. */
export type ReputationReasonCategory =
  | 'COMPANY_FOUNDED'
  | 'RELIABLE_PRODUCT'
  | 'QUALITY_ISSUE'
  | 'COMPLAINT_HANDLED'
  | 'COMPLAINT_IGNORED'
  | 'ON_TIME_DELIVERY'
  | 'PRODUCTION_DELAY'
  | 'FAIR_TREATMENT'
  | 'SUPPLIER_PAYMENT_LATE'
  | 'CRISIS_HANDLED_WELL'
  | 'CRISIS_MISHANDLED'
  | 'HONEST_ADVERTISING'
  | 'MISLEADING_ADVERTISING'
  | 'COMMUNITY_SUPPORT'
  | 'ENVIRONMENTAL_RESPONSIBILITY'
  | 'ENVIRONMENTAL_HARM'
  | 'SATISFACTION_STREAK'
  | 'SATISFACTION_TREND'
  | 'PRODUCT_RECALL'
  | 'SCANDAL'
  | 'REGULATION_BREACH'
  | 'UNFAIR_PRICING'
  | 'PRODUCT_CANCELLED_POORLY'
  | 'REPEATED_STOCKOUT'
  | 'MULTI_YEAR_STABILITY'
  | 'MEDIA_COVERAGE'
  | 'SAVE_MIGRATION'

/** Mirrors `CashTransaction` exactly — the reputation history is an auditable ledger in the same shape as the cash ledger, so every point of movement is explained the same way every dollar is. */
export type ReputationTransaction = {
  id: string
  year: number
  delta: number
  valueBefore: number
  valueAfter: number
  reasonCategory: ReputationReasonCategory
  description: string
  relatedId?: string
  createdAt: string
}

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
  /** Storage + insurance + maintenance, combined into one ledger line but itemized in `factorNotes`. */
  operatingCosts: number
  /** Loan principal + interest repaid this year. */
  loanRepayments: number
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
  /** Plain-language list of every named factor that affected this year's numbers (seasonality, market saturation, economic phase, staff morale, production delays, etc.) — nothing that changed the result is ever hidden. */
  factorNotes: string[]
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

export type EconomicCyclePhase = 'growth' | 'stable' | 'recession'

export type StrategicInitiativeId =
  | 'supply-chain-resilience'
  | 'quality-systems'
  | 'staff-training'
  | 'automation-upgrade'
  | 'market-expansion'
  | 'sustainability-compliance'

export type StrategicInitiative = {
  id: string
  initiativeId: StrategicInitiativeId
  startedYear: number
  yearsRemaining: number
  investment: number
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
  /** The single source of truth for every reputation change this company has ever had. `brandReputation` must always equal `reputationHistory[0].valueBefore` plus the sum of every entry's `delta`. */
  reputationHistory: ReputationTransaction[]
  /** 0-100 — staff morale, driven by wages relative to industry norms and by company reputation; low morale raises effective wage costs (turnover) and slightly lowers output quality. */
  staffMorale: number
  loans: Loan[]
  /** 1.0 = neutral; nudged up/down by yearly events to represent broader economic conditions. */
  economicIndex: number
  /** A slower-moving named cycle layered on top of `economicIndex` so downturns/booms feel like a real named condition, not silent per-event noise. */
  economicCyclePhase: EconomicCyclePhase
  /** Active boardroom decisions with multi-year operating effects. Optional so older saves hydrate safely. */
  strategicInitiatives?: StrategicInitiative[]
  completedLessonIds: string[]
  unlockedFeatures: string[]
  startedAt: string
  lastSavedAt: string
  saveVersion: number
}

export const CURRENT_SAVE_VERSION = 2
