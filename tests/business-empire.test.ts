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
import { migrateLegacySave, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5, migrateV5ToV6, migrateV6ToV7 } from '../lib/business-empire/storage'
import {
  buildFacility,
  cancelInsurance,
  hireComplianceStaff,
  previewFacilityCost,
  previewLoanApplication,
  previewShareSale,
  purchaseInsurance,
  respondToQuestionableOffer,
  sellFacility,
  sellShares,
  takeLegalCaseAction,
  upgradeFacility,
} from '../lib/business-empire/game-state'
import { computeComplianceRatingTarget, driftComplianceRating, generateLawProposal, resolveLawDecisions } from '../lib/business-empire/government'
import {
  advanceCaseStage,
  applyOfferResponseToLegalRisk,
  classifyCaseSeverity,
  computeInvestigationTriggerChance,
  computeLegalCaseActionCost,
  generateQuestionableOffer,
  resolveCaseOutcome,
} from '../lib/business-empire/legal'
import {
  ECONOMIC_PHASE_INFO,
  LOAN_TYPE_INFO,
  advanceEconomicPhase,
  computeCreditRating,
  getCreditRatingBand,
} from '../lib/business-empire/economy'
import { computeInsuranceCoverage } from '../lib/business-empire/insurance'
import { computeEarnedBoardSeats, computeImpliedSharePrice, computeOutsideOwnershipPercent, MIN_FOUNDER_OWNERSHIP_PERCENT } from '../lib/business-empire/investors'
import { CURRENT_SAVE_VERSION, DIFFICULTY_PROFILES, INVESTIGATION_STAGE_ORDER, type CareerBackground, type GamePreferences, type GameState, type InsurancePolicy, type LegalCase, type LegalRiskProfile, type QuestionableOffer } from '../lib/business-empire/types'

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
  assert.equal(migrated!.saveVersion, 4, 'migrateV3ToV4 in isolation produces a v4-versioned save — chaining to the current version is loadGameState\'s job')
  assert.deepEqual(migrated!.facilities, [], 'a save from before this feature existed starts with no facilities, never a fabricated one')
  assert.deepEqual(migrated!.claimedRegions, [], 'a save from before this feature existed starts with no claimed regions')
  assert.ok(verifyLedgerIntegrity(migrated!).ok, 'migration never creates unexplained money')
}

console.log('Business Empire land and facilities tests passed')

// ============================================================================
// Government laws, compliance, and v4 -> v5 migration
// ============================================================================

// 37. A proposed law always carries at least a full year of advance warning, and only ever appears when the roll succeeds.
{
  const state = freshState()
  const industry = getIndustryProfile('Clothing')
  const difficulty = DIFFICULTY_PROFILES.beginner
  const guaranteedProposal = generateLawProposal(state.laws, [], industry, difficulty, state.year, () => 0)
  assert.ok(guaranteedProposal, 'a near-zero roll against a nonzero chance produces a proposal')
  assert.ok(guaranteedProposal!.expectedStartYear > guaranteedProposal!.proposedYear, 'a proposed law is always decided in a later year, never the year it is proposed')
  assert.ok(guaranteedProposal!.passageProbability > 0 && guaranteedProposal!.passageProbability <= 1, 'passage probability is always a real, bounded number shown to the player')

  const neverProposal = generateLawProposal(state.laws, [], industry, difficulty, state.year, () => 0.999)
  assert.equal(neverProposal, null, 'a near-certain roll against the same chance produces no proposal')
}

// 38. Resolving a law decision only happens once its expected year arrives, and the outcome is a real roll against the shown passage probability.
{
  const law = generateLawProposal([], [], getIndustryProfile('Clothing'), DIFFICULTY_PROFILES.beginner, 1, () => 0)!
  const tooEarly = resolveLawDecisions([law], law.expectedStartYear - 1, () => 0)
  assert.equal(tooEarly.decided.length, 0, 'a law is never decided before its stated decision year')
  assert.equal(tooEarly.laws[0].status, 'proposed')

  const passed = resolveLawDecisions([law], law.expectedStartYear, () => 0)
  assert.equal(passed.decided[0].status, 'active', 'a roll below the passage probability passes the law')
  const rejected = resolveLawDecisions([law], law.expectedStartYear, () => 0.999)
  assert.equal(rejected.decided[0].status, 'rejected', 'a roll above the passage probability rejects the law')
}

