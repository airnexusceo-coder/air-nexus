import { getIndustryProfile } from '@/lib/business-empire/industries'
import { getAdvertisingChannel } from '@/lib/business-empire/advertising'
import { computeResearchCost, generateResearchReport } from '@/lib/business-empire/research'
import {
  FACILITY_TYPE_INFO,
  FACILITY_UPGRADE_INFO,
  REGION_ORDER,
  REGION_PROFILES,
  computeFacilityAnnualRent,
  computeFacilityProductionDiscount,
  computeFacilityPurchasePrice,
  computeFacilityUpkeep,
  computePropertyValueDrift,
  computeRegionalWageMultiplier,
} from '@/lib/business-empire/land'
import {
  COMPLIANCE_CATEGORY_INFO,
  COMPLIANCE_CATEGORY_ORDER,
  COMPLIANCE_STAFF_ROLE_ORDER,
  LAW_CATEGORY_TO_COMPLIANCE,
  computeComplianceRatingTarget,
  computeComplianceStaffAnnualSalary,
  computeInspectionProbability,
  driftComplianceRating,
  generateLawProposal,
  resolveLawDecisions,
} from '@/lib/business-empire/government'
import {
  advanceCaseStage,
  applyOfferResponseToLegalRisk,
  classifyCaseSeverity,
  computeCaseFinancialImpact,
  computeCaseReputationImpact,
  computeInvestigationTriggerChance,
  computeLegalCaseActionCost,
  computeOfferBenefit,
  generateQuestionableOffer,
  resolveCaseOutcome,
} from '@/lib/business-empire/legal'
import {
  DEGREE_INDUSTRY_REPUTATION_BONUS,
  getDegreeProfile,
  getHardcoreJob,
  isDegreeRelevantToIndustry,
} from '@/lib/business-empire/hardcore-career'
import {
  appendReputationTransaction,
  appendTransaction,
  checkForProductRecall,
  computeAdvertisingEffectivenessMultiplier,
  computeAwarenessGrowth,
  computeCompanySatisfaction,
  computeCompanyValue,
  computeCostPerUnit,
  computeCustomerLoyalty,
  computeDemand,
  computeLoanApprovalOdds,
  computeLoanInterestRate,
  computeMarketSaturation,
  computeOperatingCosts,
  computeProductAgePenalty,
  computeProductComplaintRate,
  computeProductReliability,
  computeProductReturnRate,
  computeProductRating,
  computeProductSatisfaction,
  computeProductionDelayChance,
  computeQualityScore,
  computeRent,
  computeSatisfactionReputationPull,
  computeSeasonalMultiplier,
  computeStaffMorale,
  computeWages,
  createId,
  estimateAdvertisingReach,
  generateProductReview,
  generateYearlyEvents,
  getInitialCompetitors,
  runCompetitorActionsForYear,
  sumAdvertisingReachForProduct,
  sumLedgerCategoryForYear,
  verifyLedgerIntegrity,
} from '@/lib/business-empire/simulation'
import {
  CURRENT_SAVE_VERSION,
  DIFFICULTY_PROFILES,
  type AdvertisingChannel,
  type AnnualReport,
  type CashTransactionCategory,
  type ClaimsHonesty,
  type ComplianceCategory,
  type ComplianceStaffRole,
  type Facility,
  type FacilityOwnership,
  type FacilityType,
  type FacilityUpgradeId,
  type Law,
  type GamePreferences,
  type GameState,
  type LegalCase,
  type LegalCaseAction,
  type Loan,
  type LoanPurpose,
  type QuestionableOffer,
  type PackagingQuality,
  type Product,
  type ProductQuality,
  type ProductionMethod,
  type Region,
  type ReputationReasonCategory,
  type ResearchLevel,
  type StrategicInitiative,
  type StrategicInitiativeId,
  type UnsoldInventoryAction,
} from '@/lib/business-empire/types'

const PERISHABLE_EXPIRY_RATE = 0.6
const TAX_RATE = 0.2

type StrategicInitiativeEffect = {
  productionCostMultiplier?: number
  demandMultiplier?: number
  delayMultiplier?: number
  recallRiskMultiplier?: number
  reliabilityBonus?: number
  moraleBonus?: number
  satisfactionBonus?: number
}

export type StrategicInitiativeOption = {
  id: StrategicInitiativeId
  label: string
  shortLabel: string
  description: string
  realWorldReason: string
  durationYears: number
  baseCost: number
  companyValueRate: number
  startReputationDelta: number
  effects: StrategicInitiativeEffect
  effectsSummary: string[]
}

export const STRATEGIC_INITIATIVES: StrategicInitiativeOption[] = [
  { id: 'supply-chain-resilience', label: 'Diversify suppliers', shortLabel: 'Supplier resilience', description: 'Build backup suppliers, better purchasing terms, and more realistic delivery buffers.', realWorldReason: 'Real companies reduce supplier dependency so one delayed component or ingredient does not stop the whole business.', durationYears: 2, baseCost: 1600, companyValueRate: 0.035, startReputationDelta: 1, effects: { delayMultiplier: 0.55, demandMultiplier: 1.02, productionCostMultiplier: 1.01 }, effectsSummary: ['Fewer production delays', 'Slightly better availability', 'Small coordination cost'] },
  { id: 'quality-systems', label: 'Install quality control', shortLabel: 'Quality systems', description: 'Add testing, inspection gates, and customer issue tracking before defects become public.', realWorldReason: 'In food, cars, cosmetics, technology, and hardware, quality systems are cheaper than recalls after trust is lost.', durationYears: 3, baseCost: 2200, companyValueRate: 0.045, startReputationDelta: 2, effects: { reliabilityBonus: 8, recallRiskMultiplier: 0.55, satisfactionBonus: 2, productionCostMultiplier: 1.015 }, effectsSummary: ['Higher reliability', 'Lower recall risk', 'Small inspection cost'] },
  { id: 'staff-training', label: 'Train the workforce', shortLabel: 'Staff training', description: 'Improve operations, service, and frontline decision-making across the company.', realWorldReason: 'Better-trained staff reduce service mistakes, improve customer experience, and make scaling less chaotic.', durationYears: 2, baseCost: 1400, companyValueRate: 0.03, startReputationDelta: 1, effects: { moraleBonus: 8, satisfactionBonus: 3, demandMultiplier: 1.025, productionCostMultiplier: 1.01 }, effectsSummary: ['Higher morale', 'Better satisfaction', 'Training time costs cash'] },
  { id: 'automation-upgrade', label: 'Automate operations', shortLabel: 'Automation', description: 'Upgrade tools, workflow software, fulfilment, or factory equipment to lower future unit costs.', realWorldReason: 'Automation usually requires capital first, then improves repeatability and cost structure if demand exists.', durationYears: 4, baseCost: 3500, companyValueRate: 0.07, startReputationDelta: 0, effects: { productionCostMultiplier: 0.92, reliabilityBonus: 3, moraleBonus: -2 }, effectsSummary: ['Lower future production costs', 'More consistent output', 'Morale risk during change'] },
  { id: 'market-expansion', label: 'Open a new channel', shortLabel: 'New channel', description: 'Add wholesale, direct-to-consumer, partnerships, delivery, or sales reps depending on the industry.', realWorldReason: 'Growing companies often reach more customers by adding channels, but every channel adds overhead and complexity.', durationYears: 2, baseCost: 2400, companyValueRate: 0.055, startReputationDelta: 1, effects: { demandMultiplier: 1.1, delayMultiplier: 1.08, satisfactionBonus: -1, productionCostMultiplier: 1.02 }, effectsSummary: ['Bigger addressable demand', 'More operational complexity', 'Slight service strain'] },
  { id: 'sustainability-compliance', label: 'Fund sustainability compliance', shortLabel: 'Sustainability', description: 'Audit suppliers, reduce waste, improve compliance, and make environmental claims safer.', realWorldReason: 'Sustainability can improve trust, but only when backed by real operations instead of marketing claims.', durationYears: 3, baseCost: 1800, companyValueRate: 0.04, startReputationDelta: 3, effects: { demandMultiplier: 1.035, recallRiskMultiplier: 0.9, productionCostMultiplier: 1.02 }, effectsSummary: ['Better trust', 'Cleaner compliance', 'Higher responsible sourcing cost'] },
]

type StrategicInitiativeEffects = Required<StrategicInitiativeEffect>

const NEUTRAL_STRATEGIC_EFFECTS: StrategicInitiativeEffects = { productionCostMultiplier: 1, demandMultiplier: 1, delayMultiplier: 1, recallRiskMultiplier: 1, reliabilityBonus: 0, moraleBonus: 0, satisfactionBonus: 0 }

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getStrategicInitiativeOption(initiativeId: StrategicInitiativeId): StrategicInitiativeOption | undefined {
  return STRATEGIC_INITIATIVES.find((option) => option.id === initiativeId)
}

export function getActiveStrategicInitiatives(state: GameState): StrategicInitiative[] {
  return (state.strategicInitiatives ?? []).filter((initiative) => initiative.yearsRemaining > 0)
}

export function computeStrategicInitiativeCost(state: GameState, initiativeId: StrategicInitiativeId): number {
  const option = getStrategicInitiativeOption(initiativeId)
  if (!option) return 0
  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const scale = Math.max(25000, state.companyValue, state.cash)
  const industryLoad = 1 + industry.challengeProfile.regulationIntensity * 0.22 + Math.max(0, industry.productionCostFactor - 1) * 0.08
  return Math.max(500, Math.round(((option.baseCost + scale * option.companyValueRate) * difficulty.costMultiplier * industryLoad) / 100) * 100)
}

export function getStrategicInitiativeEffects(state: GameState): StrategicInitiativeEffects {
  return getActiveStrategicInitiatives(state).reduce<StrategicInitiativeEffects>((effects, initiative) => {
    const option = getStrategicInitiativeOption(initiative.initiativeId)
    if (!option) return effects
    return {
      productionCostMultiplier: effects.productionCostMultiplier * (option.effects.productionCostMultiplier ?? 1),
      demandMultiplier: effects.demandMultiplier * (option.effects.demandMultiplier ?? 1),
      delayMultiplier: effects.delayMultiplier * (option.effects.delayMultiplier ?? 1),
      recallRiskMultiplier: effects.recallRiskMultiplier * (option.effects.recallRiskMultiplier ?? 1),
      reliabilityBonus: effects.reliabilityBonus + (option.effects.reliabilityBonus ?? 0),
      moraleBonus: effects.moraleBonus + (option.effects.moraleBonus ?? 0),
      satisfactionBonus: effects.satisfactionBonus + (option.effects.satisfactionBonus ?? 0),
    }
  }, { ...NEUTRAL_STRATEGIC_EFFECTS })
}

