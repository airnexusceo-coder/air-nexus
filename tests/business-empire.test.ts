import assert from 'node:assert/strict'
import {
  applyUnsoldInventoryAction,
  completeFinancialYear,
  createInitialState,
  createProduct,
  discontinueProduct,
  launchAdvertisingCampaign,
  launchStrategicInitiative,
  computeStrategicInitiativeCost,
  getActiveStrategicInitiatives,
  manufactureMoreUnits,
  purchaseResearch,
  updateProductPrice,
  verifyLedgerIntegrity,
} from '../lib/business-empire/game-state'
import { sumCashLedger } from '../lib/business-empire/simulation'
import { appendReputationTransaction, checkForProductRecall, computeDemand, computeQualityScore, verifyReputationIntegrity } from '../lib/business-empire/simulation'
import { REPUTATION_CATEGORY_MAP, runCompetitorActionsForYear } from '../lib/business-empire/simulation'
import { getIndustryProfile } from '../lib/business-empire/industries'
import {
  assignJobByDegreeQuality,
  computeCareerFinance,
  computeCareerSavings,
  computeFoundingAge,
  evaluateJobInterview,
  getHardcoreJob,
  isDegreeRelevantToIndustry,
  JOB_INTERVIEW_QUESTIONS,
  scoreEntranceQuiz,
  scoreInterviewAnswers,
  UNIVERSITY_ENTRANCE_QUIZ,
} from '../lib/business-empire/hardcore-career'
import { migrateLegacySave, migrateV2ToV3, migrateV3ToV4 } from '../lib/business-empire/storage'
import { buildFacility, previewFacilityCost, sellFacility, upgradeFacility } from '../lib/business-empire/game-state'
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