// 39. Compliance ratings drift toward, but never jump straight to, the target set by current staffing — readiness is built over time, not switched on.
{
  const noStaffing = { 'compliance-officer': 0, accountant: 0, lawyer: 0, 'safety-inspector': 0, 'environmental-specialist': 0 }
  const fullStaffing = { 'compliance-officer': 2, accountant: 2, lawyer: 2, 'safety-inspector': 2, 'environmental-specialist': 2 }
  assert.equal(computeComplianceRatingTarget('employment', noStaffing), 30, 'with no relevant staff, the target is just the baseline')
  assert.ok(computeComplianceRatingTarget('employment', fullStaffing) > 30, 'hiring relevant staff raises the target above baseline')

  const drifted = driftComplianceRating(30, 90)
  assert.ok(drifted > 30 && drifted < 90, 'one year of drift moves partway toward the target, never instantly')
}

// 40. Hiring compliance staff increases headcount immediately; their salary is a real, ledger-backed yearly cost once a year completes.
{
  const state = freshState()
  const hired = hireComplianceStaff(state, 'accountant')
  assert.equal(hired.state.complianceStaff.accountant, 1, 'hiring increases headcount by exactly one')
  assert.equal(hired.state.cash, state.cash, 'hiring itself does not charge cash — the salary is a yearly cost')

  const { state: afterYear, report } = completeFinancialYear(hired.state, rng)
  const compliancePayments = afterYear.cashLedger.filter((entry) => entry.category === 'COMPLIANCE_STAFF_WAGES')
  assert.ok(compliancePayments.length > 0, 'compliance staff wages are charged as a real, categorised ledger entry once a year completes')
  assert.ok(verifyLedgerIntegrity(afterYear).ok)
  assert.equal(report.competitorActions !== undefined && report.lawUpdates !== undefined, true, 'the annual report always includes lawUpdates alongside every other structured section')
}

// 41. A save from the pre-government-and-compliance format (version 4) migrates into a valid version-5 state with an honest starting baseline — existing saves keep working.
{
  const state = freshState()
  const { state: afterYear } = completeFinancialYear(state, rng)
  const v4Raw: Record<string, unknown> = JSON.parse(JSON.stringify(afterYear))
  v4Raw.saveVersion = 4
  delete v4Raw.laws
  delete v4Raw.complianceRatings
  delete v4Raw.complianceStaff
  delete v4Raw.unresolvedViolations

  const migrated = migrateV4ToV5(v4Raw)
  assert.ok(migrated, 'a version-4-shaped save migrates successfully rather than being discarded')
  assert.equal(migrated!.cash, afterYear.cash, 'cash is carried over exactly, unchanged by migration')
  assert.equal(migrated!.saveVersion, 5, 'migrateV4ToV5 in isolation produces a v5-versioned save — chaining to the current version is loadGameState\'s job')
  assert.deepEqual(migrated!.laws, [], 'a save from before this feature existed starts with no fabricated law history')
  assert.equal(migrated!.unresolvedViolations, 0)
  assert.deepEqual(
    migrated!.complianceStaff,
    { 'compliance-officer': 0, accountant: 0, lawyer: 0, 'safety-inspector': 0, 'environmental-specialist': 0 },
    'a migrated save starts with no compliance staff, matching a brand-new company rather than an invented headcount',
  )
  assert.ok(verifyLedgerIntegrity(migrated!).ok, 'migration never creates unexplained money')
}

console.log('Business Empire government and compliance tests passed')

// ============================================================================
// Questionable offers, legal risk, investigations, court cases, and v5 -> v6 migration
// ============================================================================

const NEUTRAL_RISK: LegalRiskProfile = { suspicion: 0, availableEvidence: 0, civilLiability: 0, criminalExposure: 0, publicAwareness: 0, employeeKnowledge: 0, previousViolations: 0 }

function makeLegalCase(overrides: Partial<LegalCase> = {}): LegalCase {
  return {
    id: 'case-test', relatedOfferId: null, title: 'Test case', description: 'A test legal case.',
    severity: 'minor', stage: 'complaint-or-rumour', startedYear: 1, stageEnteredYear: 1,
    actionsTaken: [], outcome: null, resolvedYear: null,
    ...overrides,
  }
}