export function launchStrategicInitiative(state: GameState, initiativeId: StrategicInitiativeId): { state: GameState; error?: string } {
  const option = getStrategicInitiativeOption(initiativeId)
  if (!option) return { state, error: 'Unknown boardroom decision.' }
  const active = getActiveStrategicInitiatives(state)
  if (active.some((initiative) => initiative.initiativeId === initiativeId)) return { state, error: option.label + ' is already active.' }
  if (active.length >= 3) return { state, error: 'You can run up to three major boardroom decisions at once. Let one finish before adding another.' }
  const investment = computeStrategicInitiativeCost(state, initiativeId)
  if (investment > state.cash) return { state, error: option.label + ' needs ' + Math.round(investment).toLocaleString() + ', more than your available cash.' }
  const initiative: StrategicInitiative = { id: createId('initiative'), initiativeId, startedYear: state.year, yearsRemaining: option.durationYears, investment }
  let next: GameState = { ...state, strategicInitiatives: [...(state.strategicInitiatives ?? []), initiative] }
  next = appendTransaction(next, { category: 'OTHER_EXPENSE', amount: -investment, description: 'Boardroom decision: ' + option.label, relatedId: initiative.id })
  if (option.startReputationDelta !== 0) {
    next = appendReputationTransaction(next, { delta: option.startReputationDelta, reasonCategory: option.id === 'sustainability-compliance' ? 'ENVIRONMENTAL_RESPONSIBILITY' : 'FAIR_TREATMENT', description: option.label + ' signalled stronger management discipline: ' + option.realWorldReason, relatedId: initiative.id })
  }
  if (option.effects.moraleBonus) next = { ...next, staffMorale: clampScore(next.staffMorale + option.effects.moraleBonus * 0.5) }
  return { state: next }
}

export function createInitialState(preferences: GamePreferences, rng: () => number = Math.random): GameState {
  const startedAt = new Date().toISOString()
  const difficulty = DIFFICULTY_PROFILES[preferences.difficulty]

  // New companies start with an average-to-below-average reputation — nobody trusts a brand-new
  // business yet. Beginner difficulty nudges the starting point up slightly (a gentler on-ramp),
  // advanced/hardcore nudge it down, but it never leaves the 30-50 band regardless.
  const difficultyNudge = preferences.difficulty === 'beginner' ? 2 : preferences.difficulty === 'advanced' || preferences.difficulty === 'hardcore' ? -2 : 0
  const startingReputation = Math.max(30, Math.min(50, Math.round(35 + rng() * 10) + difficultyNudge))

  // Hardcore Mode never trusts a UI-picked starting cash. The setup screen records the exact
  // post-tax, post-expense savings from the life phase, and that becomes company capital.
  const career = preferences.difficulty === 'hardcore' ? preferences.careerBackground : undefined
  const careerJob = career ? getHardcoreJob(career.jobId) : undefined
  const startingCash = career && careerJob ? Math.max(0, Math.round(career.totalSavings)) : preferences.startingCash

  const base: GameState = {
    companyName: preferences.companyName,
    founderName: preferences.founderName,
    industry: preferences.industry,
    preferences,
    year: 1,
    cash: 0,
    cashLedger: [],
    products: [],
    competitors: getInitialCompetitors(preferences.industry, difficulty, rng),
    researchReports: [],
    advertisingCampaigns: [],
    annualReports: [],
    companyValue: startingCash,
    marketShare: 0,
    customerSatisfaction: 70,
    brandReputation: 0,
    reputationHistory: [],
    reputationCategories: { customer: 0, employee: 0, investor: 0, government: 0, environmental: 0, supplier: 0 },
    staffMorale: 70,
    loans: [],
    facilities: [],
    claimedRegions: [],
    laws: [],
    complianceRatings: { employment: 30, 'product-safety': 30, 'finance-tax': 30, environmental: 30, privacy: 30, advertising: 30, 'construction-property': 30 },
    complianceStaff: { 'compliance-officer': 0, accountant: 0, lawyer: 0, 'safety-inspector': 0, 'environmental-specialist': 0 },
    unresolvedViolations: 0,
    legalRisk: { suspicion: 0, availableEvidence: 0, civilLiability: 0, criminalExposure: 0, publicAwareness: 0, employeeKnowledge: 0, previousViolations: 0 },
    questionableOffers: [],
    legalCases: [],
    gameOverReason: null,
    economicIndex: 1,
    economicCyclePhase: 'stable',
    strategicInitiatives: [],
    completedLessonIds: [],
    unlockedFeatures: [],
    startedAt,
    lastSavedAt: startedAt,
    saveVersion: CURRENT_SAVE_VERSION,
  }
  const capitalDescription = career
    ? preferences.companyName + ' founded - starting capital saved after ' + career.yearsWorked + ' year(s) as a ' + (careerJob?.title ?? 'worker') + ', after income tax and personal expenses'
    : preferences.companyName + ' founded - starting capital'
  const withCapital = appendTransaction(base, { category: 'STARTING_CAPITAL', amount: startingCash, description: capitalDescription })
  let founded = appendReputationTransaction(withCapital, {
    delta: startingReputation,
    reasonCategory: 'COMPANY_FOUNDED',
    description: `${preferences.companyName} founded with a starting reputation of ${startingReputation}/100 — new companies begin without an established track record.`,
  })

  if (career && isDegreeRelevantToIndustry(career.degree, preferences.industry)) {
    const degreeLabel = getDegreeProfile(career.degree).label
    founded = appendReputationTransaction(founded, {
      delta: DEGREE_INDUSTRY_REPUTATION_BONUS,
      reasonCategory: 'COMPANY_FOUNDED',
      description: `The founder's ${degreeLabel} is directly relevant to ${preferences.industry} — customers and partners take the new company slightly more seriously as a result.`,
    })
  }

  return founded
}

export type ProductCreationInput = {
  name: string
  targetGroupId: string
  quality: ProductQuality
  features: string[]
  rndBudget: number
  unitsToManufacture: number
  productionMethod: ProductionMethod
  packagingQuality: PackagingQuality
  price: number
}

export function estimateCostPerUnit(state: GameState, draft: Pick<ProductCreationInput, 'quality' | 'productionMethod' | 'packagingQuality' | 'features' | 'rndBudget'>, units: number): number {
  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  return computeCostPerUnit(industry, draft, units, difficulty) * getStrategicInitiativeEffects(state).productionCostMultiplier * computeFacilityProductionDiscount(state.facilities)
}

/**
 * A cash-aware starting suggestion for a brand-new product's production run.
 * A single flat default (e.g. always 500 units) is wrong in both directions:
 * wildly unaffordable for capital-intensive industries like Cars, and a
 * trivially small fraction of cash for cheap ones like Food & Beverages. This
 * spends roughly a third of current cash on the sample configuration instead,
 * so the number a new player sees pre-filled is realistic for the industry
 * and difficulty they actually picked.
 */
export function suggestStarterUnits(state: GameState, draft: Pick<ProductCreationInput, 'quality' | 'productionMethod' | 'packagingQuality' | 'features' | 'rndBudget'>): number {
  const costPerUnit = estimateCostPerUnit(state, draft, 100)
  if (costPerUnit <= 0) return 0
  const budget = state.cash * 0.35
  const raw = Math.floor(budget / costPerUnit)
  const rounded = raw >= 100 ? Math.round(raw / 50) * 50 : raw >= 10 ? Math.round(raw / 5) * 5 : raw
  return Math.max(0, Math.min(5000, rounded))
}

export function createProduct(state: GameState, input: ProductCreationInput): { state: GameState; error?: string; product?: Product } {
  if (!input.name.trim()) return { state, error: 'Give the product a name.' }
  if (input.unitsToManufacture <= 0 || !Number.isFinite(input.unitsToManufacture)) return { state, error: 'Enter at least 1 unit to manufacture — a product needs some stock to actually sell.' }
  if (input.price <= 0) return { state, error: 'Set a selling price greater than zero.' }

  const industry = getIndustryProfile(state.industry)
  const costPerUnit = estimateCostPerUnit(state, input, input.unitsToManufacture)
  const productionCost = costPerUnit * input.unitsToManufacture
  const totalUpfrontCost = productionCost + input.rndBudget
  if (totalUpfrontCost > state.cash) return { state, error: `This would cost ${Math.round(totalUpfrontCost).toLocaleString()} up front (production + R&D), more than your available cash.` }

  // A brand-new product's launch success is tied to the company's reputation at the moment of
  // launch — a well-regarded company gets more initial awareness (a stronger launch), a weak
  // reputation means the product starts more obscure and has to earn awareness the slow way.
  const launchAwareness = Math.max(5, Math.min(60, Math.round(20 + (state.brandReputation - 50) * 0.4)))

  const product: Product = {
    id: createId('product'),
    name: input.name.trim(),
    targetGroupId: input.targetGroupId,
    quality: input.quality,
    features: input.features,
    rndBudget: input.rndBudget,
    unitsManufactured: input.unitsToManufacture,
    productionMethod: input.productionMethod,
    packagingQuality: input.packagingQuality,
    price: input.price,
    costPerUnit,
    inventory: 0,
    createdYear: state.year,
    discontinued: false,
    history: [],
    lifetimeUnitsSold: 0,
    lifetimeRevenue: 0,
    satisfaction: computeQualityScore(industry, input),
    rating: 0,
    reviews: [],
    reliability: computeQualityScore(industry, input),
    returnRate: 0,
    complaintRate: 0,
    awareness: launchAwareness,
    customerLoyalty: 0,
    lastRelaunchedYear: state.year,
  }

  let next: GameState = { ...state, products: [...state.products, product] }
  if (input.rndBudget > 0) {
    next = appendTransaction(next, { category: 'RESEARCH_COST', amount: -input.rndBudget, description: `Research & development for ${product.name}`, relatedId: product.id })
  }
  if (input.unitsToManufacture > 0) {
    next = appendTransaction(next, { category: 'PRODUCTION_COST', amount: -productionCost, description: `Manufactured ${input.unitsToManufacture} units of ${product.name}`, relatedId: product.id })
  }
  return { state: next, product }
}

