import { getIndustryProfile } from '@/lib/business-empire/industries'
import { getAdvertisingChannel } from '@/lib/business-empire/advertising'
import { computeResearchCost, generateResearchReport } from '@/lib/business-empire/research'
import {
  appendTransaction,
  computeBrandReputation,
  computeCompanySatisfaction,
  computeCompanyValue,
  computeCostPerUnit,
  computeDemand,
  computeProductSatisfaction,
  computeQualityScore,
  computeRent,
  computeWages,
  createId,
  estimateAdvertisingReach,
  generateYearlyEvents,
  getInitialCompetitors,
  sumAdvertisingReachForProduct,
  sumLedgerCategoryForYear,
  updateCompetitorsForYear,
  verifyLedgerIntegrity,
} from '@/lib/business-empire/simulation'
import {
  CURRENT_SAVE_VERSION,
  DIFFICULTY_PROFILES,
  type AdvertisingChannel,
  type AnnualReport,
  type CashTransactionCategory,
  type GamePreferences,
  type GameState,
  type PackagingQuality,
  type Product,
  type ProductQuality,
  type ProductionMethod,
  type ResearchLevel,
  type UnsoldInventoryAction,
} from '@/lib/business-empire/types'

const PERISHABLE_EXPIRY_RATE = 0.6
const TAX_RATE = 0.2

export function createInitialState(preferences: GamePreferences, rng: () => number = Math.random): GameState {
  const startedAt = new Date().toISOString()
  const difficulty = DIFFICULTY_PROFILES[preferences.difficulty]
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
    companyValue: preferences.startingCash,
    marketShare: 0,
    customerSatisfaction: 70,
    brandReputation: 50,
    economicIndex: 1,
    completedLessonIds: [],
    unlockedFeatures: [],
    startedAt,
    lastSavedAt: startedAt,
    saveVersion: CURRENT_SAVE_VERSION,
  }
  return appendTransaction(base, { category: 'STARTING_CAPITAL', amount: preferences.startingCash, description: `${preferences.companyName} founded — starting capital` })
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
  return computeCostPerUnit(industry, draft, units, difficulty)
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

export function launchAdvertisingCampaign(state: GameState, productId: string, channel: AdvertisingChannel, budget: number): { state: GameState; error?: string } {
  const product = state.products.find((p) => p.id === productId)
  if (!product) return { state, error: 'Unknown product.' }
  const channelProfile = getAdvertisingChannel(channel)
  if (!channelProfile) return { state, error: 'Unknown advertising channel.' }
  if (channel === 'none') return { state, error: 'Choose an actual channel to launch a campaign, or simply skip advertising this year.' }
  if (budget < channelProfile.minBudget) return { state, error: `${channelProfile.label} needs a budget of at least ${channelProfile.minBudget.toLocaleString()}.` }
  if (budget > state.cash) return { state, error: 'Not enough cash for this advertising budget.' }

  const industry = getIndustryProfile(state.industry)
  const effectiveness = industry.advertisingEffectiveness[channel]
  const estimatedReach = estimateAdvertisingReach(channel, budget, channelProfile.reachPerDollar, effectiveness)

  const campaign = {
    id: createId('campaign'),
    year: state.year,
    productId,
    channel,
    budget,
    estimatedReach,
    effectivenessScore: effectiveness,
    createdAt: new Date().toISOString(),
  }
  const next: GameState = { ...state, advertisingCampaigns: [...state.advertisingCampaigns, campaign] }
  return { state: appendTransaction(next, { category: 'ADVERTISING_COST', amount: -budget, description: `${channelProfile.label} campaign for ${product.name}`, relatedId: campaign.id }) }
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
  const refreshCost = product.inventory * product.costPerUnit * 0.2
  if (refreshCost > state.cash) return { state, error: `Relaunching would cost ${Math.round(refreshCost).toLocaleString()}, more than your available cash.` }
  const next: GameState = { ...state, products: state.products.map((p) => (p.id === productId ? { ...p, satisfaction: Math.min(100, p.satisfaction + 10) } : p)) }
  return { state: appendTransaction(next, { category: 'OTHER_EXPENSE', amount: -refreshCost, description: `Relaunch refresh for ${product.name}`, relatedId: productId }) }
}

export function completeLesson(state: GameState, lessonId: string): GameState {
  if (state.completedLessonIds.includes(lessonId)) return state
  return { ...state, completedLessonIds: [...state.completedLessonIds, lessonId] }
}

export function updatePreferences(state: GameState, partial: Partial<Pick<GamePreferences, 'learningSupport' | 'reducedMotion'>>): GameState {
  return { ...state, preferences: { ...state.preferences, ...partial } }
}

export { verifyLedgerIntegrity }