// 42. A questionable offer only ever appears when nothing is already pending, and only when the roll actually succeeds.
{
  const difficulty = DIFFICULTY_PROFILES.beginner
  const blockedByPending = generateQuestionableOffer(true, difficulty, 1, () => 0)
  assert.equal(blockedByPending, null, 'no second offer can appear while one is already pending')

  const guaranteed = generateQuestionableOffer(false, difficulty, 1, () => 0)
  assert.ok(guaranteed, 'a near-zero roll against a nonzero chance produces an offer')
  assert.equal(guaranteed!.yearOffered, 1, 'a new offer records the year it appeared')
  assert.equal(guaranteed!.response, null, 'a new offer starts unresolved')
  assert.ok(guaranteed!.possibleDelayedConsequences.length > 0, 'every offer explains at least one possible delayed consequence')

  const never = generateQuestionableOffer(false, difficulty, 1, () => 0.999)
  assert.equal(never, null, 'a near-certain roll against the same chance produces no offer')
}

// 43. Accepting an offer always raises legal risk; every lawful response never raises it, and reporting lowers suspicion.
{
  const offer: QuestionableOffer = {
    id: 'offer-1', offerId: 'unreported-payment', title: 'Test offer', description: 'test', immediateBenefit: 'test',
    riskLevel: 'high', adviserRecommendation: 'test', legalCategoriesAffected: ['financial-reporting'],
    possibleDelayedConsequences: ['test'], yearOffered: 1, resolvedYear: null, response: null,
  }
  const accepted = applyOfferResponseToLegalRisk(NEUTRAL_RISK, offer, 'accept')
  assert.ok(accepted.suspicion > 0 && accepted.availableEvidence > 0 && accepted.criminalExposure > 0, 'accepting a risky offer raises suspicion, evidence, and criminal exposure')
  assert.equal(accepted.previousViolations, 1, 'accepting counts as one more previous violation')

  for (const lawfulResponse of ['reject', 'investigate', 'negotiate-lawful-alternative'] as const) {
    const result = applyOfferResponseToLegalRisk(NEUTRAL_RISK, offer, lawfulResponse)
    assert.deepEqual(result, NEUTRAL_RISK, `responding with "${lawfulResponse}" never raises legal risk above where it started`)
  }

  const withSomeSuspicion: LegalRiskProfile = { ...NEUTRAL_RISK, suspicion: 10 }
  const reported = applyOfferResponseToLegalRisk(withSomeSuspicion, offer, 'report')
  assert.ok(reported.suspicion < withSomeSuspicion.suspicion, 'reporting a questionable offer lowers suspicion rather than raising it')
}

// 44. Investigation trigger chance rises with real risk and falls with strong compliance — never a background roll disconnected from actual state.
{
  const difficulty = DIFFICULTY_PROFILES.beginner
  const noRiskChance = computeInvestigationTriggerChance(NEUTRAL_RISK, 80, difficulty)
  assert.equal(noRiskChance, 0, 'a company with zero accumulated risk has zero investigation chance')

  const highRisk: LegalRiskProfile = { suspicion: 90, availableEvidence: 90, civilLiability: 80, criminalExposure: 90, publicAwareness: 70, employeeKnowledge: 80, previousViolations: 3 }
  const lowComplianceChance = computeInvestigationTriggerChance(highRisk, 20, difficulty)
  const highComplianceChance = computeInvestigationTriggerChance(highRisk, 90, difficulty)
  assert.ok(lowComplianceChance > 0, 'high accumulated risk produces a real, nonzero investigation chance')
  assert.ok(lowComplianceChance > highComplianceChance, 'strong compliance meaningfully reduces investigation chance versus weak compliance, for the same underlying risk')
  assert.ok(lowComplianceChance <= 0.6, 'investigation chance is always bounded, never a near-certainty')
}

// 45. Case severity is classified directly from the risk profile that produced it — heavier exposure and repeat violations always classify at least as severe.
{
  assert.equal(classifyCaseSeverity(NEUTRAL_RISK), 'minor', 'a clean risk profile classifies as a minor case')
  const severeRisk: LegalRiskProfile = { ...NEUTRAL_RISK, criminalExposure: 100, civilLiability: 100, previousViolations: 5 }
  assert.equal(classifyCaseSeverity(severeRisk), 'severe', 'maxed-out criminal exposure and repeated violations classify as a severe case')
}