export function manufactureMoreUnits(state: GameState, productId: string, additionalUnits: number): { state: GameState; error?: string } {
  const product = state.products.find((p) => p.id === productId)
  if (!product) return { state, error: 'Unknown product.' }
  if (product.discontinued) return { state, error: 'This product has been discontinued.' }
  if (!Number.isInteger(additionalUnits) || additionalUnits <= 0) return { state, error: 'Enter a whole number of units greater than zero.' }

  const costPerUnit = estimateCostPerUnit(state, product, product.unitsManufactured + additionalUnits)
  const cost = costPerUnit * additionalUnits
  if (cost > state.cash) return { state, error: `Manufacturing ${additionalUnits} more units would cost ${Math.round(cost).toLocaleString()}, more than your available cash.` }

  const updated: Product = { ...product, unitsManufactured: product.unitsManufactured + additionalUnits, costPerUnit }
  const next: GameState = { ...state, products: state.products.map((p) => (p.id === productId ? updated : p)) }
  return { state: appendTransaction(next, { category: 'PRODUCTION_COST', amount: -cost, description: `Manufactured ${additionalUnits} more units of ${product.name}`, relatedId: productId }) }
}

export function updateProductPrice(state: GameState, productId: string, price: number): { state: GameState; error?: string } {
  if (price <= 0) return { state, error: 'Set a selling price greater than zero.' }
  return { state: { ...state, products: state.products.map((p) => (p.id === productId ? { ...p, price } : p)) } }
}

export function discontinueProduct(state: GameState, productId: string): GameState {
  return { ...state, products: state.products.map((p) => (p.id === productId ? { ...p, discontinued: true } : p)) }
}

export function purchaseResearch(state: GameState, level: ResearchLevel, targetGroupId: string): { state: GameState; error?: string } {
  const industry = getIndustryProfile(state.industry)
  const cost = computeResearchCost(industry, level)
  if (cost > state.cash) return { state, error: `This report costs ${cost.toLocaleString()}, more than your available cash.` }

  const report = generateResearchReport(industry, level, targetGroupId, state.competitors, state.year)
  const next: GameState = { ...state, researchReports: [...state.researchReports, report] }
  return { state: appendTransaction(next, { category: 'RESEARCH_COST', amount: -cost, description: `${level[0].toUpperCase()}${level.slice(1)} market research`, relatedId: report.id }) }
}

export function launchAdvertisingCampaign(state: GameState, productId: string, channel: AdvertisingChannel, budget: number, claimsHonesty: ClaimsHonesty = 'honest'): { state: GameState; error?: string } {
  const product = state.products.find((p) => p.id === productId)
  if (!product) return { state, error: 'Unknown product.' }
  const channelProfile = getAdvertisingChannel(channel)
  if (!channelProfile) return { state, error: 'Unknown advertising channel.' }
  if (channel === 'none') return { state, error: 'Choose an actual channel to launch a campaign, or simply skip advertising this year.' }
  if (budget < channelProfile.minBudget) return { state, error: `${channelProfile.label} needs a budget of at least ${channelProfile.minBudget.toLocaleString()}.` }
  if (budget > state.cash) return { state, error: 'Not enough cash for this advertising budget.' }

  const industry = getIndustryProfile(state.industry)
  const effectiveness = industry.advertisingEffectiveness[channel]
  const reputationMultiplier = computeAdvertisingEffectivenessMultiplier(state.brandReputation)
  // Exaggerated claims reach further short-term, but the claim is checked against the product's real
  // quality at year-end — if it doesn't hold up, that's a MISLEADING_ADVERTISING reputation hit.
  const claimsBoost = claimsHonesty === 'exaggerated' ? 1.2 : 1
  const estimatedReach = estimateAdvertisingReach(channel, budget, channelProfile.reachPerDollar, effectiveness, reputationMultiplier * claimsBoost)

  const campaign = {
    id: createId('campaign'),
    year: state.year,
    productId,
    channel,
    budget,
    estimatedReach,
    effectivenessScore: effectiveness,
    claimsHonesty,
    createdAt: new Date().toISOString(),
  }
  const next: GameState = { ...state, advertisingCampaigns: [...state.advertisingCampaigns, campaign] }
  return { state: appendTransaction(next, { category: 'ADVERTISING_COST', amount: -budget, description: `${channelProfile.label} campaign for ${product.name}${claimsHonesty === 'exaggerated' ? ' (exaggerated claims)' : ''}`, relatedId: campaign.id }) }
}

export function applyUnsoldInventoryAction(state: GameState, productId: string, action: UnsoldInventoryAction): { state: GameState; error?: string } {
  const product = state.products.find((p) => p.id === productId)
  if (!product) return { state, error: 'Unknown product.' }
  if (product.inventory <= 0) return { state, error: 'This product has no unsold inventory right now.' }

  if (action === 'keep') return { state }

  if (action === 'discount') {
    const discountPrice = product.price * 0.5
    const revenue = product.inventory * discountPrice
    const unitsCleared = product.inventory
    const next: GameState = { ...state, products: state.products.map((p) => (p.id === productId ? { ...p, inventory: 0 } : p)) }
    return { state: appendTransaction(next, { category: 'SALES_REVENUE', amount: revenue, description: `Clearance sale: ${unitsCleared} units of ${product.name} at 50% off`, relatedId: productId }) }
  }

  if (action === 'dispose') {
    const disposalCost = product.inventory * product.costPerUnit * 0.1
    const unitsDisposed = product.inventory
    const next: GameState = { ...state, products: state.products.map((p) => (p.id === productId ? { ...p, inventory: 0 } : p)) }
    return { state: appendTransaction(next, { category: 'OTHER_EXPENSE', amount: -disposalCost, description: `Disposed of ${unitsDisposed} unsold units of ${product.name}`, relatedId: productId }) }
  }

  // relaunch: a modest refresh cost, and a satisfaction bump representing renewed appeal — inventory stays on hand to sell.
  // Also resets the "outdated" clock, since a relaunch is exactly what removes the age penalty.
  const refreshCost = product.inventory * product.costPerUnit * 0.2
  if (refreshCost > state.cash) return { state, error: `Relaunching would cost ${Math.round(refreshCost).toLocaleString()}, more than your available cash.` }
  const next: GameState = { ...state, products: state.products.map((p) => (p.id === productId ? { ...p, satisfaction: Math.min(100, p.satisfaction + 10), lastRelaunchedYear: state.year } : p)) }
  return { state: appendTransaction(next, { category: 'OTHER_EXPENSE', amount: -refreshCost, description: `Relaunch refresh for ${product.name}`, relatedId: productId }) }
}

/** A dedicated relaunch action available even without unsold inventory — resets the "outdated" clock for a product that's simply been on the market a while, at the cost of a fresh R&D-style investment. */
export function relaunchProduct(state: GameState, productId: string, budget: number): { state: GameState; error?: string } {
  const product = state.products.find((p) => p.id === productId)
  if (!product) return { state, error: 'Unknown product.' }
  if (product.discontinued) return { state, error: 'This product has been discontinued.' }
  if (budget <= 0) return { state, error: 'Enter a relaunch budget greater than zero.' }
  if (budget > state.cash) return { state, error: `Relaunching would cost ${Math.round(budget).toLocaleString()}, more than your available cash.` }

  const next: GameState = {
    ...state,
    products: state.products.map((p) => (p.id === productId ? { ...p, lastRelaunchedYear: state.year, satisfaction: Math.min(100, p.satisfaction + 5) } : p)),
  }
  return { state: appendTransaction(next, { category: 'RESEARCH_COST', amount: -budget, description: `Relaunch investment for ${product.name}`, relatedId: productId }) }
}

export function completeLesson(state: GameState, lessonId: string): GameState {
  if (state.completedLessonIds.includes(lessonId)) return state
  return { ...state, completedLessonIds: [...state.completedLessonIds, lessonId] }
}

export function updatePreferences(state: GameState, partial: Partial<Pick<GamePreferences, 'learningSupport' | 'reducedMotion'>>): GameState {
  return { ...state, preferences: { ...state.preferences, ...partial } }
}

// --- Funding: loans + community/environmental investment ------------------------

export type LoanApplicationPreview = { odds: number; factors: string[]; interestRate: number }

/** A read-only preview of a loan application's odds and rate, before the player commits to applying. */
export function previewLoanApplication(state: GameState, amount: number): LoanApplicationPreview {
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const existingLoanBalance = state.loans.reduce((sum, l) => sum + l.remainingBalance, 0)
  const { odds, factors } = computeLoanApprovalOdds(state.brandReputation, existingLoanBalance, state.companyValue, amount, difficulty)
  const interestRate = computeLoanInterestRate(state.brandReputation, difficulty)
  return { odds, factors, interestRate }
}

/** Applying for a loan is a real probability roll, not a guarantee — approval odds and the reasons behind them are shown to the player before they commit. A rejected application costs nothing. */
export function applyForLoan(state: GameState, amount: number, purpose: LoanPurpose, rng: () => number = Math.random): { state: GameState; error?: string; approved: boolean } {
  if (amount <= 0) return { state, error: 'Enter a loan amount greater than zero.', approved: false }
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const existingLoanBalance = state.loans.reduce((sum, l) => sum + l.remainingBalance, 0)
  const { odds } = computeLoanApprovalOdds(state.brandReputation, existingLoanBalance, state.companyValue, amount, difficulty)

  if (rng() >= odds) {
    return { state, error: 'The loan application was declined. Improving reputation or reducing existing debt improves future odds.', approved: false }
  }

  const interestRate = computeLoanInterestRate(state.brandReputation, difficulty)
  const termYears = 5
  const loan: Loan = { id: createId('loan'), principal: amount, remainingBalance: amount, interestRate, termYears, yearsRemaining: termYears, purpose, takenYear: state.year }
  const next: GameState = { ...state, loans: [...state.loans, loan] }
  return {
    state: appendTransaction(next, { category: 'LOAN', amount, description: `Business loan approved (${Math.round(interestRate * 1000) / 10}% annual interest, ${termYears}-year term)`, relatedId: loan.id }),
    approved: true,
  }
}

/** A single bounded lever covering both "supports community projects" and "produces environmentally responsible products" — a deliberate spend that earns reputation, not a random event. */
export function investInCommunityProject(state: GameState, budget: number): { state: GameState; error?: string } {
  if (budget <= 0) return { state, error: 'Enter a budget greater than zero.' }
  if (budget > state.cash) return { state, error: `This would cost ${Math.round(budget).toLocaleString()}, more than your available cash.` }
  const reputationGain = Math.min(6, Math.round(budget / 2000))
  const next = appendTransaction(state, { category: 'OTHER_EXPENSE', amount: -budget, description: 'Community and environmental initiative funding' })
  return {
    state: appendReputationTransaction(next, {
      delta: reputationGain,
      reasonCategory: 'COMMUNITY_SUPPORT',
      description: `Invested ${Math.round(budget).toLocaleString()} in a community and environmental initiative, earning goodwill with customers.`,
    }),
  }
}

