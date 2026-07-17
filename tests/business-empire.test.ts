import assert from 'node:assert/strict'
import {
  applyUnsoldInventoryAction,
  completeFinancialYear,
  createInitialState,
  createProduct,
  discontinueProduct,
  launchAdvertisingCampaign,
  manufactureMoreUnits,
  purchaseResearch,
  updateProductPrice,
  verifyLedgerIntegrity,
} from '../lib/business-empire/game-state'
import { sumCashLedger } from '../lib/business-empire/simulation'
import { appendReputationTransaction, checkForProductRecall, computeDemand, computeQualityScore, verifyReputationIntegrity } from '../lib/business-empire/simulation'
import { getIndustryProfile } from '../lib/business-empire/industries'
import {
  assignJobByDegreeQuality,
  computeCareerSavings,
  computeFoundingAge,
  getHardcoreJob,
  isDegreeRelevantToIndustry,
  scoreEntranceQuiz,
  UNIVERSITY_ENTRANCE_QUIZ,
} from '../lib/business-empire/hardcore-career'
import { migrateLegacySave } from '../lib/business-empire/storage'
import { CURRENT_SAVE_VERSION, DIFFICULTY_PROFILES, type CareerBackground, type GamePreferences, type GameState } from '../lib/business-empire/types'

const rng = () => 0.5

const preferences: GamePreferences = {
  companyName: 'Northbridge Apparel',
  founderName: 'Test Founder',
  industry: 'Clothing',
  difficulty: 'beginner',
  startingCash: 25_000,
  learningSupport: 'full',
  reducedMotion: false,
}

function freshState(): GameState {
  return createInitialState(preferences, rng)
}

// ============================================================================
// Cash ledger integrity
// ============================================================================

// 1. Founding a company records exactly one STARTING_CAPITAL transaction and cash matches it.
{
  const state = freshState()
  assert.equal(state.cash, preferences.startingCash)
  assert.equal(state.cashLedger.length, 1)
  assert.equal(state.cashLedger[0].category, 'STARTING_CAPITAL')
  assert.equal(state.cashLedger[0].amount, preferences.startingCash)
  assert.ok(verifyLedgerIntegrity(state).ok)
}

// 2. Creating a product charges exactly production cost + R&D, nothing more or less.
{
  const state = freshState()
  const cashBefore = state.cash
  const result = createProduct(state, {
    name: 'Everyday Comfort Tee',
    targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id,
    quality: 'standard',
    features: [],
    rndBudget: 200,
    unitsToManufacture: 500,
    productionMethod: 'standard-factory',
    packagingQuality: 'standard',
    price: 40,
  })
  assert.equal(result.error, undefined)
  const product = result.product!
  const newEntries = result.state.cashLedger.slice(1) // everything after the STARTING_CAPITAL seed entry
  assert.equal(newEntries.length, 2, 'creating a product with both R&D and units logs exactly two new transactions')
  const researchEntry = newEntries.find((entry) => entry.category === 'RESEARCH_COST')!
  const productionEntry = newEntries.find((entry) => entry.category === 'PRODUCTION_COST')!
  assert.equal(researchEntry.amount, -200, 'R&D is charged exactly the entered budget')
  assert.equal(Math.round((productionEntry.amount + product.costPerUnit * 500) * 100) / 100, 0, 'production is charged exactly cost-per-unit x units manufactured')
  assert.equal(cashBefore + newEntries.reduce((sum, entry) => sum + entry.amount, 0), result.state.cash, 'cash after equals cash before plus every new ledger entry, nothing more')
  assert.ok(verifyLedgerIntegrity(result.state).ok)
  assert.equal(sumCashLedger(result.state), result.state.cash)
}

// 3. Manufacturing more units charges exactly cost-per-unit x units.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Basic Hoodie', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 0, unitsToManufacture: 100, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 45,
  })
  const product = created.product!
  const cashBefore = created.state.cash
  const manufactured = manufactureMoreUnits(created.state, product.id, 50)
  assert.equal(manufactured.error, undefined)
  const updatedProduct = manufactured.state.products.find((p) => p.id === product.id)!
  assert.equal(updatedProduct.unitsManufactured, 150)
  assert.ok(cashBefore - manufactured.state.cash > 0, 'manufacturing more units costs cash')
  assert.ok(verifyLedgerIntegrity(manufactured.state).ok)
}