export type YearOutcomeEstimate = {
  committedExpensesSoFar: number
  projectedRevenue: number
  projectedWages: number
  projectedRent: number
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
  const projectedWages = computeWages(totalUnitsPlanned, activeProducts.length, difficulty)

  const isFirstYearForCompany = state.annualReports.length === 0
  let projectedRevenue = 0
  for (const product of activeProducts) {
    const availableStock = product.inventory + product.unitsManufactured
    const qualityScore = computeQualityScore(industry, product)
    const advertisingReach = sumAdvertisingReachForProduct(state.advertisingCampaigns, product.id, year)
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
    })
    projectedRevenue += Math.min(availableStock, demand) * product.price
  }

  const estimatedProfitOrLoss = projectedRevenue - committedExpensesSoFar - projectedWages - projectedRent
  return { committedExpensesSoFar, projectedRevenue, projectedWages, projectedRent, estimatedProfitOrLoss }
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
  })
}

// --- The yearly close-out --------------------------------------------------------

export function completeFinancialYear(state: GameState, rng: () => number = Math.random): { state: GameState; report: AnnualReport } {
  const industry = getIndustryProfile(state.industry)
  const difficulty = DIFFICULTY_PROFILES[state.preferences.difficulty]
  const year = state.year
  const openingCash = state.cash
  const isFirstYearForCompany = state.annualReports.length === 0

  let working = state
  const activeProducts = working.products.filter((p) => !p.discontinued)
  const events = generateYearlyEvents(industry, difficulty, activeProducts.map((p) => p.id), year, rng)
  const costMultiplier = events.filter((e) => e.targetProductId == null).reduce((mult, e) => mult * e.costMultiplier, 1)
  const companyWideDemandMultiplier = events.filter((e) => e.targetProductId == null).reduce((mult, e) => mult * e.demandMultiplier, 1)
  let economicIndex = working.economicIndex
  for (const event of events) economicIndex = Math.max(0.7, Math.min(1.3, economicIndex + event.economicIndexDelta))

  const rent = computeRent(industry, activeProducts.length, difficulty)
  const totalUnitsPlanned = activeProducts.reduce((sum, p) => sum + p.unitsManufactured, 0)
  const wages = computeWages(totalUnitsPlanned, activeProducts.length, difficulty)
  working = appendTransaction(working, { category: 'RENT', amount: -rent, description: `Year ${year} rent and operating overhead` })
  working = appendTransaction(working, { category: 'WAGES', amount: -wages, description: `Year ${year} staff wages` })

  const perProduct: AnnualReport['perProduct'] = []
  let totalRevenue = 0
  let totalCogs = 0
  let unitsProducedTotal = 0
  let unitsSoldTotal = 0
  let unsoldTotal = 0
  const updatedProducts: Product[] = []

  for (const product of working.products) {
    if (product.discontinued) {
      updatedProducts.push(product)
      continue
    }

    const carriedInventory = industry.perishable ? Math.round(product.inventory * (1 - PERISHABLE_EXPIRY_RATE)) : product.inventory
    const availableStock = carriedInventory + product.unitsManufactured
    const qualityScore = computeQualityScore(industry, product)
    const productEvent = events.find((e) => e.targetProductId === product.id)
    const demandMultiplier = companyWideDemandMultiplier * (productEvent?.demandMultiplier ?? 1)
    const advertisingReach = sumAdvertisingReachForProduct(working.advertisingCampaigns, product.id, year)

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
    })

    const unitsSold = Math.min(availableStock, demand)
    const unsoldAtYearEnd = availableStock - unitsSold
    const effectiveCostPerUnit = product.costPerUnit * costMultiplier
    const revenue = unitsSold * product.price
    const costOfGoodsSold = unitsSold * effectiveCostPerUnit
    const satisfaction = computeProductSatisfaction(qualityScore, product.price, industry, availableStock, unitsSold)

    working = appendTransaction(working, { category: 'SALES_REVENUE', amount: revenue, description: `Sold ${unitsSold} units of ${product.name}`, relatedId: product.id })

    updatedProducts.push({
      ...product,
      inventory: unsoldAtYearEnd,
      unitsManufactured: 0,
      satisfaction,
      history: [...product.history, { year, unitsProduced: product.unitsManufactured, unitsSold, unsoldAtYearEnd, revenue, costOfGoodsSold, satisfaction }],
      lifetimeUnitsSold: product.lifetimeUnitsSold + unitsSold,
      lifetimeRevenue: product.lifetimeRevenue + revenue,
    })

    perProduct.push({ productId: product.id, productName: product.name, unitsProduced: product.unitsManufactured, unitsSold, unsoldAtYearEnd, revenue, costOfGoodsSold })
    totalRevenue += revenue
    totalCogs += costOfGoodsSold
    unitsProducedTotal += product.unitsManufactured
    unitsSoldTotal += unitsSold
    unsoldTotal += unsoldAtYearEnd
  }

  working = { ...working, products: updatedProducts }

  const productionCosts = sumLedgerCategoryForYear(working, 'PRODUCTION_COST', year)
  const researchCosts = sumLedgerCategoryForYear(working, 'RESEARCH_COST', year)
  const advertisingCosts = sumLedgerCategoryForYear(working, 'ADVERTISING_COST', year)

  const grossProfit = totalRevenue - totalCogs
  const preTaxProfit = totalRevenue - productionCosts - researchCosts - advertisingCosts - wages - rent
  const taxes = preTaxProfit > 0 ? Math.round(preTaxProfit * TAX_RATE) : 0
  if (taxes > 0) working = appendTransaction(working, { category: 'TAX', amount: -taxes, description: `Year ${year} tax on profit` })

  const lowSatisfactionProducts = updatedProducts.filter((p) => !p.discontinued && p.satisfaction < 45 && p.history.length > 0)
  const refunds = Math.round(lowSatisfactionProducts.reduce((sum, p) => sum + (p.history[p.history.length - 1]?.revenue ?? 0) * 0.03, 0))
  if (refunds > 0) working = appendTransaction(working, { category: 'REFUND', amount: -refunds, description: `Year ${year} customer refunds and returns` })

  const netProfit = preTaxProfit - taxes - refunds
  const totalExpenses = productionCosts + researchCosts + advertisingCosts + wages + rent + taxes + refunds

  const newSatisfaction = computeCompanySatisfaction(working.products, working.customerSatisfaction)
  const newReputation = computeBrandReputation(working.brandReputation, events, newSatisfaction)
  const marketShare = industry.marketSize > 0 ? Math.min(100, Math.round((unitsSoldTotal / industry.marketSize) * 1000) / 10) : 0
  const updatedCompetitors = updateCompetitorsForYear(working.competitors, marketShare, difficulty, rng)
  const companyValue = computeCompanyValue(working.cash, working.products, marketShare, newReputation)

  working = { ...working, competitors: updatedCompetitors, customerSatisfaction: newSatisfaction, brandReputation: newReputation, marketShare, companyValue, economicIndex, year: year + 1 }

  const workedWell: string[] = []
  const causedProblems: string[] = []
  if (netProfit > 0) workedWell.push('The company finished the year with a net profit.')
  if (unsoldTotal === 0 && unitsProducedTotal > 0) workedWell.push('Every unit produced was sold — no unsold inventory to carry into next year.')
  if (advertisingCosts > 0 && unitsSoldTotal > 0) workedWell.push('Advertising spending was matched by real sales activity.')
  if (unsoldTotal > unitsProducedTotal * 0.3) causedProblems.push('A large share of production went unsold — consider producing less or pricing more competitively next year.')
  if (netProfit < 0) causedProblems.push('Total expenses were higher than revenue this year.')
  if (refunds > 0) causedProblems.push('Low customer satisfaction on at least one product led to refunds.')
  const whyProfitOrLoss = netProfit >= 0
    ? `Revenue of ${Math.round(totalRevenue).toLocaleString()} covered all production, research, advertising, wage, rent, and tax costs, leaving a net profit of ${Math.round(netProfit).toLocaleString()}.`
    : `Total expenses of ${Math.round(totalExpenses).toLocaleString()} were higher than revenue of ${Math.round(totalRevenue).toLocaleString()}, resulting in a net loss of ${Math.round(Math.abs(netProfit)).toLocaleString()}.`
  const considerNextYear: string[] = []
  if (unsoldTotal > 0) considerNextYear.push('Decide what to do with unsold inventory before producing more of the same product.')
  if (marketShare < 5) considerNextYear.push('Consider more research or advertising to better understand and reach your customers.')
  if (newSatisfaction < 55) considerNextYear.push('Customer satisfaction is low — check whether your price matches your product quality.')
  if (considerNextYear.length === 0) considerNextYear.push('Keep an eye on competitors — they adjust their prices and quality every year too.')

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
    taxes,
    refunds,
    totalExpenses,
    grossProfit,
    netProfit,
    closingCash: working.cash,
    companyValue,
    marketShare,
    customerSatisfaction: newSatisfaction,
    brandReputation: newReputation,
    perProduct,
    events,
    learningSummary: { workedWell, causedProblems, whyProfitOrLoss, considerNextYear },
  }

  working = { ...working, annualReports: [...working.annualReports, report] }
  return { state: working, report }
}

export type { CashTransactionCategory }