const INTERNATIONAL_EXPANSION_FEATURE_ID = 'international-expansion'
const INTERNATIONAL_EXPANSION_REPUTATION_THRESHOLD = 80
const INTERNATIONAL_EXPANSION_COMPANY_VALUE_THRESHOLD = 150_000

export function isInternationalExpansionEligible(state: GameState): boolean {
  return state.brandReputation >= INTERNATIONAL_EXPANSION_REPUTATION_THRESHOLD && state.companyValue >= INTERNATIONAL_EXPANSION_COMPANY_VALUE_THRESHOLD
}

/** A one-time unlock, reachable only at Excellent reputation plus a real company-value bar — represents earning the trust and scale needed to sell beyond the home market, without inventing a full country-by-country subsystem. */
export function unlockInternationalExpansion(state: GameState, investment: number): { state: GameState; error?: string } {
  if (state.unlockedFeatures.includes(INTERNATIONAL_EXPANSION_FEATURE_ID)) return { state, error: 'International expansion has already been unlocked.' }
  if (!isInternationalExpansionEligible(state)) {
    return { state, error: `International expansion needs at least ${INTERNATIONAL_EXPANSION_REPUTATION_THRESHOLD} reputation and a company value of ${INTERNATIONAL_EXPANSION_COMPANY_VALUE_THRESHOLD.toLocaleString()}.` }
  }
  if (investment <= 0) return { state, error: 'Enter an investment amount greater than zero.' }
  if (investment > state.cash) return { state, error: `This would cost ${Math.round(investment).toLocaleString()}, more than your available cash.` }

  const next: GameState = { ...state, unlockedFeatures: [...state.unlockedFeatures, INTERNATIONAL_EXPANSION_FEATURE_ID] }
  return { state: appendTransaction(next, { category: 'OTHER_EXPENSE', amount: -investment, description: 'Investment to launch international expansion' }) }
}

// --- Land and facilities ---------------------------------------------------------

export type RegionAvailability = { region: Region; claimedByCompetitor: boolean }

/** All five regions, flagged with whether a competitor has already claimed them — claimed regions can't host new player facilities, but existing player facilities there are never affected. */
export function getRegionAvailability(state: GameState): RegionAvailability[] {
  return REGION_ORDER.map((region) => ({ region, claimedByCompetitor: state.claimedRegions.includes(region) }))
}

export type FacilityCostPreview = { purchasePrice: number; annualRent: number }

export function previewFacilityCost(state: GameState, type: FacilityType, region: Region): FacilityCostPreview {
  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  return {
    purchasePrice: computeFacilityPurchasePrice(type, region, industry, difficulty),
    annualRent: computeFacilityAnnualRent(type, region, industry, difficulty),
  }
}

/** Buying pays the full purchase price up front and creates an owned asset; renting pays nothing up front but commits to a 5-year lease at the current annual rent, charged yearly through facility upkeep. */
export function buildFacility(state: GameState, type: FacilityType, region: Region, ownership: FacilityOwnership): { state: GameState; error?: string; facility?: Facility } {
  if (state.claimedRegions.includes(region)) return { state, error: `${REGION_PROFILES[region].name} has already been claimed by a competitor — choose another region.` }
  const { purchasePrice, annualRent } = previewFacilityCost(state, type, region)
  if (ownership === 'owned' && purchasePrice > state.cash) {
    return { state, error: `Buying this facility would cost ${Math.round(purchasePrice).toLocaleString()}, more than your available cash.` }
  }

  const info = FACILITY_TYPE_INFO[type]
  const facility: Facility = {
    id: createId('facility'),
    type,
    region,
    ownership,
    currentValue: ownership === 'owned' ? purchasePrice : 0,
    annualRent: ownership === 'rented' ? annualRent : 0,
    leaseYearsRemaining: ownership === 'rented' ? 5 : null,
    upgrades: [],
    builtYear: state.year,
    underConstruction: info.constructionYears > 0,
    constructionYearsRemaining: info.constructionYears,
  }

  let next: GameState = { ...state, facilities: [...state.facilities, facility] }
  if (ownership === 'owned') {
    next = appendTransaction(next, { category: 'FACILITY_PURCHASE', amount: -purchasePrice, description: `Purchased a ${info.label.toLowerCase()} in ${REGION_PROFILES[region].name}`, relatedId: facility.id })
  }
  return { state: next, facility }
}

export function upgradeFacility(state: GameState, facilityId: string, upgradeId: FacilityUpgradeId): { state: GameState; error?: string } {
  const facility = state.facilities.find((item) => item.id === facilityId)
  if (!facility) return { state, error: 'Unknown facility.' }
  if (facility.upgrades.includes(upgradeId)) return { state, error: 'This upgrade is already installed.' }
  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const upgradeInfo = FACILITY_UPGRADE_INFO[upgradeId]
  const cost = Math.max(500, Math.round((Math.max(20, industry.averagePrice) * upgradeInfo.costFactor * difficulty.costMultiplier) / 50) * 50)
  if (cost > state.cash) return { state, error: `${upgradeInfo.label} would cost ${cost.toLocaleString()}, more than your available cash.` }

  const updated: Facility = { ...facility, upgrades: [...facility.upgrades, upgradeId] }
  const next: GameState = { ...state, facilities: state.facilities.map((item) => (item.id === facilityId ? updated : item)) }
  return { state: appendTransaction(next, { category: 'FACILITY_PURCHASE', amount: -cost, description: `Installed ${upgradeInfo.label.toLowerCase()} at your ${FACILITY_TYPE_INFO[facility.type].label.toLowerCase()} in ${REGION_PROFILES[facility.region].name}`, relatedId: facility.id }) }
}

/** Selling an owned facility returns 80% of its current value — the other 20% represents real-world transaction and depreciation costs, never a silent number. */
export function sellFacility(state: GameState, facilityId: string): { state: GameState; error?: string } {
  const facility = state.facilities.find((item) => item.id === facilityId)
  if (!facility) return { state, error: 'Unknown facility.' }
  if (facility.ownership !== 'owned') return { state, error: 'Only owned facilities can be sold — a rented facility should be vacated instead.' }
  const saleValue = Math.round(facility.currentValue * 0.8)
  const next: GameState = { ...state, facilities: state.facilities.filter((item) => item.id !== facilityId) }
  return { state: appendTransaction(next, { category: 'FACILITY_SALE', amount: saleValue, description: `Sold your ${FACILITY_TYPE_INFO[facility.type].label.toLowerCase()} in ${REGION_PROFILES[facility.region].name} (80% of its current value, after transaction and depreciation costs)`, relatedId: facility.id }) }
}

/** Ending a rented lease early costs the equivalent of one more year's rent as a break fee if years remain on the lease; a lease that has already run its full term ends free. */
export function vacateLease(state: GameState, facilityId: string): { state: GameState; error?: string } {
  const facility = state.facilities.find((item) => item.id === facilityId)
  if (!facility) return { state, error: 'Unknown facility.' }
  if (facility.ownership !== 'rented') return { state, error: 'Only rented facilities have a lease to vacate — an owned facility should be sold instead.' }
  const breakFee = facility.leaseYearsRemaining && facility.leaseYearsRemaining > 0 ? facility.annualRent : 0
  if (breakFee > state.cash) return { state, error: `Breaking this lease early would cost a ${breakFee.toLocaleString()} fee, more than your available cash.` }
  let next: GameState = { ...state, facilities: state.facilities.filter((item) => item.id !== facilityId) }
  if (breakFee > 0) {
    next = appendTransaction(next, { category: 'OTHER_EXPENSE', amount: -breakFee, description: `Early lease-break fee for your ${FACILITY_TYPE_INFO[facility.type].label.toLowerCase()} in ${REGION_PROFILES[facility.region].name}`, relatedId: facility.id })
  }
  return { state: next }
}

// --- Compliance staffing -----------------------------------------------------------

export function previewComplianceStaffSalary(state: GameState, role: ComplianceStaffRole): number {
  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  return computeComplianceStaffAnnualSalary(role, industry, difficulty)
}

/** Hiring is immediate and headcount-based — the salary is charged every year through COMPLIANCE_STAFF_WAGES, not up front. */
export function hireComplianceStaff(state: GameState, role: ComplianceStaffRole): { state: GameState; error?: string } {
  return { state: { ...state, complianceStaff: { ...state.complianceStaff, [role]: state.complianceStaff[role] + 1 } } }
}

export function releaseComplianceStaff(state: GameState, role: ComplianceStaffRole): { state: GameState; error?: string } {
  if (state.complianceStaff[role] <= 0) return { state, error: 'No one in this role to let go.' }
  return { state: { ...state, complianceStaff: { ...state.complianceStaff, [role]: state.complianceStaff[role] - 1 } } }
}

// --- Questionable offers and legal risk ---------------------------------------------

export function previewQuestionableOfferBenefit(state: GameState, offerId: string): number {
  const offer = state.questionableOffers.find((item) => item.id === offerId)
  if (!offer) return 0
  return computeOfferBenefit(offer, getIndustryProfile(state.industry), DIFFICULTY_PROFILES[state.preferences.difficulty])
}

/** Every lawful response (reject, investigate, consult lawyers, report, negotiate a lawful alternative) is always available and never disadvantages the player relative to accepting once risk is accounted for. */
export function respondToQuestionableOffer(state: GameState, offerId: string, response: NonNullable<QuestionableOffer['response']>): { state: GameState; error?: string } {
  const offer = state.questionableOffers.find((item) => item.id === offerId)
  if (!offer) return { state, error: 'That offer is no longer available.' }
  if (offer.response !== null) return { state, error: 'This offer has already been resolved.' }

  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const resolvedOffer: QuestionableOffer = { ...offer, response, resolvedYear: state.year }
  let next: GameState = {
    ...state,
    questionableOffers: state.questionableOffers.map((item) => (item.id === offerId ? resolvedOffer : item)),
    legalRisk: applyOfferResponseToLegalRisk(state.legalRisk, offer, response),
  }

  if (response === 'accept') {
    const benefit = computeOfferBenefit(offer, industry, difficulty)
    if (benefit > 0) {
      next = appendTransaction(next, { category: 'QUESTIONABLE_OFFER_BENEFIT', amount: benefit, description: `Accepted: ${offer.title}`, relatedId: offer.id })
    }
  } else if (response === 'report') {
    next = appendReputationTransaction(next, { delta: 1, reasonCategory: 'FAIR_TREATMENT', description: `Reported a questionable approach ("${offer.title}") instead of acting on it.`, relatedId: offer.id })
  }

  return { state: next }
}