// 4. Updating a product's price never changes cash.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Classic Jeans', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 0, unitsToManufacture: 100, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 60,
  })
  const cashBefore = created.state.cash
  const repriced = updateProductPrice(created.state, created.product!.id, 75)
  assert.equal(repriced.error, undefined)
  assert.equal(repriced.state.cash, cashBefore, 'changing price does not touch cash')
}

// 5. Purchasing research charges exactly its listed cost.
{
  const state = freshState()
  const cashBefore = state.cash
  const groupId = getIndustryProfile('Clothing').customerGroups[0].id
  const result = purchaseResearch(state, 'standard', groupId)
  assert.equal(result.error, undefined)
  const cost = cashBefore - result.state.cash
  assert.ok(cost > 0)
  assert.equal(result.state.cashLedger[result.state.cashLedger.length - 1].category, 'RESEARCH_COST')
  assert.equal(result.state.cashLedger[result.state.cashLedger.length - 1].amount, -cost)
}

// 6. Launching an advertising campaign charges exactly its budget.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Weekend Jacket', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 0, unitsToManufacture: 100, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 80,
  })
  const cashBefore = created.state.cash
  const launched = launchAdvertisingCampaign(created.state, created.product!.id, 'social-media', 500)
  assert.equal(launched.error, undefined)
  assert.equal(cashBefore - launched.state.cash, 500, 'advertising charges exactly the chosen budget')
}

// 7. Discontinuing a product never changes cash.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Seasonal Scarf', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 0, unitsToManufacture: 50, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 25,
  })
  const cashBefore = created.state.cash
  const discontinued = discontinueProduct(created.state, created.product!.id)
  assert.equal(discontinued.cash, cashBefore)
  assert.ok(discontinued.products.find((p) => p.id === created.product!.id)!.discontinued)
}

console.log('Business Empire per-action ledger tests passed')

// ============================================================================
// Yearly close-out accounting identities
// ============================================================================

// 8. Gross profit = revenue - cost of goods sold, exactly.
// 9. Net profit = revenue - total expenses, exactly.
// 10. Ledger integrity holds after a year completes (cash === sum of ledger).
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Everyday Tee', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 500, unitsToManufacture: 1000, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 40,
  })
  const advertised = launchAdvertisingCampaign(created.state, created.product!.id, 'social-media', 500)
  const { state: afterYear, report } = completeFinancialYear(advertised.state, rng)

  const totalCostOfGoodsSold = report.perProduct.reduce((sum, row) => sum + row.costOfGoodsSold, 0)
  assert.equal(Math.round(report.grossProfit * 100) / 100, Math.round((report.totalRevenue - totalCostOfGoodsSold) * 100) / 100, 'gross profit is exactly revenue minus cost of goods sold (units sold only, not units produced)')
  assert.equal(Math.round(report.totalExpenses * 100) / 100, Math.round((report.productionCosts + report.researchCosts + report.advertisingCosts + report.wages + report.rent + report.operatingCosts + report.loanRepayments + report.taxes + report.refunds) * 100) / 100, 'totalExpenses is exactly the sum of its listed parts')
  assert.equal(Math.round(report.netProfit * 100) / 100, Math.round((report.totalRevenue - report.totalExpenses) * 100) / 100, 'net profit is exactly revenue minus total expenses')
  assert.equal(afterYear.cash, sumCashLedger(afterYear), 'cash equals the sum of the entire ledger after a year completes')
  assert.ok(verifyLedgerIntegrity(afterYear).ok)
  assert.equal(afterYear.year, state.year + 1, 'year advances by exactly one')
}

