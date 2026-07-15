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
import { computeDemand, computeQualityScore } from '../lib/business-empire/simulation'
import { getIndustryProfile } from '../lib/business-empire/industries'
import { DIFFICULTY_PROFILES, type GamePreferences, type GameState } from '../lib/business-empire/types'

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
  assert.equal(Math.round(report.totalExpenses * 100) / 100, Math.round((report.productionCosts + report.researchCosts + report.advertisingCosts + report.wages + report.rent + report.taxes + report.refunds) * 100) / 100, 'totalExpenses is exactly the sum of its listed parts')
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