export function previewLegalCaseActionCost(state: GameState, action: LegalCaseAction): number {
  return computeLegalCaseActionCost(action, getIndustryProfile(state.industry), DIFFICULTY_PROFILES[state.preferences.difficulty])
}

/** Actions accumulate on the case and are weighed together when it reaches judgment — no single action guarantees an outcome. */
export function takeLegalCaseAction(state: GameState, caseId: string, action: LegalCaseAction): { state: GameState; error?: string } {
  const legalCase = state.legalCases.find((item) => item.id === caseId)
  if (!legalCase) return { state, error: 'That legal case is no longer active.' }
  if (legalCase.outcome !== null) return { state, error: 'This case has already been resolved.' }
  if (legalCase.actionsTaken.includes(action)) return { state, error: 'That action has already been taken on this case.' }

  const cost = computeLegalCaseActionCost(action, getIndustryProfile(state.industry), DIFFICULTY_PROFILES[state.preferences.difficulty])
  if (cost > state.cash) return { state, error: `This action needs ${Math.round(cost).toLocaleString()}, more than your available cash.` }

  const updatedCase: LegalCase = { ...legalCase, actionsTaken: [...legalCase.actionsTaken, action] }
  let next: GameState = { ...state, legalCases: state.legalCases.map((item) => (item.id === caseId ? updatedCase : item)) }
  if (cost > 0) {
    const category: CashTransactionCategory = action === 'compensate-customers' || action === 'settle-civil-claims' ? 'SETTLEMENT_PAYMENT' : 'LEGAL_FEE'
    next = appendTransaction(next, { category, amount: -cost, description: `Legal case action (${action.replace(/-/g, ' ')}) for "${legalCase.title}"`, relatedId: legalCase.id })
  }
  if (action === 'improve-compliance') {
    const boosted = { ...next.complianceRatings }
    for (const category of COMPLIANCE_CATEGORY_ORDER) boosted[category] = clampScore(boosted[category] + 3)
    next = { ...next, complianceRatings: boosted }
  }
  return { state: next }
}

export { verifyLedgerIntegrity }

export type YearOutcomeEstimate = {
  committedExpensesSoFar: number
  projectedRevenue: number
  projectedWages: number
  projectedRent: number
  projectedFacilityUpkeep: number
  estimatedProfitOrLoss: number
}

/**
 * A read-only preview of how the year is shaping up so far — never mutates
 * state or the ledger. Committed expenses (research/advertising/production
 * already paid this year) are real numbers; projected revenue/wages/rent are
 * clearly-labelled estimates using today's prices and decisions, since
 * events and the exact sales outcome are only known once the year closes.
 */
export function estimateCurrentYearOutcome(state: GameState, rng: () => number = Math.random): YearOutcomeEstimate {
  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const year = state.year
  const activeProducts = state.products.filter((p) => !p.discontinued)

  const committedExpensesSoFar =
    sumLedgerCategoryForYear(state, 'RESEARCH_COST', year) +
    sumLedgerCategoryForYear(state, 'ADVERTISING_COST', year) +
    sumLedgerCategoryForYear(state, 'PRODUCTION_COST', year)

  const projectedRent = computeRent(industry, activeProducts.length, difficulty)
  const totalUnitsPlanned = activeProducts.reduce((sum, p) => sum + p.unitsManufactured, 0)
  const baseProjectedWages = computeWages(totalUnitsPlanned, activeProducts.length, difficulty, state.staffMorale)
  const regionalWageMultiplier = state.facilities.length > 0
    ? state.facilities.reduce((sum, facility) => sum + computeRegionalWageMultiplier(facility.region, state.reputationCategories.employee), 0) / state.facilities.length
    : 1
  const projectedWages = Math.round(baseProjectedWages * regionalWageMultiplier)
  const projectedFacilityUpkeep = Math.round(state.facilities.reduce((sum, facility) => sum + computeFacilityUpkeep(facility, industry, difficulty), 0))

  const isFirstYearForCompany = state.annualReports.length === 0
  const seasonal = computeSeasonalMultiplier(industry, year)
  const saturation = computeMarketSaturation(state.marketShare, state.competitors)
  let projectedRevenue = 0
  for (const product of activeProducts) {
    const availableStock = product.inventory + product.unitsManufactured
    const qualityScore = computeQualityScore(industry, product)
    const advertisingReach = sumAdvertisingReachForProduct(state.advertisingCampaigns, product.id, year)
    const agePenalty = computeProductAgePenalty(product, industry, year)
    const demand = computeDemand({
      product,
      qualityScore,
      industry,
      competitors: state.competitors,
      brandReputation: state.brandReputation,
      customerSatisfaction: state.customerSatisfaction,
      economicIndex: state.economicIndex,
      difficulty,
      advertisingReach,
      demandEventMultiplier: 1,
      isFirstYearForCompany,
      rng,
      customerLoyalty: product.customerLoyalty,
      awareness: product.awareness,
      seasonalMultiplier: seasonal.multiplier,
      saturationMultiplier: saturation.multiplier,
      agePenaltyMultiplier: agePenalty.multiplier,
    })
    projectedRevenue += Math.min(availableStock, demand) * product.price
  }

  const estimatedProfitOrLoss = projectedRevenue - committedExpensesSoFar - projectedWages - projectedRent - projectedFacilityUpkeep
  return { committedExpensesSoFar, projectedRevenue, projectedWages, projectedRent, projectedFacilityUpkeep, estimatedProfitOrLoss }
}

/** Read-only estimated demand for one product at a given (possibly hypothetical) price — used by the Pricing page so a player can preview a price change before committing to it. */
export function estimateProductDemandAtPrice(state: GameState, productId: string, price: number, rng: () => number = Math.random): number {
  const product = state.products.find((p) => p.id === productId)
  if (!product) return 0
  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const qualityScore = computeQualityScore(industry, product)
  const advertisingReach = sumAdvertisingReachForProduct(state.advertisingCampaigns, product.id, state.year)
  const isFirstYearForCompany = state.annualReports.length === 0
  const seasonal = computeSeasonalMultiplier(industry, state.year)
  const saturation = computeMarketSaturation(state.marketShare, state.competitors)
  const agePenalty = computeProductAgePenalty(product, industry, state.year)
  return computeDemand({
    product: { ...product, price },
    qualityScore,
    industry,
    competitors: state.competitors,
    brandReputation: state.brandReputation,
    customerSatisfaction: state.customerSatisfaction,
    economicIndex: state.economicIndex,
    difficulty,
    advertisingReach,
    demandEventMultiplier: 1,
    isFirstYearForCompany,
    rng,
    customerLoyalty: product.customerLoyalty,
    awareness: product.awareness,
    seasonalMultiplier: seasonal.multiplier,
    saturationMultiplier: saturation.multiplier,
    agePenaltyMultiplier: agePenalty.multiplier,
  })
}

// --- The yearly close-out --------------------------------------------------------