// 11. Completing a year with zero products still balances the books (only rent + wages leave, no revenue).
{
  const state = freshState()
  const cashBefore = state.cash
  const { state: afterYear, report } = completeFinancialYear(state, rng)
  assert.equal(report.totalRevenue, 0)
  assert.equal(report.unitsProduced, 0)
  assert.equal(afterYear.cash, cashBefore - report.rent - report.wages - report.taxes - report.refunds)
  assert.ok(verifyLedgerIntegrity(afterYear).ok)
}

// 12. Discount-clearing unsold inventory converts it to cash at exactly half price, and zeroes inventory.
// Inventory is set directly (rather than relying on the demand model to produce a stockout) so this
// test isolates the inventory-action ledger behavior from the separately-tested demand formula.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Overstock Shirt', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'budget',
    features: [], rndBudget: 0, unitsToManufacture: 300, productionMethod: 'standard-factory', packagingQuality: 'basic', price: 40,
  })
  assert.equal(created.error, undefined, 'setup: the affordable production run must succeed')
  const withLeftoverInventory: GameState = {
    ...created.state,
    products: created.state.products.map((p) => (p.id === created.product!.id ? { ...p, inventory: 150, unitsManufactured: 0 } : p)),
  }

  const cashBefore = withLeftoverInventory.cash
  const discounted = applyUnsoldInventoryAction(withLeftoverInventory, created.product!.id, 'discount')
  assert.equal(discounted.error, undefined)
  const clearedProduct = discounted.state.products.find((p) => p.id === created.product!.id)!
  assert.equal(clearedProduct.inventory, 0, 'discount clears all remaining inventory')
  const expectedRevenue = 150 * (created.product!.price * 0.5)
  assert.equal(Math.round((discounted.state.cash - cashBefore) * 100) / 100, Math.round(expectedRevenue * 100) / 100, 'discount sale adds exactly units x half price to cash')
}

// 13. Disposing of unsold inventory zeroes it and charges a documented (not unexplained) cost.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Overstock Cap', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'budget',
    features: [], rndBudget: 0, unitsToManufacture: 300, productionMethod: 'standard-factory', packagingQuality: 'basic', price: 40,
  })
  assert.equal(created.error, undefined, 'setup: the affordable production run must succeed')
  const withLeftoverInventory: GameState = {
    ...created.state,
    products: created.state.products.map((p) => (p.id === created.product!.id ? { ...p, inventory: 150, unitsManufactured: 0 } : p)),
  }
  const disposed = applyUnsoldInventoryAction(withLeftoverInventory, created.product!.id, 'dispose')
  assert.equal(disposed.error, undefined)
  assert.equal(disposed.state.products.find((p) => p.id === created.product!.id)!.inventory, 0)
  const lastEntry = disposed.state.cashLedger[disposed.state.cashLedger.length - 1]
  assert.equal(lastEntry.category, 'OTHER_EXPENSE', 'disposal cost is recorded under a real category, not left unexplained')
  assert.ok(lastEntry.amount < 0)
}

console.log('Business Empire yearly close-out tests passed')

// ============================================================================
// Demand sanity + no-unexplained-money guarantees
// ============================================================================

// 14. Lowering price (all else equal) never decreases estimated demand.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Price Test Shirt', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 0, unitsToManufacture: 1000, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 100,
  })
  const product = created.state.products.find((p) => p.id === created.product!.id)!
  const industry = getIndustryProfile('Clothing')
  const difficulty = DIFFICULTY_PROFILES.beginner
  const qualityScore = computeQualityScore(industry, product)
  const demandArgs = { qualityScore, industry, competitors: created.state.competitors, brandReputation: created.state.brandReputation, customerSatisfaction: created.state.customerSatisfaction, economicIndex: 1, difficulty, advertisingReach: 0, demandEventMultiplier: 1, isFirstYearForCompany: true, rng }
  const demandHighPrice = computeDemand({ ...demandArgs, product: { ...product, price: 150 } })
  const demandLowPrice = computeDemand({ ...demandArgs, product: { ...product, price: 50 } })
  assert.ok(demandLowPrice >= demandHighPrice, 'a lower price never produces lower estimated demand than a higher one, all else equal')
}