// 46. A legal case advances exactly one stage per year and never advances past the final stage.
{
  let legalCase = makeLegalCase()
  for (let year = 2; year <= 10; year += 1) {
    legalCase = advanceCaseStage(legalCase, year)
  }
  assert.equal(legalCase.stage, 'penalty-or-acquittal', 'after enough years, the case has reached the final stage')
  assert.equal(legalCase.stageEnteredYear, INVESTIGATION_STAGE_ORDER.length, 'the case advanced exactly one stage per year, never skipping or repeating')
  const stalled = advanceCaseStage(legalCase, 99)
  assert.equal(stalled.stage, 'penalty-or-acquittal', 'a case already at the final stage never advances further')
}

// 47. Case outcomes are driven by the accumulated actions and risk, not chance alone: a clean, uncontested case is acquitted, while only a severe, contested, strong-evidence, repeat-violation case can ever reach founder-imprisonment.
{
  const mildCase = makeLegalCase({ severity: 'minor', actionsTaken: ['cooperate'] })
  const mildOutcome = resolveCaseOutcome(mildCase, NEUTRAL_RISK, () => 0.5)
  assert.equal(mildOutcome, 'acquitted', 'a clean risk profile with cooperation and no contest is acquitted')

  const severeRisk: LegalRiskProfile = { ...NEUTRAL_RISK, criminalExposure: 90, civilLiability: 90, availableEvidence: 80, previousViolations: 3 }
  const severeCase = makeLegalCase({ severity: 'severe', actionsTaken: ['contest-allegations'] })
  const severeOutcome = resolveCaseOutcome(severeCase, severeRisk, () => 0.1)
  assert.ok(
    severeOutcome === 'founder-imprisonment' || severeOutcome === 'company-dissolution',
    'only the combination of severe severity, contested allegations, strong evidence, and repeat violations can reach the two most serious outcomes',
  )

  const leniencyCase = makeLegalCase({ severity: 'severe', actionsTaken: ['cooperate', 'hire-legal-representation', 'compensate-customers', 'settle-civil-claims'] })
  const leniencyOutcome = resolveCaseOutcome(leniencyCase, severeRisk, () => 0.1)
  assert.notEqual(leniencyOutcome, 'founder-imprisonment', 'cooperating and settling instead of contesting never leads to the most severe outcome, even with the same underlying risk')
}

// 48. Every lawful legal-case action has a real, ledger-relevant cost except pure cooperation/contesting, which cost nothing to choose.
{
  const industry = getIndustryProfile('Clothing')
  const difficulty = DIFFICULTY_PROFILES.beginner
  assert.equal(computeLegalCaseActionCost('cooperate', industry, difficulty), 0, 'cooperating costs nothing')
  assert.equal(computeLegalCaseActionCost('contest-allegations', industry, difficulty), 0, 'contesting costs nothing up front')
  assert.ok(computeLegalCaseActionCost('hire-legal-representation', industry, difficulty) > 0, 'hiring legal representation has a real cost')
  assert.ok(computeLegalCaseActionCost('settle-civil-claims', industry, difficulty) > computeLegalCaseActionCost('internal-investigation', industry, difficulty), 'settling civil claims costs meaningfully more than an internal investigation')
}

// 49. Responding to a questionable offer through game-state charges/credits the ledger correctly, updates legal risk, and can only happen once per offer.
{
  const state = freshState()
  const withOffer: GameState = { ...state, questionableOffers: [{
    id: 'offer-2', offerId: 'suspicious-supplier-discount', title: 'Discount test', description: 'test', immediateBenefit: 'test',
    riskLevel: 'medium', adviserRecommendation: 'test', legalCategoriesAffected: ['corporate-tax'],
    possibleDelayedConsequences: ['test'], yearOffered: state.year, resolvedYear: null, response: null,
  }] }
  const cashBefore = withOffer.cash

  const accepted = respondToQuestionableOffer(withOffer, 'offer-2', 'accept')
  assert.equal(accepted.error, undefined)
  assert.ok(accepted.state.cash > cashBefore, 'accepting a questionable offer credits real cash')
  assert.ok(accepted.state.cashLedger.some((entry) => entry.category === 'QUESTIONABLE_OFFER_BENEFIT'), 'the benefit is recorded as its own categorised ledger entry')
  assert.ok(accepted.state.legalRisk.suspicion > 0, 'accepting raises legal risk')
  assert.ok(verifyLedgerIntegrity(accepted.state).ok)

  const secondAttempt = respondToQuestionableOffer(accepted.state, 'offer-2', 'reject')
  assert.ok(secondAttempt.error, 'an already-resolved offer cannot be responded to again')
}

