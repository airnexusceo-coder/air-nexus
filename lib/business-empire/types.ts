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

/** The strategic archetype driving a competitor's yearly decisions — replaces pure random-walk behaviour with deliberate, explainable actions. */
export type CompetitorStrategyType =
  | 'price-cutter'
  | 'luxury-leader'
  | 'innovation-leader'
  | 'marketing-giant'
  | 'efficient-operator'
  | 'aggressive-expander'
  | 'ethical-brand'
  | 'corporate-predator'

export type CompetitorStrategyProfile = {
  id: CompetitorStrategyType
  label: string
  description: string
  /** Relative likelihood weights for each action this archetype favours — need not sum to 1. */
  actionWeights: Partial<Record<CompetitorActionType, number>>
  /** -1..1 — negative archetypes trend prices down over time, positive trend prices up. */
  priceBias: number
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
  strategyType: CompetitorStrategyType
  /** 0-1 — how likely this competitor is to take a bold action (product launch, market entry, acquisition) versus holding steady. */
  riskTolerance: number
  /** 0-1 — how often this competitor's action is a quality improvement or product launch. */
  researchAbility: number
  /** 0-1 — how often this competitor's action is an advertising push, and how effective it is. */
  marketingStrength: number
  /** 0-1 — how efficiently this competitor produces, softening their own cost pressure when they cut prices. */
  productionEfficiency: number
}

/** One deliberate move a competitor makes in a given year, driven by their strategy archetype. */
export type CompetitorActionType =
  | 'price-change'
  | 'product-launch'
  | 'quality-improvement'
  | 'ad-campaign'
  | 'market-entry'
  | 'wage-increase'
  | 'hiring'
  | 'acquisition-attempt'
  | 'hold-steady'

/** One entry in the competitor activity feed — a real action, its concrete effect on that competitor, and an estimate of how it moved the player's forecast demand, so nothing is a silent number. */
export type CompetitorActivityEvent = {
  id: string
  year: number
  competitorId: string
  competitorName: string
  strategyType: CompetitorStrategyType
  actionType: CompetitorActionType
  headline: string
  detail: string
  /** Signed — the estimated effect on the player's forecast demand this year, in percentage points. Negative hurts the player, positive helps. */
  demandImpactPercent: number
}

export const COMPETITOR_STRATEGY_PROFILES: Record<CompetitorStrategyType, CompetitorStrategyProfile> = {
  'price-cutter': { id: 'price-cutter', label: 'Price Cutter', description: 'Wins on price, constantly undercutting the market.', actionWeights: { 'price-change': 5, 'ad-campaign': 1, 'quality-improvement': 0.4 }, priceBias: -0.7 },
  'luxury-leader': { id: 'luxury-leader', label: 'Luxury Leader', description: 'Competes on prestige and quality, rarely discounts.', actionWeights: { 'quality-improvement': 3, 'ad-campaign': 1.5, 'price-change': 0.6 }, priceBias: 0.5 },
  'innovation-leader': { id: 'innovation-leader', label: 'Innovation Leader', description: 'Invests heavily in R&D and frequent product launches.', actionWeights: { 'product-launch': 4, 'quality-improvement': 3, 'ad-campaign': 1 }, priceBias: 0.1 },
  'marketing-giant': { id: 'marketing-giant', label: 'Marketing Giant', description: 'Wins through brand awareness and heavy advertising spend.', actionWeights: { 'ad-campaign': 5, 'product-launch': 1.2, 'price-change': 0.8 }, priceBias: 0 },
  'efficient-operator': { id: 'efficient-operator', label: 'Efficient Operator', description: 'Focuses on lean production and steady, sustainable pricing.', actionWeights: { 'quality-improvement': 1.5, 'price-change': 1, 'hiring': 1 }, priceBias: -0.2 },
  'aggressive-expander': { id: 'aggressive-expander', label: 'Aggressive Expander', description: 'Chases market share through rapid growth and new-market entry.', actionWeights: { 'market-entry': 4, 'product-launch': 2, 'acquisition-attempt': 1.2, 'hiring': 1.5 }, priceBias: -0.1 },
  'ethical-brand': { id: 'ethical-brand', label: 'Ethical Brand', description: 'Builds trust through fair wages and responsible practices.', actionWeights: { 'wage-increase': 3, 'hiring': 1.5, 'quality-improvement': 1.2 }, priceBias: 0.1 },
  'corporate-predator': { id: 'corporate-predator', label: 'Corporate Predator', description: 'Plays hardball — undercuts rivals and looks to absorb the weak.', actionWeights: { 'acquisition-attempt': 3, 'price-change': 3, 'market-entry': 1.5 }, priceBias: -0.4 },
}