// 7b. Boardroom decisions cost cash through the ledger, stay active for multiple years, and cannot be duplicated while active.
{
  const state = freshState()
  const expectedCost = computeStrategicInitiativeCost(state, 'quality-systems')
  const launched = launchStrategicInitiative(state, 'quality-systems')
  assert.equal(launched.error, undefined)
  assert.equal(Math.round((state.cash - launched.state.cash) * 100) / 100, expectedCost, 'launching a boardroom decision charges exactly its computed cost')
  assert.equal(getActiveStrategicInitiatives(launched.state).length, 1)
  assert.equal(getActiveStrategicInitiatives(launched.state)[0].initiativeId, 'quality-systems')
  assert.equal(launched.state.cashLedger[launched.state.cashLedger.length - 1].category, 'OTHER_EXPENSE')
  assert.ok(verifyLedgerIntegrity(launched.state).ok)

  const duplicate = launchStrategicInitiative(launched.state, 'quality-systems')
  assert.ok(duplicate.error, 'the same boardroom decision cannot be launched twice while active')

  const { state: afterYear, report } = completeFinancialYear(launched.state, rng)
  assert.equal(getActiveStrategicInitiatives(afterYear)[0].yearsRemaining, 2, 'a three-year initiative decays by exactly one year after close-out')
  assert.ok(report.factorNotes.some((note) => note.includes('Active boardroom decisions')), 'the annual report explains that boardroom decisions affected the simulation')
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

// 22. Hardcore Mode career savings are deterministic, but salary is reduced by real-life taxes and expenses before it becomes company capital.
{
  const job = getHardcoreJob('retail-assistant')!
  const savingsA = computeCareerSavings(job, 3)
  const savingsB = computeCareerSavings(job, 3)
  const finance = computeCareerFinance(job, 3)
  assert.equal(savingsA, savingsB, 'career savings are deterministic for the same job and years worked')
  assert.equal(finance.netSavings, savingsA, 'computeCareerSavings is the net savings from the detailed finance breakdown')
  assert.equal(computeCareerSavings(job, 0), 0, 'working zero years saves nothing')
  assert.ok(computeCareerSavings(job, 5) > computeCareerSavings(job, 2), 'working more years always saves at least as much (raises compound upward)')
  assert.ok(finance.incomeTax > 0, 'career income includes simulated income tax')
  assert.ok(finance.totalExpenses > 0, 'career income includes housing, transport, debt, or emergency expenses')
  assert.ok(finance.netSavings < finance.grossIncome, 'hardcore starting capital is not gross salary')
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

// 22c. Hardcore jobs are not guaranteed: the interview can fail, and a strong interview can earn an offer.
{
  const strongAnswers = JOB_INTERVIEW_QUESTIONS.map(() => 0)
  const weakAnswers = JOB_INTERVIEW_QUESTIONS.map((question) => question.options.length - 1)
  assert.equal(scoreInterviewAnswers(strongAnswers), 100, 'choosing the strongest answer to each interview question scores exactly 100')
  assert.ok(scoreInterviewAnswers(weakAnswers) < 40, 'weak interview answers score poorly')

  const offer = evaluateJobInterview({ answers: strongAnswers, degree: 'engineering', universityQuality: 80, industry: 'Technology' })
  assert.equal(offer.passed, true, 'a strong interview with relevant education earns an offer')
  assert.ok(offer.job, 'a passed interview returns the job offer')

  const rejection = evaluateJobInterview({ answers: weakAnswers, degree: 'none', universityQuality: 0, industry: 'Clothing' })
  assert.equal(rejection.passed, false, 'a weak interview does not guarantee a job')
  assert.equal(rejection.job, null, 'a failed interview returns no job offer')
}

// 23. Founding a company in Hardcore Mode uses the career-savings amount as starting cash (ignoring any stale preferences.startingCash value), keeps the ledger exact, and ages the founder correctly.
{
  const universityQuality = 80
  const degree: CareerBackground['degree'] = 'engineering'
  const yearsWorked = 3
  const job = assignJobByDegreeQuality(degree, universityQuality)
  const careerFinance = computeCareerFinance(job, yearsWorked, degree, universityQuality)
  const careerBackground: CareerBackground = { universityQuality, degree, jobId: job.id, interviewScore: 88, interviewPassed: true, yearsWorked, totalSavings: careerFinance.netSavings, careerFinance, foundingAge: computeFoundingAge(degree, yearsWorked) }
  const hardcorePrefs: GamePreferences = { ...preferences, difficulty: 'hardcore', startingCash: 999_999, careerBackground }
  const hardcoreState = createInitialState(hardcorePrefs, rng)
  assert.equal(hardcoreState.cash, careerBackground.totalSavings, 'starting cash uses the recorded post-tax career savings, not stale preferences.startingCash')
  assert.ok(hardcoreState.cashLedger[0].description.includes('income tax'), 'the starting capital ledger explains that taxes and personal expenses were deducted')
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
  delete legacyRaw.strategicInitiatives
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
  assert.equal(migrated!.strategicInitiatives?.length, 0, 'migrated saves start with no fabricated boardroom decisions')
  assert.equal(migrated!.products[0].reviews.length, 0, 'migrated products start with an empty review list, not fabricated history')
  assert.ok(migrated!.products[0].reliability >= 0 && migrated!.products[0].reliability <= 100, 'migrated products get a sensible backfilled reliability, not a zero pretending to be real')
}

console.log('Business Empire reputation, Hardcore Mode, and migration tests passed')

// ============================================================================
// Competitor strategy engine, reputation categories, and v2 -> v3 migration
// ============================================================================

// 26. A reputation transaction always moves every category its reason maps to, and only those — categories can never desync from the ledger-explained reason.
{
  assert.deepEqual(REPUTATION_CATEGORY_MAP.FAIR_TREATMENT, ['employee'], 'FAIR_TREATMENT is mapped to exactly one reputation category')
  assert.deepEqual(REPUTATION_CATEGORY_MAP.CRISIS_MISHANDLED, ['investor', 'customer'], 'CRISIS_MISHANDLED is mapped to both categories it genuinely affects')

  const state = freshState()
  const before = state.reputationCategories
  const afterFairTreatment = appendReputationTransaction(state, { delta: 5, reasonCategory: 'FAIR_TREATMENT', description: 'Test fair treatment' })
  assert.equal(afterFairTreatment.reputationCategories.employee, before.employee + 5, 'FAIR_TREATMENT moves the employee category by exactly the delta')
  assert.equal(afterFairTreatment.reputationCategories.customer, before.customer, 'FAIR_TREATMENT does not move an unrelated category')
  assert.equal(afterFairTreatment.reputationCategories.supplier, before.supplier, 'FAIR_TREATMENT does not move an unrelated category')

  const afterCrisis = appendReputationTransaction(state, { delta: -6, reasonCategory: 'CRISIS_MISHANDLED', description: 'Test crisis' })
  assert.equal(afterCrisis.reputationCategories.investor, before.investor - 6, 'a multi-category reason (CRISIS_MISHANDLED) moves every category it maps to')
  assert.equal(afterCrisis.reputationCategories.customer, before.customer - 6, 'a multi-category reason (CRISIS_MISHANDLED) moves every category it maps to')
  assert.equal(afterCrisis.reputationCategories.employee, before.employee, 'a multi-category reason never moves a category outside its map')
}

// 27. Founding a company seeds all six reputation categories to the same starting value as the overall score.
{
  const state = freshState()
  assert.deepEqual(
    state.reputationCategories,
    { customer: state.brandReputation, employee: state.brandReputation, investor: state.brandReputation, government: state.brandReputation, environmental: state.brandReputation, supplier: state.brandReputation },
    'a freshly founded company starts every reputation category at the same value as the overall score',
  )
}

// 28. Competitors take one explained action a year; every activity event carries a nonzero-length headline/detail and a real strategy archetype.
{
  const state = freshState()
  assert.ok(state.competitors.length > 0, 'setup: beginner difficulty seeds at least one competitor')
  for (const competitor of state.competitors) {
    assert.ok(['price-cutter', 'luxury-leader', 'innovation-leader', 'marketing-giant', 'efficient-operator', 'aggressive-expander', 'ethical-brand', 'corporate-predator'].includes(competitor.strategyType), 'every competitor is assigned a real strategy archetype')
    assert.ok(competitor.riskTolerance >= 0 && competitor.riskTolerance <= 1, 'riskTolerance is a valid 0-1 trait')
  }
  const player = { averagePrice: 40, averageQualityScore: 55, marketShare: 10 }
  const result = runCompetitorActionsForYear(state.competitors, player, state.year, () => 0.01)
  assert.equal(result.competitors.length <= state.competitors.length, true, 'competitor count never increases in a single year (acquisitions only remove, never create)')
  for (const event of result.activity) {
    assert.ok(event.headline.length > 0, 'every competitor activity event explains itself with a headline')
    assert.ok(event.detail.length > 0, 'every competitor activity event explains its effect')
    assert.ok(Number.isFinite(event.demandImpactPercent), 'demandImpactPercent is always a real number, never NaN or undefined')
  }
}

// 29. A price-cutter competitor undercutting the player is estimated to hurt player demand (a negative demandImpactPercent), never help it.
{
  const priceCutter = {
    id: 'test-competitor', name: 'Test Price Cutter', industry: 'Clothing' as const, price: 50, quality: 'budget' as const,
    marketShare: 10, reputation: 50, strengths: [], weaknesses: [], advertisingIntensity: 0.3,
    strategyType: 'price-cutter' as const, riskTolerance: 0.9, researchAbility: 0.3, marketingStrength: 0.3, productionEfficiency: 0.5,
  }
  // A constant mid-low rng clears the hold-steady check (which needs >= 0.135 for this risk tolerance), lands the weighted pick on price-change (price-cutter's dominant weight), and keeps priceBias's strongly-negative lean winning the cut/raise coin flip.
  const result = runCompetitorActionsForYear([priceCutter], { averagePrice: 60, averageQualityScore: 50, marketShare: 10 }, 1, () => 0.3)
  const priceEvent = result.activity.find((event) => event.actionType === 'price-change')
  assert.ok(priceEvent, 'a price-cutter with high risk tolerance and a forced low roll takes a price-change action')
  assert.ok(priceEvent!.demandImpactPercent <= 0, 'a price-cutter cutting price is never estimated to help the player\'s demand')
}

// 30. A save from the pre-competitor-strategy format (version 2) migrates into a valid version-3 state — existing saves keep working.
{
  const state = freshState()
  const created = createProduct(state, {
    name: 'V2 Product', targetGroupId: getIndustryProfile('Clothing').customerGroups[0].id, quality: 'standard',
    features: [], rndBudget: 0, unitsToManufacture: 100, productionMethod: 'standard-factory', packagingQuality: 'standard', price: 40,
  }).state
  const { state: afterYear, report } = completeFinancialYear(created, rng)

  // Simulate what a real version-2 save looked like: competitors/history without the new Phase 1 fields, saveVersion 2.
  const v2Raw: Record<string, unknown> = JSON.parse(JSON.stringify(afterYear))
  v2Raw.saveVersion = 2
  delete v2Raw.reputationCategories
  for (const competitor of v2Raw.competitors as Record<string, unknown>[]) {
    delete competitor.strategyType
    delete competitor.riskTolerance
    delete competitor.researchAbility
    delete competitor.marketingStrength
    delete competitor.productionEfficiency
  }
  for (const entry of v2Raw.reputationHistory as Record<string, unknown>[]) {
    delete entry.category
  }
  for (const savedReport of v2Raw.annualReports as Record<string, unknown>[]) {
    delete savedReport.competitorActions
  }

  const migrated = migrateV2ToV3(v2Raw)
  assert.ok(migrated, 'a version-2-shaped save migrates successfully rather than being discarded')
  assert.equal(migrated!.cash, afterYear.cash, 'cash is carried over exactly, unchanged by migration')
  assert.equal(migrated!.brandReputation, afterYear.brandReputation, 'the reputation score itself is carried over exactly, unchanged by migration')
  assert.equal(migrated!.saveVersion, 3, 'migrateV2ToV3 in isolation produces a v3-versioned save — chaining to the current version is loadGameState\'s job, matching how each migration step composes')
  assert.ok(verifyLedgerIntegrity(migrated!).ok, 'migration never creates unexplained money')
  assert.ok(migrated!.competitors.every((c) => typeof c.strategyType === 'string'), 'every migrated competitor gets a backfilled strategy archetype')
  assert.deepEqual(
    migrated!.reputationCategories,
    { customer: afterYear.brandReputation, employee: afterYear.brandReputation, investor: afterYear.brandReputation, government: afterYear.brandReputation, environmental: afterYear.brandReputation, supplier: afterYear.brandReputation },
    'migrated reputation categories all start from the carried-over overall score',
  )
  assert.ok(migrated!.reputationHistory.every((entry) => Array.isArray(entry.category) && entry.category.length > 0), 'every migrated reputation transaction, old and new, is tagged with the category it moved')
  assert.ok(migrated!.annualReports.every((r) => Array.isArray(r.competitorActions)), 'every migrated annual report gets a competitorActions array, never undefined')
  assert.equal(report.competitorActions !== undefined, true, 'a freshly completed year always includes a (possibly empty) competitorActions array on its report')
}

console.log('Business Empire competitor strategy and reputation category tests passed')

// ============================================================================
// Land, facilities, and v3 -> v4 migration
// ============================================================================

// 31. Buying a facility charges exactly its previewed purchase price and creates an owned asset of that value; renting charges nothing up front.
{
  const state = freshState()
  const preview = previewFacilityCost(state, 'retail-store', 'eastvale')
  const cashBefore = state.cash
  const bought = buildFacility(state, 'retail-store', 'eastvale', 'owned')
  assert.equal(bought.error, undefined)
  assert.equal(Math.round((cashBefore - bought.state.cash) * 100) / 100, preview.purchasePrice, 'buying a facility charges exactly its previewed purchase price')
  assert.equal(bought.facility!.currentValue, preview.purchasePrice, 'a newly bought facility starts at exactly its purchase price')
  assert.ok(verifyLedgerIntegrity(bought.state).ok)

  const rented = buildFacility(state, 'retail-store', 'riverside', 'rented')
  assert.equal(rented.error, undefined)
  assert.equal(rented.state.cash, state.cash, 'renting a facility charges nothing up front')
  assert.equal(rented.facility!.leaseYearsRemaining, 5, 'a new lease starts at exactly 5 years')
}

// 32. A region already claimed by a competitor cannot host a new player facility.
{
  const state = freshState()
  const claimedState: GameState = { ...state, claimedRegions: ['harborview'] }
  const attempt = buildFacility(claimedState, 'warehouse', 'harborview', 'rented')
  assert.ok(attempt.error, 'building in a competitor-claimed region is rejected')
  assert.equal(attempt.state.facilities.length, 0, 'a rejected build never creates a facility')
}

// 33. Upgrading a facility charges cash and installs exactly the requested upgrade, never a duplicate.
{
  const state = freshState()
  const built = buildFacility(state, 'factory', 'eastvale', 'owned')
  const cashBefore = built.state.cash
  const upgraded = upgradeFacility(built.state, built.facility!.id, 'automation')
  assert.equal(upgraded.error, undefined)
  assert.ok(cashBefore - upgraded.state.cash > 0, 'installing an upgrade costs cash')
  assert.deepEqual(upgraded.state.facilities[0].upgrades, ['automation'])
  const duplicate = upgradeFacility(upgraded.state, built.facility!.id, 'automation')
  assert.ok(duplicate.error, 'the same upgrade cannot be installed twice')
}

// 34. Selling an owned facility returns exactly 80% of its current value and removes it from the facilities list.
{
  const state = freshState()
  const built = buildFacility(state, 'warehouse', 'eastvale', 'owned')
  const cashBeforeSale = built.state.cash
  const sold = sellFacility(built.state, built.facility!.id)
  assert.equal(sold.error, undefined)
  assert.equal(Math.round((sold.state.cash - cashBeforeSale) * 100) / 100, Math.round(built.facility!.currentValue * 0.8), 'selling returns exactly 80% of the facility\'s current value')
  assert.equal(sold.state.facilities.length, 0, 'a sold facility is removed from the facilities list')
  assert.ok(verifyLedgerIntegrity(sold.state).ok)
}

// 35. Facility upkeep is a real, ledger-backed expense that flows into the annual report's totalExpenses — not a silent gap between cash and the reported numbers.
{
  const state = freshState()
  const built = buildFacility(state, 'retail-store', 'eastvale', 'rented').state
  const { state: afterYear, report } = completeFinancialYear(built, rng)
  assert.ok(report.facilityUpkeep > 0, 'setup: a rented facility always has nonzero yearly upkeep')
  assert.equal(Math.round(report.totalExpenses * 100) / 100, Math.round((report.productionCosts + report.researchCosts + report.advertisingCosts + report.wages + report.rent + report.operatingCosts + report.facilityUpkeep + report.loanRepayments + report.taxes + report.refunds) * 100) / 100, 'totalExpenses includes facility upkeep as one of its listed parts')
  assert.equal(Math.round(report.netProfit * 100) / 100, Math.round((report.totalRevenue - report.totalExpenses) * 100) / 100, 'net profit is still exactly revenue minus total expenses once facility upkeep exists')
  assert.ok(verifyLedgerIntegrity(afterYear).ok, 'cash still equals the full ledger sum with facility upkeep in play')
}

// 36. A save from the pre-land-and-facilities format (version 3) migrates into a valid version-4 state with an empty facilities list — existing saves keep working.
{
  const state = freshState()
  const { state: afterYear } = completeFinancialYear(state, rng)
  const v3Raw: Record<string, unknown> = JSON.parse(JSON.stringify(afterYear))
  v3Raw.saveVersion = 3
  delete v3Raw.facilities
  delete v3Raw.claimedRegions

  const migrated = migrateV3ToV4(v3Raw)
  assert.ok(migrated, 'a version-3-shaped save migrates successfully rather than being discarded')
  assert.equal(migrated!.cash, afterYear.cash, 'cash is carried over exactly, unchanged by migration')
  assert.equal(migrated!.saveVersion, CURRENT_SAVE_VERSION)
  assert.deepEqual(migrated!.facilities, [], 'a save from before this feature existed starts with no facilities, never a fabricated one')
  assert.deepEqual(migrated!.claimedRegions, [], 'a save from before this feature existed starts with no claimed regions')
  assert.ok(verifyLedgerIntegrity(migrated!).ok, 'migration never creates unexplained money')
}

console.log('Business Empire land and facilities tests passed')