// 15. Reloading a saved state (a JSON round trip) never duplicates or changes cash.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Reload Test Shirt', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 0, unitsToManufacture: 200, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 45,
  })
  const reloaded = JSON.parse(JSON.stringify(created.state)) as GameState
  assert.equal(reloaded.cash, created.state.cash)
  assert.equal(sumCashLedger(reloaded), reloaded.cash)
}

// 16. Multiple consecutive years with no player action still keep cash exactly explained by the ledger (rent/wages/tax only, never a bare top-up).
{
  let state = freshState()
  for (let i = 0; i < 3; i++) {
    const result = completeFinancialYear(state, rng)
    state = result.state
    assert.ok(verifyLedgerIntegrity(state).ok, `ledger stays exact through year ${i + 1} with no player action`)
  }
  assert.equal(state.year, 4)
}

console.log('Business Empire demand + integrity tests passed')

// ============================================================================
// Reputation system, Hardcore Mode, and save migration
// ============================================================================

// 17. Founding a company records a reputation transaction whose after-value matches brandReputation, and it always carries a non-empty reason.
{
  const state = freshState()
  assert.ok(state.reputationHistory.length >= 1, 'founding a company logs at least one reputation transaction')
  const founding = state.reputationHistory[0]
  assert.equal(founding.reasonCategory, 'COMPANY_FOUNDED')
  assert.ok(founding.description.length > 0, 'a reputation transaction always carries a non-empty explanation')
  assert.equal(founding.valueAfter, state.brandReputation)
  assert.ok(verifyReputationIntegrity(state).ok, 'reputation history sums exactly to brandReputation')
  assert.ok(state.brandReputation >= 30 && state.brandReputation <= 50, 'a new company starts in the 30-50 band, never with an already-excellent reputation')
}

// 18. appendReputationTransaction always clamps to 0-100 and never silently drops the reason.
{
  const state = freshState()
  const boosted = appendReputationTransaction(state, { delta: 1000, reasonCategory: 'RELIABLE_PRODUCT', description: 'Test boost' })
  assert.equal(boosted.brandReputation, 100, 'reputation is clamped at 100 even if a delta would overshoot')
  const lastEntry = boosted.reputationHistory[boosted.reputationHistory.length - 1]
  assert.equal(lastEntry.description, 'Test boost')
  assert.equal(lastEntry.reasonCategory, 'RELIABLE_PRODUCT')
  assert.ok(verifyReputationIntegrity(boosted).ok)

  const crashed = appendReputationTransaction(state, { delta: -1000, reasonCategory: 'SCANDAL', description: 'Test crash' })
  assert.equal(crashed.brandReputation, 0, 'reputation is clamped at 0 even if a delta would undershoot')
}

// 19. Demand responds to reputation: a higher-reputation company never sees lower estimated demand than a lower-reputation one, all else equal.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'Reputation Test Shirt', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 0, unitsToManufacture: 1000, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 45,
  })
  const product = created.state.products.find((p) => p.id === created.product!.id)!
  const industry = getIndustryProfile('Clothing')
  const difficulty = DIFFICULTY_PROFILES.beginner
  const qualityScore = computeQualityScore(industry, product)
  const demandArgs = { product, qualityScore, industry, competitors: created.state.competitors, customerSatisfaction: created.state.customerSatisfaction, economicIndex: 1, difficulty, advertisingReach: 0, demandEventMultiplier: 1, isFirstYearForCompany: true, rng }
  const demandLowReputation = computeDemand({ ...demandArgs, brandReputation: 20 })
  const demandHighReputation = computeDemand({ ...demandArgs, brandReputation: 90 })
  assert.ok(demandHighReputation >= demandLowReputation, 'higher reputation never produces lower estimated demand than lower reputation, all else equal')
}