export type CashTransactionCategory =
  | 'STARTING_CAPITAL'
  | 'RESEARCH_COST'
  | 'PRODUCTION_COST'
  | 'ADVERTISING_COST'
  | 'WAGES'
  | 'RENT'
  | 'OPERATING_COSTS'
  | 'FACILITY_UPKEEP'
  | 'FACILITY_PURCHASE'
  | 'FACILITY_SALE'
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

/** Six independently-tracked reputation fronts — a decision can move more than one at once (e.g. closing a factory can lift investor confidence while damaging employee and government reputation). `brandReputation` remains the single overall score every existing formula reads; these are the explained breakdown of where it comes from. */
export type ReputationCategory = 'customer' | 'employee' | 'investor' | 'government' | 'environmental' | 'supplier'

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
  /** Which of the six reputation fronts this transaction moved — most reasons touch one, a few (founding, a crisis, a recall) touch several. */
  category: ReputationCategory[]
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
  /** Rent, property tax, and maintenance across every facility this company owns or rents. Zero if the company has no facilities. */
  facilityUpkeep: number
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
  /** Every deliberate competitor action taken this year, in the same order the activity feed shows them. */
  competitorActions: CompetitorActivityEvent[]
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

// --- Phase 2: Land, facilities, and regions --------------------------------------

/** Five fictional regions a company can operate in — each with a genuinely different cost/workforce/access profile, so the location decision is a real trade-off. */
export type Region = 'northgate' | 'riverside' | 'harborview' | 'eastvale' | 'summit-ridge'

export type RegionAccessLevel = 'low' | 'medium' | 'high'
export type RegionAbundance = 'limited' | 'moderate' | 'abundant'
export type RegionEducationLevel = 'basic' | 'skilled' | 'highly-skilled'
export type RegionRestriction = 'light' | 'moderate' | 'strict'
export type RegionCapacity = 'limited' | 'moderate' | 'ample'

export type RegionProfile = {
  id: Region
  name: string
  description: string
  /** Multiplies facility purchase price and rent relative to the industry baseline. */
  costOfLivingIndex: number
  /** Multiplies wage expectations for staff based at a facility here. */
  wageLevel: number
  propertyTaxRate: number
  transportAccess: RegionAccessLevel
  customerAccess: RegionAccessLevel
  availableWorkforce: RegionAbundance
  educationLevel: RegionEducationLevel
  utilityCostIndex: number
  environmentalRestrictions: RegionRestriction
  /** 0-1 — yearly chance of a disaster-style disruption event for a facility here. */
  disasterRisk: number
  expansionCapacity: RegionCapacity
  nearbyCompetitors: RegionAbundance
}

export type FacilityType = 'headquarters' | 'factory' | 'warehouse' | 'retail-store' | 'research-centre' | 'distribution-centre' | 'customer-support-centre' | 'data-centre'

export type FacilityUpgradeId = 'production-capacity' | 'automation' | 'storage-expansion' | 'renewable-energy' | 'safety-systems' | 'security' | 'employee-facilities' | 'faster-shipping' | 'quality-control'

export type FacilityOwnership = 'owned' | 'rented'

export type Facility = {
  id: string
  type: FacilityType
  region: Region
  ownership: FacilityOwnership
  /** For an owned facility: its current asset value, which drifts with regional property trends each year. Zero for a rented facility. */
  currentValue: number
  /** For a rented facility: the current annual rent, which can rise on lease renewal. Zero for an owned facility. */
  annualRent: number
  /** Only set for rented facilities — null means the facility is owned outright. */
  leaseYearsRemaining: number | null
  upgrades: FacilityUpgradeId[]
  builtYear: number
  underConstruction: boolean
  constructionYearsRemaining: number
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
  /** The six-front breakdown of reputation — moved by the same transactions as `brandReputation`, via the `category` tag on each `ReputationTransaction`. */
  reputationCategories: Record<ReputationCategory, number>
  /** 0-100 — staff morale, driven by wages relative to industry norms and by company reputation; low morale raises effective wage costs (turnover) and slightly lowers output quality. */
  staffMorale: number
  loans: Loan[]
  /** Every land/property the company owns or rents. An empty array is the normal starting state — facilities are optional. */
  facilities: Facility[]
  /** Regions a competitor has purchased land in, making them unavailable for the player to build new facilities in (existing player facilities there are unaffected). */
  claimedRegions: Region[]
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

export const CURRENT_SAVE_VERSION = 4