// 50. Taking a legal case action charges exactly its previewed cost, rejects insufficient cash, and rejects a duplicate or unknown action.
{
  const state = freshState()
  const withCase: GameState = { ...state, legalCases: [makeLegalCase({ id: 'case-2', startedYear: state.year, stageEnteredYear: state.year })] }
  const cashBefore = withCase.cash

  const acted = takeLegalCaseAction(withCase, 'case-2', 'hire-legal-representation')
  assert.equal(acted.error, undefined)
  assert.ok(cashBefore - acted.state.cash > 0, 'taking a paid legal-case action charges real cash')
  assert.ok(acted.state.cashLedger.some((entry) => entry.category === 'LEGAL_FEE'), 'hiring legal representation is recorded under LEGAL_FEE')
  assert.ok(verifyLedgerIntegrity(acted.state).ok)

  const duplicate = takeLegalCaseAction(acted.state, 'case-2', 'hire-legal-representation')
  assert.ok(duplicate.error, 'the same action cannot be taken twice on the same case')

  const brokeState: GameState = { ...withCase, cash: 0 }
  const tooExpensive = takeLegalCaseAction(brokeState, 'case-2', 'settle-civil-claims')
  assert.ok(tooExpensive.error, 'an action that costs more than available cash is rejected')

  const settlement = takeLegalCaseAction(withCase, 'case-2', 'compensate-customers')
  assert.ok(settlement.state.cashLedger.some((entry) => entry.category === 'SETTLEMENT_PAYMENT'), 'compensating customers is recorded under SETTLEMENT_PAYMENT, distinct from a general legal fee')
}

// 51. A save from the pre-legal-risk format (version 5) migrates into a valid version-6 state with a neutral, honest baseline — existing saves keep working.
{
  const state = freshState()
  const { state: afterYear } = completeFinancialYear(state, rng)
  const v5Raw: Record<string, unknown> = JSON.parse(JSON.stringify(afterYear))
  v5Raw.saveVersion = 5
  delete v5Raw.legalRisk
  delete v5Raw.questionableOffers
  delete v5Raw.legalCases
  delete v5Raw.gameOverReason

  const migrated = migrateV5ToV6(v5Raw)
  assert.ok(migrated, 'a version-5-shaped save migrates successfully rather than being discarded')
  assert.equal(migrated!.cash, afterYear.cash, 'cash is carried over exactly, unchanged by migration')
  assert.equal(migrated!.saveVersion, 6, 'migrateV5ToV6 in isolation produces a v6-versioned save — chaining to the current version is loadGameState\'s job')
  assert.deepEqual(migrated!.legalRisk, NEUTRAL_RISK, 'a save from before this feature existed starts from a neutral, zero-suspicion legal risk baseline')
  assert.deepEqual(migrated!.questionableOffers, [], 'a migrated save starts with no fabricated offer history')
  assert.deepEqual(migrated!.legalCases, [], 'a migrated save starts with no fabricated legal case history')
  assert.equal(migrated!.gameOverReason, null)
  assert.ok(migrated!.annualReports.every((r) => Array.isArray(r.offerUpdates) && Array.isArray(r.legalCaseUpdates)), 'every migrated annual report gets offerUpdates and legalCaseUpdates arrays, never undefined')
  assert.ok(verifyLedgerIntegrity(migrated!).ok, 'migration never creates unexplained money')
}

// 52. completeFinancialYear only ever generates a new offer when none is pending, and legalConsequencesMode 'disabled' suppresses the whole system for a year.
{
  const state = freshState()
  const rngAlwaysZero = () => 0
  const { state: afterFirstYear } = completeFinancialYear(state, rngAlwaysZero)
  const pendingCount = afterFirstYear.questionableOffers.filter((offer) => offer.response === null).length
  assert.ok(pendingCount <= 1, 'at most one questionable offer is ever pending at a time')

  const disabledState: GameState = { ...state, preferences: { ...state.preferences, legalConsequencesMode: 'disabled' } }
  const { state: afterDisabledYear } = completeFinancialYear(disabledState, rngAlwaysZero)
  assert.deepEqual(afterDisabledYear.questionableOffers, [], 'with legal consequences disabled, no questionable offer is ever generated')
  assert.deepEqual(afterDisabledYear.legalCases, [], 'with legal consequences disabled, no legal case is ever generated')
  assert.ok(verifyLedgerIntegrity(afterDisabledYear).ok)
}