// 20. A low-reliability product in a recall-prone industry can trigger a recall; a high-reliability product never does.
{
  const carsIndustry = getIndustryProfile('Cars')
  assert.ok(carsIndustry.challengeProfile.recallRisk > 0, 'setup: Cars must have a nonzero recall risk for this test to be meaningful')
  assert.equal(checkForProductRecall(10, carsIndustry, () => 0), true, 'a very low-reliability product can be recalled when the risk roll succeeds')
  assert.equal(checkForProductRecall(10, carsIndustry, () => 0.999), false, 'the same low-reliability product is not recalled when the risk roll fails')
  assert.equal(checkForProductRecall(95, carsIndustry, () => 0), false, 'a high-reliability product is never recalled regardless of the risk roll')
}

// 21. A product recall reputation transaction is negative and fully explained (the concrete mechanic behind "defects can lower reputation").
{
  const state = freshState()
  const recalled = appendReputationTransaction(state, { delta: -10, reasonCategory: 'PRODUCT_RECALL', description: 'Test Product was recalled after a quality defect was discovered.' })
  assert.ok(recalled.brandReputation < state.brandReputation, 'a product recall strictly lowers company reputation')
  const entry = recalled.reputationHistory[recalled.reputationHistory.length - 1]
  assert.equal(entry.reasonCategory, 'PRODUCT_RECALL')
  assert.ok(entry.description.includes('recalled'), 'the recall reputation entry explains itself in plain language')
}

// 22. Hardcore Mode career savings are a deterministic function of job and years worked (no dice roll decides how much a player saves).
{
  const job = getHardcoreJob('retail-assistant')!
  const savingsA = computeCareerSavings(job, 3)
  const savingsB = computeCareerSavings(job, 3)
  assert.equal(savingsA, savingsB, 'career savings are deterministic for the same job and years worked')
  assert.equal(computeCareerSavings(job, 0), 0, 'working zero years saves nothing')
  assert.ok(computeCareerSavings(job, 5) > computeCareerSavings(job, 2), 'working more years always saves at least as much (raises compound upward)')
}

// 22b. The player never picks a job — it is assigned deterministically from the quiz-driven university quality. A higher score never lands a worse-paying job than a lower score in the same degree.
{
  const weakJob = assignJobByDegreeQuality('engineering', 10)
  const strongJob = assignJobByDegreeQuality('engineering', 95)
  assert.ok(strongJob.annualSalary >= weakJob.annualSalary, 'a stronger university placement never results in a worse-paying assigned job for the same degree')
  assert.equal(assignJobByDegreeQuality('engineering', 50).id, assignJobByDegreeQuality('engineering', 50).id, 'the same degree and quality always assign the exact same job')
  assert.equal(scoreEntranceQuiz(UNIVERSITY_ENTRANCE_QUIZ.map((q) => q.correctIndex)), 100, 'answering every quiz question correctly scores exactly 100')
  assert.equal(scoreEntranceQuiz(UNIVERSITY_ENTRANCE_QUIZ.map(() => -1)), 0, 'answering every quiz question wrong scores exactly 0')
}

// 23. Founding a company in Hardcore Mode uses the career-savings amount as starting cash (ignoring any stale preferences.startingCash value), keeps the ledger exact, and ages the founder correctly.
{
  const universityQuality = 80
  const degree: CareerBackground['degree'] = 'engineering'
  const yearsWorked = 3
  const job = assignJobByDegreeQuality(degree, universityQuality)
  const careerBackground: CareerBackground = { universityQuality, degree, jobId: job.id, yearsWorked, totalSavings: computeCareerSavings(job, yearsWorked), foundingAge: computeFoundingAge(degree, yearsWorked) }
  const hardcorePrefs: GamePreferences = { ...preferences, difficulty: 'hardcore', startingCash: 999_999, careerBackground }
  const hardcoreState = createInitialState(hardcorePrefs, rng)
  assert.equal(hardcoreState.cash, careerBackground.totalSavings, 'starting cash is recomputed from the career background, not trusted from preferences.startingCash')
  assert.equal(careerBackground.foundingAge, 16 + 3 + 3, 'founding age is starting age (16) + university years (3, since a degree was studied) + years worked')
  assert.ok(verifyLedgerIntegrity(hardcoreState).ok)
  assert.ok(verifyReputationIntegrity(hardcoreState).ok)
}