export function completeFinancialYear(state: GameState, rng: () => number = Math.random): { state: GameState; report: AnnualReport } {
  const baseIndustry = getIndustryProfile(state.industry)
  // International expansion (unlocked at Excellent reputation + a real company-value bar) raises the
  // effective addressable market — represented as a market-size boost rather than a full new subsystem.
  const industry = state.unlockedFeatures.includes('international-expansion') ? { ...baseIndustry, marketSize: Math.round(baseIndustry.marketSize * 1.4) } : baseIndustry
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const year = state.year
  const openingCash = state.cash
  const isFirstYearForCompany = state.annualReports.length === 0
  const factorNotes: string[] = []

  let working = state
  const activeProducts = working.products.filter((p) => !p.discontinued)
  const activeInitiatives = getActiveStrategicInitiatives(working)
  const initiativeEffects = getStrategicInitiativeEffects(working)
  if (activeInitiatives.length > 0) {
    const initiativeLabels = activeInitiatives.map((initiative) => getStrategicInitiativeOption(initiative.initiativeId)?.shortLabel ?? initiative.initiativeId).join(', ')
    factorNotes.push('Active boardroom decisions this year: ' + initiativeLabels + '.')
  }
  const events = generateYearlyEvents(industry, difficulty, activeProducts.map((p) => p.id), year, working.brandReputation, rng)
  const costMultiplier = events.filter((e) => e.targetProductId == null).reduce((mult, e) => mult * e.costMultiplier, 1)
  const companyWideDemandMultiplier = events.filter((e) => e.targetProductId == null).reduce((mult, e) => mult * e.demandMultiplier, 1) * initiativeEffects.demandMultiplier
  let economicIndex = working.economicIndex
  for (const event of events) economicIndex = Math.max(0.7, Math.min(1.3, economicIndex + event.economicIndexDelta))

  // Competitors act BEFORE this year's demand is computed, using the player's position at the
  // start of the year — so a competitor's price cut or product launch actually affects this same
  // year's sales, matching what the activity feed tells the player.
  const playerAveragePrice = activeProducts.length > 0 ? activeProducts.reduce((sum, p) => sum + p.price, 0) / activeProducts.length : 0
  const playerAverageQualityScore = activeProducts.length > 0 ? activeProducts.reduce((sum, p) => sum + computeQualityScore(industry, p), 0) / activeProducts.length : 50
  const competitorResult = runCompetitorActionsForYear(
    working.competitors,
    { averagePrice: playerAveragePrice, averageQualityScore: playerAverageQualityScore, marketShare: working.marketShare },
    year,
    rng,
  )
  working = { ...working, competitors: competitorResult.competitors }
  if (competitorResult.activity.length > 0) {
    factorNotes.push(`Competitors took ${competitorResult.activity.length} action${competitorResult.activity.length === 1 ? '' : 's'} this year — see the competitor activity feed for what happened and why.`)
  }

  const rent = computeRent(industry, activeProducts.length, difficulty)
  const totalUnitsPlanned = activeProducts.reduce((sum, p) => sum + p.unitsManufactured, 0)
  const baseWages = computeWages(totalUnitsPlanned, activeProducts.length, difficulty, working.staffMorale)
  const regionalWageMultiplier = working.facilities.length > 0
    ? working.facilities.reduce((sum, facility) => sum + computeRegionalWageMultiplier(facility.region, working.reputationCategories.employee), 0) / working.facilities.length
    : 1
  const wages = Math.round(baseWages * regionalWageMultiplier)
  if (working.facilities.length > 0 && Math.abs(regionalWageMultiplier - 1) >= 0.02) {
    factorNotes.push(`Regional wage levels across your facilities adjusted staff wages by ${regionalWageMultiplier >= 1 ? '+' : ''}${Math.round((regionalWageMultiplier - 1) * 100)}%.`)
  }
  working = appendTransaction(working, { category: 'RENT', amount: -rent, description: `Year ${year} rent and operating overhead` })
  working = appendTransaction(working, { category: 'WAGES', amount: -wages, description: `Year ${year} staff wages` })

  const operating = computeOperatingCosts(industry, activeProducts, difficulty)
  if (operating.total > 0) {
    working = appendTransaction(working, {
      category: 'OPERATING_COSTS',
      amount: -operating.total,
      description: `Year ${year} operating costs — storage ${operating.storage.toLocaleString()}, insurance ${operating.insurance.toLocaleString()}, maintenance ${operating.maintenance.toLocaleString()}`,
    })
  }

  // Facility upkeep: rent for rented facilities, property tax + maintenance for owned — charged even while a facility is still under construction.
  const facilityUpkeepTotal = working.facilities.reduce((sum, facility) => sum + computeFacilityUpkeep(facility, industry, difficulty), 0)
  if (facilityUpkeepTotal > 0) {
    working = appendTransaction(working, {
      category: 'FACILITY_UPKEEP',
      amount: -Math.round(facilityUpkeepTotal),
      description: `Year ${year} facility upkeep across ${working.facilities.length} facilit${working.facilities.length === 1 ? 'y' : 'ies'} — rent, property tax, and maintenance`,
    })
  }

  // Construction progress, owned-property value drift, and lease-term countdown/renewal.
  const updatedFacilities: Facility[] = working.facilities.map((facility) => {
    const constructionYearsRemaining = facility.underConstruction ? Math.max(0, facility.constructionYearsRemaining - 1) : 0
    const underConstruction = constructionYearsRemaining > 0
    if (facility.underConstruction && !underConstruction) {
      factorNotes.push(`Your ${FACILITY_TYPE_INFO[facility.type].label.toLowerCase()} in ${REGION_PROFILES[facility.region].name} finished construction and is now active.`)
    }
    const currentValue = facility.ownership === 'owned' ? computePropertyValueDrift(facility.currentValue, facility.region, rng) : facility.currentValue

    if (facility.ownership === 'rented' && facility.leaseYearsRemaining !== null) {
      const yearsRemaining = facility.leaseYearsRemaining - 1
      if (yearsRemaining <= 0) {
        const renewedRent = Math.round(facility.annualRent * 1.05)
        factorNotes.push(`The lease on your ${FACILITY_TYPE_INFO[facility.type].label.toLowerCase()} in ${REGION_PROFILES[facility.region].name} renewed for another 5 years at a higher rent.`)
        return { ...facility, underConstruction, constructionYearsRemaining, currentValue, annualRent: renewedRent, leaseYearsRemaining: 5 }
      }
      return { ...facility, underConstruction, constructionYearsRemaining, currentValue, leaseYearsRemaining: yearsRemaining }
    }
    return { ...facility, underConstruction, constructionYearsRemaining, currentValue }
  })
  working = { ...working, facilities: updatedFacilities }

  // Competitors occasionally purchase land, permanently claiming a region for new player facilities (existing facilities there are unaffected) — more likely with more aggressive/predatory competitors in play.
  const unclaimedRegions = REGION_ORDER.filter((region) => !working.claimedRegions.includes(region))
  if (unclaimedRegions.length > 0) {
    const aggressiveCompetitorCount = competitorResult.competitors.filter((c) => c.strategyType === 'aggressive-expander' || c.strategyType === 'corporate-predator').length
    const claimChance = 0.04 * difficulty.volatility * aggressiveCompetitorCount
    if (claimChance > 0 && rng() < claimChance) {
      const claimedRegion = unclaimedRegions[Math.floor(rng() * unclaimedRegions.length)]
      working = { ...working, claimedRegions: [...working.claimedRegions, claimedRegion] }
      factorNotes.push(`A competitor purchased land in ${REGION_PROFILES[claimedRegion].name} this year — that region is no longer available for new facilities.`)
    }
  }

  // Government laws: at most one new proposal may appear (always with a 2-year advance warning), and any law whose decision year has arrived is resolved by a real probability roll against the odds already shown to the player.
  const operatingRegions = Array.from(new Set(working.facilities.map((facility) => facility.region)))
  const newLawProposal = generateLawProposal(working.laws, operatingRegions, industry, difficulty, year, rng)
  const lawUpdates: Law[] = newLawProposal ? [newLawProposal] : []
  if (newLawProposal) {
    factorNotes.push(`New law proposed: "${newLawProposal.name}" (${newLawProposal.region === 'national' ? 'national' : REGION_PROFILES[newLawProposal.region].name}) — expected to be decided in ${newLawProposal.expectedStartYear}.`)
  }
  const { laws: lawsAfterDecisions, decided: decidedLaws } = resolveLawDecisions(newLawProposal ? [...working.laws, newLawProposal] : working.laws, year, rng)
  lawUpdates.push(...decidedLaws)
  for (const law of decidedLaws) {
    factorNotes.push(`"${law.name}" was ${law.status === 'active' ? 'passed and is now active' : 'rejected'} this year.`)
  }
  working = { ...working, laws: lawsAfterDecisions }

  // Newly active laws charge a one-time compliance transition cost — a well-prepared company (a strong rating in the relevant compliance category) pays much less.
  for (const law of decidedLaws) {
    if (law.status !== 'active') continue
    const complianceCategory = LAW_CATEGORY_TO_COMPLIANCE[law.category]
    const rating = working.complianceRatings[complianceCategory]
    const preparednessDiscount = rating >= 70 ? 0.4 : rating >= 50 ? 0.7 : 1
    const cost = Math.round(law.estimatedComplianceCost * preparednessDiscount)
    if (cost > 0) {
      working = appendTransaction(working, {
        category: 'LAW_COMPLIANCE_COST',
        amount: -cost,
        description: `Compliance transition cost for "${law.name}"${preparednessDiscount < 1 ? ' — reduced because your ' + COMPLIANCE_CATEGORY_INFO[complianceCategory].label.toLowerCase() + ' compliance was already strong' : ''}`,
        relatedId: law.id,
      })
    }
  }

  // Compliance staff wages, charged every year they remain hired.
  const complianceStaffWagesTotal = COMPLIANCE_STAFF_ROLE_ORDER.reduce((sum, role) => sum + computeComplianceStaffAnnualSalary(role, industry, difficulty) * working.complianceStaff[role], 0)
  if (complianceStaffWagesTotal > 0) {
    working = appendTransaction(working, { category: 'COMPLIANCE_STAFF_WAGES', amount: -Math.round(complianceStaffWagesTotal), description: `Year ${year} compliance staff wages` })
  }

  // Compliance ratings drift toward whatever current staffing actually supports — hiring builds readiness over several years, understaffing lets it decay.
  const updatedComplianceRatings = { ...working.complianceRatings }
  for (const category of COMPLIANCE_CATEGORY_ORDER) {
    updatedComplianceRatings[category] = driftComplianceRating(working.complianceRatings[category], computeComplianceRatingTarget(category, working.complianceStaff))
  }
  working = { ...working, complianceRatings: updatedComplianceRatings }

  // Inspections: each compliance category with at least one active law has a chance of an inspection this year — low ratings risk a fine and a reputation hit, strong ratings pass cleanly.
  const activeLawsByCategory = new Map<ComplianceCategory, Law[]>()
  for (const law of working.laws) {
    if (law.status !== 'active') continue
    const category = LAW_CATEGORY_TO_COMPLIANCE[law.category]
    activeLawsByCategory.set(category, [...(activeLawsByCategory.get(category) ?? []), law])
  }
  for (const [category, categoryLaws] of activeLawsByCategory) {
    const rating = working.complianceRatings[category]
    const inspectionChance = computeInspectionProbability(rating, categoryLaws.length, difficulty)
    if (rng() >= inspectionChance) continue
    if (rating < 50) {
      const relevantLaw = categoryLaws[0]
      const fine = Math.round(relevantLaw.possiblePenalty * (1 - rating / 100))
      working = appendTransaction(working, { category: 'REGULATORY_FINE', amount: -fine, description: `A ${COMPLIANCE_CATEGORY_INFO[category].label.toLowerCase()} inspection found violations under "${relevantLaw.name}"`, relatedId: relevantLaw.id })
      working = { ...working, unresolvedViolations: working.unresolvedViolations + 1 }
      working = appendReputationTransaction(working, { delta: -5, reasonCategory: 'REGULATION_BREACH', description: `A ${COMPLIANCE_CATEGORY_INFO[category].label.toLowerCase()} inspection found violations this year, resulting in a fine of ${fine.toLocaleString()}.`, relatedId: relevantLaw.id })
      factorNotes.push(`A ${COMPLIANCE_CATEGORY_INFO[category].label.toLowerCase()} inspection this year found violations — see the reputation history for details.`)
    } else {
      factorNotes.push(`A ${COMPLIANCE_CATEGORY_INFO[category].label.toLowerCase()} inspection this year found the company fully compliant.`)
    }
  }

  // Questionable offers and legal risk: at most one pending offer at a time, and legal risk only ever
  // moves because of how the player actually responded to something — never a background dice roll
  // disconnected from real decisions. 'disabled' mode skips the whole system for a lighter game.
  const legalConsequencesMode = working.preferences.legalConsequencesMode ?? 'legacy-mode'
  if (legalConsequencesMode !== 'disabled') {
    const hasPendingOffer = working.questionableOffers.some((offer) => offer.response === null)
    const newOffer = generateQuestionableOffer(hasPendingOffer, difficulty, year, rng)
    if (newOffer) {
      working = { ...working, questionableOffers: [...working.questionableOffers, newOffer] }
      factorNotes.push(`A questionable offer arose this year: "${newOffer.title}" — review it on the Legal & Compliance page.`)
    }

    // Low staff morale raises the chance that internal concerns about existing risk become outside suspicion — the whistleblower pathway, without a separate subsystem.
    if (working.legalRisk.employeeKnowledge > 25 && working.staffMorale < 40) {
      const whistleblowerBump = Math.round((40 - working.staffMorale) * 0.15)
      working = { ...working, legalRisk: { ...working.legalRisk, suspicion: clampScore(working.legalRisk.suspicion + whistleblowerBump) } }
      factorNotes.push('Low staff morale increased the chance that internal concerns became outside suspicion this year.')
    }

    // Only one investigation can be active at a time; the underlying risk profile keeps accumulating in the meantime regardless.
    const hasActiveLegalCase = working.legalCases.some((legalCase) => legalCase.outcome === null)
    if (!hasActiveLegalCase) {
      const averageComplianceRating = COMPLIANCE_CATEGORY_ORDER.reduce((sum, category) => sum + working.complianceRatings[category], 0) / COMPLIANCE_CATEGORY_ORDER.length
      const triggerChance = computeInvestigationTriggerChance(working.legalRisk, averageComplianceRating, difficulty)
      if (triggerChance > 0 && rng() < triggerChance) {
        const severity = classifyCaseSeverity(working.legalRisk)
        const relatedOffer = [...working.questionableOffers].reverse().find((offer) => offer.response === 'accept')
        const newCase: LegalCase = {
          id: createId('legal-case'),
          relatedOfferId: relatedOffer?.id ?? null,
          title: relatedOffer ? `Investigation: ${relatedOffer.title}` : 'Investigation into company conduct',
          description: relatedOffer
            ? `A complaint or rumour has surfaced, connected to how the company handled "${relatedOffer.title}".`
            : 'A complaint or rumour about the company\'s conduct has surfaced.',
          severity,
          stage: 'complaint-or-rumour',
          startedYear: year,
          stageEnteredYear: year,
          actionsTaken: [],
          outcome: null,
          resolvedYear: null,
        }
        working = { ...working, legalCases: [...working.legalCases, newCase] }
        factorNotes.push(`A legal case began this year: "${newCase.title}" — review it on the Legal & Compliance page.`)
      }
    }

    // Every active case advances exactly one stage per year; reaching the final stage resolves and applies the outcome in the same step.
    const updatedCases: LegalCase[] = []
    for (const existingCase of working.legalCases) {
      if (existingCase.outcome !== null) { updatedCases.push(existingCase); continue }
      let advancedCase = advanceCaseStage(existingCase, year)
      if (advancedCase.stage === 'penalty-or-acquittal') {
        const outcome = resolveCaseOutcome(advancedCase, working.legalRisk, rng)
        const financialImpact = computeCaseFinancialImpact(outcome, industry, difficulty)
        const reputationImpact = computeCaseReputationImpact(outcome)
        advancedCase = { ...advancedCase, outcome, resolvedYear: year }
        if (financialImpact > 0) {
          working = appendTransaction(working, { category: 'COURT_FINE', amount: -financialImpact, description: `Court outcome for "${advancedCase.title}": ${outcome.replace(/-/g, ' ')}`, relatedId: advancedCase.id })
        }
        if (reputationImpact !== 0) {
          working = appendReputationTransaction(working, { delta: reputationImpact, reasonCategory: outcome === 'acquitted' ? 'CRISIS_HANDLED_WELL' : 'SCANDAL', description: `Court outcome for "${advancedCase.title}": ${outcome.replace(/-/g, ' ')}.`, relatedId: advancedCase.id })
        }
        factorNotes.push(`Legal case resolved: "${advancedCase.title}" ended in ${outcome.replace(/-/g, ' ')}.`)
        if (outcome === 'founder-imprisonment') {
          if (legalConsequencesMode === 'permanent-game-over') {
            working = { ...working, gameOverReason: `${working.founderName} was found guilty in "${advancedCase.title}" and imprisoned. Under permanent-consequences settings, ${working.companyName}'s story ends here.` }
          } else {
            factorNotes.push(`${working.founderName} was found guilty and stepped down as a result — a successor now leads ${working.companyName}.`)
          }
        }
      }
      updatedCases.push(advancedCase)
    }
    working = { ...working, legalCases: updatedCases }
  }

  // Loans amortize on a straight-line principal schedule with interest charged on the remaining balance — the schedule is visible on the Funding page, never a surprise deduction.
  let loanRepaymentsTotal = 0
  const remainingLoans: Loan[] = []
  for (const loan of working.loans) {
    if (loan.yearsRemaining <= 0 || loan.remainingBalance <= 0) continue
    const principalPortion = Math.min(loan.remainingBalance, loan.principal / loan.termYears)
    const interestPortion = loan.remainingBalance * loan.interestRate
    const payment = principalPortion + interestPortion
    loanRepaymentsTotal += payment
    const newRemainingBalance = Math.max(0, Math.round((loan.remainingBalance - principalPortion) * 100) / 100)
    const newYearsRemaining = loan.yearsRemaining - 1
    if (newRemainingBalance > 0.5 && newYearsRemaining > 0) {
      remainingLoans.push({ ...loan, remainingBalance: newRemainingBalance, yearsRemaining: newYearsRemaining })
    }
  }
  loanRepaymentsTotal = Math.round(loanRepaymentsTotal)
  if (loanRepaymentsTotal > 0) {
    working = appendTransaction(working, { category: 'LOAN_REPAYMENT', amount: -loanRepaymentsTotal, description: `Year ${year} loan repayments (principal + interest)` })
  }
  working = { ...working, loans: remainingLoans }

  const seasonal = computeSeasonalMultiplier(industry, year)
  if (seasonal.note) factorNotes.push(seasonal.note)
  const saturation = computeMarketSaturation(working.marketShare, working.competitors)
  if (saturation.note) factorNotes.push(saturation.note)

  const perProduct: AnnualReport['perProduct'] = []
  let totalRevenue = 0
  let totalCogs = 0
  let unitsProducedTotal = 0
  let unitsSoldTotal = 0
  let unsoldTotal = 0
  const updatedProducts: Product[] = []
  const reputationAdjustments: { delta: number; reasonCategory: ReputationReasonCategory; description: string; relatedId?: string }[] = []

  for (const product of working.products) {
    if (product.discontinued) {
      updatedProducts.push(product)
      continue
    }

    const qualityScore = computeQualityScore(industry, product)
    const reliability = Math.min(100, computeProductReliability(qualityScore, rng) + initiativeEffects.reliabilityBonus)
    const recallIndustry = initiativeEffects.recallRiskMultiplier === 1 ? industry : { ...industry, challengeProfile: { ...industry.challengeProfile, recallRisk: industry.challengeProfile.recallRisk * initiativeEffects.recallRiskMultiplier } }
    const recalled = checkForProductRecall(reliability, recallIndustry, rng)

    if (recalled) {
      const recallRefund = Math.round(product.lifetimeUnitsSold * product.price * 0.05)
      if (recallRefund > 0) {
        working = appendTransaction(working, { category: 'REFUND', amount: -recallRefund, description: `Product recall refunds for ${product.name}`, relatedId: product.id })
      }
      reputationAdjustments.push({
        delta: -10,
        reasonCategory: 'PRODUCT_RECALL',
        description: `${product.name} was recalled after a quality defect was discovered — all current stock was withdrawn from sale.`,
        relatedId: product.id,
      })
      factorNotes.push(`${product.name} was recalled this year — see the reputation history for details.`)

      updatedProducts.push({
        ...product,
        inventory: 0,
        unitsManufactured: 0,
        reliability,
        satisfaction: Math.max(0, product.satisfaction - 20),
        history: [...product.history, { year, unitsProduced: product.unitsManufactured, unitsSold: 0, unsoldAtYearEnd: 0, revenue: 0, costOfGoodsSold: 0, satisfaction: Math.max(0, product.satisfaction - 20) }],
      })
      perProduct.push({ productId: product.id, productName: product.name, unitsProduced: product.unitsManufactured, unitsSold: 0, unsoldAtYearEnd: 0, revenue: 0, costOfGoodsSold: 0 })
      unitsProducedTotal += product.unitsManufactured
      continue
    }

    // Production delays: reputation and difficulty both affect how reliably suppliers deliver on time. Delayed units simply become next year's carried inventory rather than vanishing.
    const delayChance = computeProductionDelayChance(working.brandReputation, difficulty) * initiativeEffects.delayMultiplier
    const isDelayed = rng() < delayChance
    const delayedUnits = isDelayed ? Math.round(product.unitsManufactured * (0.15 + rng() * 0.15)) : 0
    if (isDelayed && delayedUnits > 0) factorNotes.push(`${delayedUnits.toLocaleString()} units of ${product.name} were delayed by a supplier and will arrive next year.`)
    const producedThisYear = product.unitsManufactured - delayedUnits

    const carriedInventory = industry.perishable ? Math.round(product.inventory * (1 - PERISHABLE_EXPIRY_RATE)) : product.inventory
    const availableStock = carriedInventory + producedThisYear
    const productEvent = events.find((e) => e.targetProductId === product.id)
    const demandMultiplier = companyWideDemandMultiplier * (productEvent?.demandMultiplier ?? 1)
    const advertisingReach = sumAdvertisingReachForProduct(working.advertisingCampaigns, product.id, year)
    const agePenalty = computeProductAgePenalty(product, industry, year)
    if (agePenalty.note) factorNotes.push(agePenalty.note)

    const demand = computeDemand({
      product,
      qualityScore,
      industry,
      competitors: working.competitors,
      brandReputation: working.brandReputation,
      customerSatisfaction: working.customerSatisfaction,
      economicIndex,
      difficulty,
      advertisingReach,
      demandEventMultiplier: demandMultiplier,
      isFirstYearForCompany,
      rng,
      customerLoyalty: product.customerLoyalty,
      awareness: product.awareness,
      seasonalMultiplier: seasonal.multiplier,
      saturationMultiplier: saturation.multiplier,
      agePenaltyMultiplier: agePenalty.multiplier,
    })

    const unitsSold = Math.min(availableStock, demand)
    const unsoldAtYearEnd = availableStock - unitsSold + delayedUnits
    const effectiveCostPerUnit = product.costPerUnit * costMultiplier
    const revenue = unitsSold * product.price
    const costOfGoodsSold = unitsSold * effectiveCostPerUnit
    const satisfaction = Math.min(100, computeProductSatisfaction(qualityScore, product.price, industry, availableStock, unitsSold) + initiativeEffects.satisfactionBonus)
    const returnRate = computeProductReturnRate(reliability, satisfaction)
    const complaintRate = computeProductComplaintRate(reliability, satisfaction)
    const rating = computeProductRating(satisfaction, reliability)
    const customerLoyalty = computeCustomerLoyalty(product.customerLoyalty, satisfaction, reliability)
    const potentialBuyers = industry.marketSize / Math.max(1, industry.customerGroups.length)
    const awareness = computeAwarenessGrowth(product.awareness, advertisingReach, potentialBuyers, unitsSold)
    const reviews = unitsSold > 0 ? [...product.reviews, generateProductReview(rating, year, rng)].slice(-10) : product.reviews

    // A product's reliability CHANGING across a meaningful threshold — not just existing above/below one — is what moves reputation, so a consistently mediocre product doesn't get penalized every single year.
    if (product.reliability < 60 && reliability >= 60) {
      reputationAdjustments.push({ delta: 3, reasonCategory: 'RELIABLE_PRODUCT', description: `${product.name} became noticeably more reliable this year, and customers noticed.`, relatedId: product.id })
    } else if (product.reliability >= 40 && reliability < 40) {
      reputationAdjustments.push({ delta: -4, reasonCategory: 'QUALITY_ISSUE', description: `${product.name}'s reliability dropped sharply this year, leading to more complaints and returns.`, relatedId: product.id })
    }

    const productCampaignsThisYear = working.advertisingCampaigns.filter((c) => c.productId === product.id && c.year === year)
    const misledOnQuality = productCampaignsThisYear.some((c) => c.claimsHonesty === 'exaggerated') && qualityScore < 55
    if (misledOnQuality) {
      reputationAdjustments.push({ delta: -3, reasonCategory: 'MISLEADING_ADVERTISING', description: `Advertising for ${product.name} made claims its actual quality didn't back up.`, relatedId: product.id })
    }

    working = appendTransaction(working, { category: 'SALES_REVENUE', amount: revenue, description: `Sold ${unitsSold} units of ${product.name}`, relatedId: product.id })

    updatedProducts.push({
      ...product,
      inventory: unsoldAtYearEnd,
      unitsManufactured: 0,
      satisfaction,
      history: [...product.history, { year, unitsProduced: producedThisYear, unitsSold, unsoldAtYearEnd, revenue, costOfGoodsSold, satisfaction }],
      lifetimeUnitsSold: product.lifetimeUnitsSold + unitsSold,
      lifetimeRevenue: product.lifetimeRevenue + revenue,
      rating,
      reviews,
      reliability,
      returnRate,
      complaintRate,
      awareness,
      customerLoyalty,
    })

    perProduct.push({ productId: product.id, productName: product.name, unitsProduced: producedThisYear, unitsSold, unsoldAtYearEnd, revenue, costOfGoodsSold })
    totalRevenue += revenue
    totalCogs += costOfGoodsSold
    unitsProducedTotal += producedThisYear
    unitsSoldTotal += unitsSold
    unsoldTotal += unsoldAtYearEnd
  }

  working = { ...working, products: updatedProducts }

  const productionCosts = sumLedgerCategoryForYear(working, 'PRODUCTION_COST', year)
  const researchCosts = sumLedgerCategoryForYear(working, 'RESEARCH_COST', year)
  const advertisingCosts = sumLedgerCategoryForYear(working, 'ADVERTISING_COST', year)
  const facilityUpkeepCosts = sumLedgerCategoryForYear(working, 'FACILITY_UPKEEP', year)

  const grossProfit = totalRevenue - totalCogs
  const preTaxProfit = totalRevenue - productionCosts - researchCosts - advertisingCosts - wages - rent - operating.total - facilityUpkeepCosts - loanRepaymentsTotal
  const taxes = preTaxProfit > 0 ? Math.round(preTaxProfit * TAX_RATE) : 0
  if (taxes > 0) working = appendTransaction(working, { category: 'TAX', amount: -taxes, description: `Year ${year} tax on profit` })

  const lowSatisfactionProducts = updatedProducts.filter((p) => !p.discontinued && p.satisfaction < 45 && p.history.length > 0)
  const satisfactionRefunds = Math.round(lowSatisfactionProducts.reduce((sum, p) => sum + (p.history[p.history.length - 1]?.revenue ?? 0) * 0.03, 0))
  if (satisfactionRefunds > 0) working = appendTransaction(working, { category: 'REFUND', amount: -satisfactionRefunds, description: `Year ${year} customer refunds and returns` })
  const refunds = sumLedgerCategoryForYear(working, 'REFUND', year)

  const netProfit = preTaxProfit - taxes - refunds
  const totalExpenses = productionCosts + researchCosts + advertisingCosts + wages + rent + operating.total + facilityUpkeepCosts + loanRepaymentsTotal + taxes + refunds

  const newSatisfaction = computeCompanySatisfaction(working.products, working.customerSatisfaction)
  const newStaffMorale = clampScore(computeStaffMorale(working.staffMorale, wages, activeProducts.length, working.brandReputation) + initiativeEffects.moraleBonus)

  // Every reputation change this year — recalls/misleading-advertising/reliability shifts discovered
  // above, the yearly events, the ambient satisfaction pull, and a multi-year-stability bonus — is
  // applied one at a time through the ledger gate, so each is individually explained.
  for (const adjustment of reputationAdjustments) {
    working = appendReputationTransaction(working, adjustment)
  }
  for (const event of events) {
    if (event.reputationDelta !== 0 && event.reputationReasonCategory) {
      working = appendReputationTransaction(working, { delta: event.reputationDelta, reasonCategory: event.reputationReasonCategory, description: event.impact, relatedId: event.targetProductId })
    }
  }
  const satisfactionPull = computeSatisfactionReputationPull(working.brandReputation, newSatisfaction, difficulty)
  if (satisfactionPull !== 0) {
    working = appendReputationTransaction(working, {
      delta: satisfactionPull,
      reasonCategory: 'SATISFACTION_TREND',
      description: satisfactionPull > 0 ? 'Customer satisfaction trended upward this year, gently lifting brand reputation with it.' : 'Customer satisfaction trended downward this year, gently pulling brand reputation down with it.',
    })
  }
  const completedYears = working.annualReports.length + 1
  if ([3, 5, 10, 15, 20].includes(completedYears) && completedYears - reputationAdjustments.filter((a) => a.reasonCategory === 'PRODUCT_RECALL' || a.reasonCategory === 'SCANDAL').length >= 0) {
    working = appendReputationTransaction(working, {
      delta: 3,
      reasonCategory: 'MULTI_YEAR_STABILITY',
      description: `${working.companyName} has now operated for ${completedYears} years — long-term stability builds lasting trust.`,
    })
  }

  const marketShare = industry.marketSize > 0 ? Math.min(100, Math.round((unitsSoldTotal / industry.marketSize) * 1000) / 10) : 0
  const companyValue = computeCompanyValue(working.cash, working.products, marketShare, working.brandReputation)
  const newEconomicCyclePhase = economicIndex >= 1.08 ? 'growth' : economicIndex <= 0.92 ? 'recession' : 'stable'
  if (newEconomicCyclePhase !== 'stable') factorNotes.push(`Broader economic conditions this year: ${newEconomicCyclePhase}.`)

  working = {
    ...working,
    customerSatisfaction: newSatisfaction,
    staffMorale: newStaffMorale,
    marketShare,
    companyValue,
    economicIndex,
    economicCyclePhase: newEconomicCyclePhase,
    strategicInitiatives: activeInitiatives.map((initiative) => ({ ...initiative, yearsRemaining: initiative.yearsRemaining - 1 })).filter((initiative) => initiative.yearsRemaining > 0),
    year: year + 1,
  }

  const workedWell: string[] = []
  const causedProblems: string[] = []
  if (netProfit > 0) workedWell.push('The company finished the year with a net profit.')
  if (unsoldTotal === 0 && unitsProducedTotal > 0) workedWell.push('Every unit produced was sold — no unsold inventory to carry into next year.')
  if (advertisingCosts > 0 && unitsSoldTotal > 0) workedWell.push('Advertising spending was matched by real sales activity.')
  if (unsoldTotal > unitsProducedTotal * 0.3) causedProblems.push('A large share of production went unsold — consider producing less or pricing more competitively next year.')
  if (netProfit < 0) causedProblems.push('Total expenses were higher than revenue this year.')
  if (refunds > 0) causedProblems.push('Product recalls or low customer satisfaction led to refunds this year.')
  const whyProfitOrLoss = netProfit >= 0
    ? `Revenue of ${Math.round(totalRevenue).toLocaleString()} covered all production, research, advertising, wage, rent, operating, loan, and tax costs, leaving a net profit of ${Math.round(netProfit).toLocaleString()}.`
    : `Total expenses of ${Math.round(totalExpenses).toLocaleString()} were higher than revenue of ${Math.round(totalRevenue).toLocaleString()}, resulting in a net loss of ${Math.round(Math.abs(netProfit)).toLocaleString()}.`
  const considerNextYear: string[] = []
  if (unsoldTotal > 0) considerNextYear.push('Decide what to do with unsold inventory before producing more of the same product.')
  if (marketShare < 5) considerNextYear.push('Consider more research or advertising to better understand and reach your customers.')
  if (newSatisfaction < 55) considerNextYear.push('Customer satisfaction is low — check whether your price matches your product quality.')
  if (working.brandReputation < 40) considerNextYear.push('Reputation is weak — review the reputation history to see exactly what has been damaging it.')
  if (activeInitiatives.length === 0) considerNextYear.push('Consider a boardroom decision if cash allows: management choices now can change delays, reliability, morale, or demand next year.')
  if (considerNextYear.length === 0) considerNextYear.push('Keep an eye on competitors — they adjust their prices, quality, and advertising every year too.')

  const report: AnnualReport = {
    year,
    openingCash,
    unitsProduced: unitsProducedTotal,
    unitsSold: unitsSoldTotal,
    unsoldInventory: unsoldTotal,
    totalRevenue,
    productionCosts,
    researchCosts,
    advertisingCosts,
    wages,
    rent,
    operatingCosts: operating.total,
    facilityUpkeep: facilityUpkeepCosts,
    loanRepayments: loanRepaymentsTotal,
    taxes,
    refunds,
    totalExpenses,
    grossProfit,
    netProfit,
    closingCash: working.cash,
    companyValue,
    marketShare,
    customerSatisfaction: newSatisfaction,
    brandReputation: working.brandReputation,
    factorNotes,
    perProduct,
    events,
    competitorActions: competitorResult.activity,
    lawUpdates,
    offerUpdates: working.questionableOffers.filter((offer) => offer.yearOffered === year || offer.resolvedYear === year),
    legalCaseUpdates: working.legalCases.filter((legalCase) => legalCase.startedYear === year || legalCase.stageEnteredYear === year || legalCase.resolvedYear === year),
    learningSummary: { workedWell, causedProblems, whyProfitOrLoss, considerNextYear },
  }

  working = { ...working, annualReports: [...working.annualReports, report] }
  return { state: working, report }
}

export type { CashTransactionCategory }