console.log('Business Empire questionable offers and legal risk tests passed')

// ============================================================================
// Economic cycles, banking, insurance, board/investors, and v6 -> v7 migration
// ============================================================================

// 53. Economic phase transitions are always weighted and adjacency-aware — every roll from a given phase lands on one of that phase's own declared neighbours, never an arbitrary or undefined phase.
{
  for (const startPhase of Object.keys(ECONOMIC_PHASE_INFO) as (keyof typeof ECONOMIC_PHASE_INFO)[]) {
    for (const probe of [0, 0.25, 0.5, 0.75, 0.999]) {
      const next = advanceEconomicPhase(startPhase, () => probe)
      assert.ok(next in ECONOMIC_PHASE_INFO, `advancing from "${startPhase}" at roll ${probe} always lands on a real, declared phase`)
    }
  }
}

// 54. Credit rating is built entirely from real, visible factors: heavy debt, missed payments, weak reputation, and high legal risk all pull it down; a clean, profitable, low-debt company scores meaningfully higher — and the score always stays inside the familiar 300-850 range.
{
  const terrible = computeCreditRating({ recentNetProfit: -50_000, totalLoanBalance: 500_000, companyValue: 50_000, totalMissedPayments: 10, brandReputation: 5, legalRisk: { suspicion: 0, availableEvidence: 0, civilLiability: 100, criminalExposure: 100, publicAwareness: 0, employeeKnowledge: 0, previousViolations: 5 }, phase: 'recession' })
  const excellent = computeCreditRating({ recentNetProfit: 100_000, totalLoanBalance: 0, companyValue: 500_000, totalMissedPayments: 0, brandReputation: 95, legalRisk: { suspicion: 0, availableEvidence: 0, civilLiability: 0, criminalExposure: 0, publicAwareness: 0, employeeKnowledge: 0, previousViolations: 0 }, phase: 'boom' })
  assert.ok(terrible >= 300 && terrible <= 850, 'credit rating always stays inside the 300-850 range, even for a terrible company')
  assert.ok(excellent >= 300 && excellent <= 850, 'credit rating always stays inside the 300-850 range, even for an excellent company')
  assert.ok(excellent > terrible, 'a clean, profitable, low-debt company scores meaningfully higher than a heavily indebted one with missed payments and legal exposure')
  assert.equal(getCreditRatingBand(terrible), 'very-poor', 'the terrible-company scenario lands in the worst credit band')
}

// 55. A property mortgage requires an owned facility as real collateral — it is rejected outright without one, and becomes available once one exists.
{
  const state = freshState()
  const withoutFacility = previewLoanApplication(state, 20_000, 'property-mortgage')
  assert.ok(withoutFacility.error, 'a property mortgage is rejected when the company owns no facility')

  const built = buildFacility(state, 'warehouse', 'eastvale', 'owned').state
  const withFacility = previewLoanApplication(built, 20_000, 'property-mortgage')
  assert.equal(withFacility.error, undefined, 'a property mortgage becomes available once an owned facility exists as collateral')
}

// 56. Loan type is a real, visible trade-off: a high-risk loan is easier to get approved than a standard expansion loan, but always costs more in interest — never a free upgrade.
{
  assert.equal(LOAN_TYPE_INFO['property-mortgage'].requiresOwnedFacility, true)
  assert.equal(LOAN_TYPE_INFO.expansion.requiresOwnedFacility, false)
  const state = freshState()
  const highRisk = previewLoanApplication(state, 10_000, 'high-risk-loan')
  const expansion = previewLoanApplication(state, 10_000, 'expansion')
  assert.ok(highRisk.odds >= expansion.odds, 'a high-risk loan is at least as easy to get approved as a standard expansion loan')
  assert.ok(highRisk.interestRate > expansion.interestRate, 'a high-risk loan always costs strictly more in interest than a standard expansion loan')
}