// 24. The degree-industry relevance bonus applies only when the degree is actually relevant to the founded industry.
{
  assert.equal(isDegreeRelevantToIndustry('engineering', 'Technology'), true)
  assert.equal(isDegreeRelevantToIndustry('engineering', 'Restaurants'), false)

  const relevantJob = assignJobByDegreeQuality('engineering', 70)
  const relevantPrefs: GamePreferences = {
    ...preferences, industry: 'Technology', difficulty: 'hardcore', startingCash: 0,
    careerBackground: { universityQuality: 70, degree: 'engineering', jobId: relevantJob.id, yearsWorked: 2, totalSavings: computeCareerSavings(relevantJob, 2), foundingAge: computeFoundingAge('engineering', 2) },
  }
  const relevantState = createInitialState(relevantPrefs, rng)

  const irrelevantJob = assignJobByDegreeQuality('engineering', 70)
  const irrelevantPrefs: GamePreferences = {
    ...preferences, industry: 'Restaurants', difficulty: 'hardcore', startingCash: 0,
    careerBackground: { universityQuality: 70, degree: 'engineering', jobId: irrelevantJob.id, yearsWorked: 2, totalSavings: computeCareerSavings(irrelevantJob, 2), foundingAge: computeFoundingAge('engineering', 2) },
  }
  const irrelevantState = createInitialState(irrelevantPrefs, rng)

  assert.ok(relevantState.brandReputation > irrelevantState.brandReputation, 'a degree relevant to the founded industry grants a real, explained reputation bonus that an irrelevant degree does not')
  assert.ok(relevantState.reputationHistory.some((entry) => entry.description.includes('relevant to')), 'the degree bonus is explained in the reputation history, never a silent number')
}

// 25. A save from the pre-reputation-system format (version 1) migrates into a valid, ledger-intact current-version state — existing Business Mode saves keep working.
{
  const legacyState = freshState()
  const legacyProduct = createProduct(legacyState, {
    name: 'Legacy Product', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 0, unitsToManufacture: 100, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 40,
  }).state

  // Simulate what a real version-1 save looked like: no reputationHistory, no loans, no per-product review fields, saveVersion 1.
  const legacyRaw: Record<string, unknown> = JSON.parse(JSON.stringify(legacyProduct))
  legacyRaw.saveVersion = 1
  delete legacyRaw.reputationHistory
  delete legacyRaw.staffMorale
  delete legacyRaw.loans
  delete legacyRaw.economicCyclePhase
  for (const product of legacyRaw.products as Record<string, unknown>[]) {
    delete product.rating
    delete product.reviews
    delete product.reliability
    delete product.returnRate
    delete product.complaintRate
    delete product.awareness
    delete product.customerLoyalty
    delete product.lastRelaunchedYear
  }

  const migrated = migrateLegacySave(legacyRaw)
  assert.ok(migrated, 'a version-1-shaped save migrates successfully rather than being discarded')
  assert.equal(migrated!.cash, legacyProduct.cash, 'cash is carried over exactly, unchanged by migration')
  assert.equal(migrated!.brandReputation, legacyProduct.brandReputation, 'the reputation score itself is carried over exactly, unchanged by migration')
  assert.equal(migrated!.saveVersion, CURRENT_SAVE_VERSION)
  assert.ok(verifyLedgerIntegrity(migrated!).ok, 'migration never creates unexplained money')
  assert.ok(verifyReputationIntegrity(migrated!).ok, 'migration never creates unexplained reputation')
  assert.equal(migrated!.reputationHistory.length, 1, 'migration seeds exactly one transparent "save upgraded" reputation entry')
  assert.equal(migrated!.reputationHistory[0].reasonCategory, 'SAVE_MIGRATION')
  assert.equal(migrated!.products[0].reviews.length, 0, 'migrated products start with an empty review list, not fabricated history')
  assert.ok(migrated!.products[0].reliability >= 0 && migrated!.products[0].reliability <= 100, 'migrated products get a sensible backfilled reliability, not a zero pretending to be real')
}

console.log('Business Empire reputation, Hardcore Mode, and migration tests passed')