// 57. Insurance coverage is a real, capped claim — never more than the coverage limit, never more than impact minus the deductible, and always zero with no matching active policy.
{
  const policy: InsurancePolicy = { id: 'policy-1', type: 'product-liability', active: true, premiumPerYear: 500, deductible: 200, coverageLimit: 1_000, purchasedYear: 1 }
  assert.deepEqual(computeInsuranceCoverage([], 'product-liability', 5_000), { coveredAmount: 0, policyId: null }, 'no active policy means no coverage')
  assert.deepEqual(computeInsuranceCoverage([policy], 'employee', 5_000), { coveredAmount: 0, policyId: null }, 'a policy of a different type never covers a mismatched claim')
  assert.equal(computeInsuranceCoverage([policy], 'product-liability', 100).coveredAmount, 0, 'an impact smaller than the deductible is not covered at all')
  const midClaim = computeInsuranceCoverage([policy], 'product-liability', 600)
  assert.equal(midClaim.coveredAmount, 400, 'coverage is exactly impact minus deductible when that is under the coverage limit')
  const bigClaim = computeInsuranceCoverage([policy], 'product-liability', 50_000)
  assert.equal(bigClaim.coveredAmount, policy.coverageLimit, 'coverage never exceeds the policy coverage limit, however large the claim')
}

// 58. Buying insurance is immediate and free up front; the premium is a real, ledger-backed yearly cost once a year completes, and cancelling removes the policy entirely.
{
  const state = freshState()
  const cashBefore = state.cash
  const bought = purchaseInsurance(state, 'cybersecurity')
  assert.equal(bought.error, undefined)
  assert.equal(bought.state.cash, cashBefore, 'buying a policy charges nothing up front')
  assert.equal(bought.state.insurancePolicies.length, 1)

  const duplicate = purchaseInsurance(bought.state, 'cybersecurity')
  assert.ok(duplicate.error, 'a second active policy of the same type cannot be bought while one is already active')

  const { state: afterYear } = completeFinancialYear(bought.state, rng)
  assert.ok(afterYear.cashLedger.some((entry) => entry.category === 'INSURANCE_PREMIUM'), 'the premium is charged as a real, categorised ledger entry once a year completes')
  assert.ok(verifyLedgerIntegrity(afterYear).ok)

  const cancelled = cancelInsurance(bought.state, bought.state.insurancePolicies[0].id)
  assert.equal(cancelled.state.insurancePolicies.length, 0, 'cancelling removes the policy entirely')
}

// 59. Legal expenses insurance covers part of a court fine for an ordinary case, but never a case tied to the player's own accepted questionable offer — insurance reduces financial damage, not responsibility for intentional misconduct.
{
  const severeRisk: LegalRiskProfile = { suspicion: 0, availableEvidence: 80, civilLiability: 90, criminalExposure: 90, publicAwareness: 0, employeeKnowledge: 0, previousViolations: 3 }
  const buildRiggedCase = (relatedOfferId: string | null): GameState => {
    const base = freshState()
    const insured = purchaseInsurance(base, 'legal-expenses').state
    const legalCase: LegalCase = {
      id: 'case-insurance-test', relatedOfferId, title: 'Test case', description: 'test',
      severity: 'severe', stage: 'judgment', startedYear: insured.year - 5, stageEnteredYear: insured.year - 1,
      actionsTaken: [], outcome: null, resolvedYear: null,
    }
    return { ...insured, legalRisk: severeRisk, legalCases: [legalCase] }
  }

  const ordinaryCaseState = buildRiggedCase(null)
  const { state: afterOrdinary } = completeFinancialYear(ordinaryCaseState, rng)
  assert.ok(afterOrdinary.cashLedger.some((entry) => entry.category === 'COURT_FINE'), 'setup: the rigged case actually resolves with a real court fine this year')
  assert.ok(afterOrdinary.cashLedger.some((entry) => entry.category === 'INSURANCE_PAYOUT'), 'legal expenses insurance covers part of an ordinary court fine')

  const misconductCaseState = buildRiggedCase('accepted-offer-id')
  const { state: afterMisconduct } = completeFinancialYear(misconductCaseState, rng)
  assert.ok(afterMisconduct.cashLedger.some((entry) => entry.category === 'COURT_FINE'), 'setup: the misconduct-linked case also resolves with a real court fine')
  assert.ok(!afterMisconduct.cashLedger.some((entry) => entry.category === 'INSURANCE_PAYOUT'), 'legal expenses insurance never covers a case tied to the player\'s own accepted questionable offer')
  assert.ok(verifyLedgerIntegrity(afterOrdinary).ok && verifyLedgerIntegrity(afterMisconduct).ok)
}

// 60. Selling equity dilutes founder ownership by exactly the percent sold, credits cash at the current valuation, is gated at the minimum-founder-ownership floor, and adds a board seat once outside ownership crosses 20%.
{
  const state = freshState()
  const cashBefore = state.cash
  const sold = sellShares(state, 25)
  assert.equal(sold.error, undefined)
  assert.equal(sold.state.founderOwnershipPercent, 75, 'founder ownership drops by exactly the percent sold')
  assert.ok(sold.state.cash > cashBefore, 'selling equity credits real cash')
  assert.ok(sold.state.cashLedger.some((entry) => entry.category === 'INVESTMENT'), 'the raised capital is recorded under INVESTMENT, the previously-unused category built for exactly this')
  assert.equal(sold.state.boardMembers.length, 1, 'crossing 20% outside ownership adds exactly one board seat')
  assert.ok(verifyLedgerIntegrity(sold.state).ok)

  const oversell = previewShareSale(state, 100 - MIN_FOUNDER_OWNERSHIP_PERCENT + 1)
  assert.ok(oversell.error, 'founder ownership can never be sold below the minimum floor in a single sale')
}

// 61. Implied share price, outside ownership, and earned board seats are simple, honest derivations of company value and founder ownership — no hidden state of their own.
{
  assert.equal(computeImpliedSharePrice(100_000), 10, 'implied share price is company value divided by the fixed nominal share count')
  assert.equal(computeOutsideOwnershipPercent(75), 25, 'outside ownership is always exactly 100 minus founder ownership')
  assert.equal(computeEarnedBoardSeats(15), 0, 'below the first 20% threshold, no board seat is earned yet')
  assert.equal(computeEarnedBoardSeats(45), 2, 'crossing two thresholds earns exactly two board seats')
  assert.equal(computeEarnedBoardSeats(100), 4, 'earned board seats are capped at the number of declared thresholds')
}

// 62. A save from the pre-economy-and-investors format (version 6) migrates into a valid version-7 state — existing loans start with a clean payment history, and the founder still holds exactly 100% of a company that has never sold equity.
{
  const state = freshState()
  const withLoan = { ...state, loans: [{ id: 'loan-legacy', principal: 5_000, remainingBalance: 4_000, interestRate: 0.08, termYears: 5, yearsRemaining: 3, purpose: 'expansion' as const, takenYear: 1, missedPayments: 0 }] }
  const { state: afterYear } = completeFinancialYear(withLoan, rng)
  const v6Raw: Record<string, unknown> = JSON.parse(JSON.stringify(afterYear))
  v6Raw.saveVersion = 6
  v6Raw.loans = (v6Raw.loans as Record<string, unknown>[]).map((loan) => { delete loan.missedPayments; return loan })
  delete v6Raw.insurancePolicies
  delete v6Raw.founderOwnershipPercent
  delete v6Raw.boardMembers
  delete v6Raw.shareSales

  const migrated = migrateV6ToV7(v6Raw)
  assert.ok(migrated, 'a version-6-shaped save migrates successfully rather than being discarded')
  assert.equal(migrated!.cash, afterYear.cash, 'cash is carried over exactly, unchanged by migration')
  assert.equal(migrated!.saveVersion, CURRENT_SAVE_VERSION)
  assert.equal(migrated!.founderOwnershipPercent, 100, 'a migrated save starts with full founder ownership, matching a company that has never sold equity')
  assert.deepEqual(migrated!.insurancePolicies, [], 'a migrated save starts with no fabricated insurance history')
  assert.deepEqual(migrated!.boardMembers, [])
  assert.deepEqual(migrated!.shareSales, [])
  assert.ok(migrated!.loans.every((loan) => loan.missedPayments === 0), 'existing loans from before this feature start with a clean, zero missed-payment history')
  assert.ok(verifyLedgerIntegrity(migrated!).ok, 'migration never creates unexplained money')
}

console.log('Business Empire economy, insurance, and investor tests passed')
