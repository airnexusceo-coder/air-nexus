import type { CreditRatingBand, EconomicCyclePhase, LegalRiskProfile, LoanPurpose } from '@/lib/business-empire/types'

export type EconomicPhaseEffects = {
  /** The `economicIndex` this phase pulls toward, via the same gradual drift pattern used for compliance ratings — never an instant jump. */
  demandTarget: number
  wageMultiplier: number
  landPriceMultiplier: number
  supplierCostMultiplier: number
  loanApprovalMultiplier: number
  interestRateDelta: number
  investorConfidenceDelta: number
}

export type EconomicPhaseInfo = { label: string; description: string; effects: EconomicPhaseEffects }

/** Nine named conditions, each with real, visible effects across demand, wages, land prices, supplier costs, loans, and investor confidence — matching how the spec asks every downturn or boom to be a shown, explained condition. */
export const ECONOMIC_PHASE_INFO: Record<EconomicCyclePhase, EconomicPhaseInfo> = {
  boom: { label: 'Economic Boom', description: 'Strong consumer spending and easy credit — demand runs hot and land prices climb with it.', effects: { demandTarget: 1.25, wageMultiplier: 1.1, landPriceMultiplier: 1.15, supplierCostMultiplier: 1.05, loanApprovalMultiplier: 1.2, interestRateDelta: -0.005, investorConfidenceDelta: 2 } },
  growth: { label: 'Steady Growth', description: 'A healthy, expanding economy with no major strain in either direction.', effects: { demandTarget: 1.1, wageMultiplier: 1.03, landPriceMultiplier: 1.05, supplierCostMultiplier: 1, loanApprovalMultiplier: 1.1, interestRateDelta: 0, investorConfidenceDelta: 1 } },
  stable: { label: 'Stable', description: 'Ordinary, unremarkable conditions.', effects: { demandTarget: 1, wageMultiplier: 1, landPriceMultiplier: 1, supplierCostMultiplier: 1, loanApprovalMultiplier: 1, interestRateDelta: 0, investorConfidenceDelta: 0 } },
  inflation: { label: 'Inflation', description: 'Prices for wages, land, and supplies are all rising faster than usual.', effects: { demandTarget: 0.95, wageMultiplier: 1.12, landPriceMultiplier: 1.1, supplierCostMultiplier: 1.18, loanApprovalMultiplier: 0.9, interestRateDelta: 0.015, investorConfidenceDelta: -1 } },
  recession: { label: 'Recession', description: 'Consumers are spending less and lenders have turned cautious.', effects: { demandTarget: 0.78, wageMultiplier: 0.97, landPriceMultiplier: 0.85, supplierCostMultiplier: 1.02, loanApprovalMultiplier: 0.6, interestRateDelta: 0.01, investorConfidenceDelta: -3 } },
  'supply-crisis': { label: 'Supply Crisis', description: 'Suppliers are struggling to deliver — input costs and delays are climbing.', effects: { demandTarget: 0.95, wageMultiplier: 1, landPriceMultiplier: 1, supplierCostMultiplier: 1.3, loanApprovalMultiplier: 0.9, interestRateDelta: 0.005, investorConfidenceDelta: -1 } },
  'labour-shortage': { label: 'Labour Shortage', description: 'Workers are scarce and wage expectations are climbing across every industry.', effects: { demandTarget: 1.02, wageMultiplier: 1.22, landPriceMultiplier: 1, supplierCostMultiplier: 1.05, loanApprovalMultiplier: 1, interestRateDelta: 0, investorConfidenceDelta: 0 } },
  'high-interest-rates': { label: 'High Interest Rates', description: 'Borrowing has become expensive across the board.', effects: { demandTarget: 0.92, wageMultiplier: 1, landPriceMultiplier: 0.95, supplierCostMultiplier: 1, loanApprovalMultiplier: 0.75, interestRateDelta: 0.03, investorConfidenceDelta: -1 } },
  'low-consumer-confidence': { label: 'Low Consumer Confidence', description: 'Customers are cautious and holding back on spending even though prices are stable.', effects: { demandTarget: 0.85, wageMultiplier: 1, landPriceMultiplier: 0.97, supplierCostMultiplier: 1, loanApprovalMultiplier: 0.95, interestRateDelta: 0, investorConfidenceDelta: -2 } },
}

/** Weighted, adjacency-aware transitions — persistence (staying in the same phase) is always the single most likely outcome, and a phase almost always moves to a believable neighbour rather than jumping straight between extremes (a boom cools into growth/inflation, not straight into recession). */
const ECONOMIC_PHASE_TRANSITIONS: Record<EconomicCyclePhase, Partial<Record<EconomicCyclePhase, number>>> = {
  boom: { boom: 5, growth: 3, inflation: 2 },
  growth: { growth: 5, boom: 1.5, stable: 2.5, inflation: 1 },
  stable: { stable: 6, growth: 2, recession: 1, 'labour-shortage': 1, 'supply-crisis': 0.5 },
  inflation: { inflation: 4, stable: 2, 'high-interest-rates': 2.5, recession: 1 },
  recession: { recession: 5, stable: 2.5, 'low-consumer-confidence': 1.5 },
  'supply-crisis': { 'supply-crisis': 4, stable: 3, inflation: 2 },
  'labour-shortage': { 'labour-shortage': 4, stable: 3, inflation: 1.5 },
  'high-interest-rates': { 'high-interest-rates': 4, stable: 3, recession: 2 },
  'low-consumer-confidence': { 'low-consumer-confidence': 4, stable: 3, recession: 1.5 },
}

export function advanceEconomicPhase(currentPhase: EconomicCyclePhase, rng: () => number): EconomicCyclePhase {
  const weights = ECONOMIC_PHASE_TRANSITIONS[currentPhase]
  const entries = Object.entries(weights) as [EconomicCyclePhase, number][]
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rng() * total
  for (const [phase, weight] of entries) {
    roll -= weight
    if (roll <= 0) return phase
  }
  return entries[entries.length - 1][0]
}

// --- Banking and credit ------------------------------------------------------------

export const CREDIT_RATING_APPROVAL_MULTIPLIER: Record<CreditRatingBand, number> = {
  excellent: 1.2,
  good: 1.1,
  fair: 1,
  poor: 0.8,
  'very-poor': 0.5,
}

export function getCreditRatingBand(score: number): CreditRatingBand {
  if (score >= 740) return 'excellent'
  if (score >= 670) return 'good'
  if (score >= 580) return 'fair'
  if (score >= 500) return 'poor'
  return 'very-poor'
}

/**
 * A familiar 300-850 scale built entirely from real, visible state: recent
 * profitability, debt relative to company value, missed-payment history,
 * brand reputation, accumulated legal risk, and current economic
 * conditions — never a single hidden number the player can't trace back to
 * a cause.
 */
export function computeCreditRating(params: {
  recentNetProfit: number
  totalLoanBalance: number
  companyValue: number
  totalMissedPayments: number
  brandReputation: number
  legalRisk: LegalRiskProfile
  phase: EconomicCyclePhase
}): number {
  let score = 580
  score += params.recentNetProfit > 0 ? 60 : -40
  const debtRatio = params.companyValue > 0 ? params.totalLoanBalance / params.companyValue : 1
  score -= Math.min(120, Math.round(debtRatio * 150))
  score -= Math.min(150, params.totalMissedPayments * 30)
  score += Math.round((params.brandReputation - 50) * 1.2)
  score -= Math.round((params.legalRisk.civilLiability + params.legalRisk.criminalExposure) / 4)
  score += Math.round(ECONOMIC_PHASE_INFO[params.phase].effects.investorConfidenceDelta * 5)
  return Math.max(300, Math.min(850, Math.round(score)))
}

// --- Loan types ----------------------------------------------------------------------

export type LoanTypeInfo = {
  label: string
  description: string
  termYears: number
  /** Added to the reputation-derived base interest rate. */
  interestRateModifier: number
  /** Multiplies the base approval odds. */
  approvalOddsMultiplier: number
  /** Only 'property-mortgage' requires this — an owned facility as collateral. */
  requiresOwnedFacility: boolean
}

export const LOAN_TYPE_INFO: Record<LoanPurpose, LoanTypeInfo> = {
  expansion: { label: 'Expansion Loan', description: 'A standard multi-year loan for growing the business.', termYears: 5, interestRateModifier: 0, approvalOddsMultiplier: 1, requiresOwnedFacility: false },
  'working-capital': { label: 'Short-Term Loan', description: 'A short, cheaper loan for day-to-day cash flow needs.', termYears: 2, interestRateModifier: -0.01, approvalOddsMultiplier: 1.1, requiresOwnedFacility: false },
  equipment: { label: 'Equipment Finance', description: 'Financing tied to purchasing production equipment.', termYears: 4, interestRateModifier: -0.005, approvalOddsMultiplier: 1.05, requiresOwnedFacility: false },
  recovery: { label: 'Emergency Credit', description: 'Fast, easier-to-approve credit for getting through a difficult year, priced higher for the urgency.', termYears: 3, interestRateModifier: 0.02, approvalOddsMultiplier: 1.15, requiresOwnedFacility: false },
  'property-mortgage': { label: 'Property Mortgage', description: 'A long-term, low-interest loan secured against an owned facility.', termYears: 12, interestRateModifier: -0.015, approvalOddsMultiplier: 0.95, requiresOwnedFacility: true },
  'high-risk-loan': { label: 'High-Risk Loan', description: 'Easy to get approved, but priced far higher — a real trade-off, not a shortcut.', termYears: 3, interestRateModifier: 0.06, approvalOddsMultiplier: 1.4, requiresOwnedFacility: false },
}

export const LOAN_TYPE_ORDER: LoanPurpose[] = ['working-capital', 'expansion', 'equipment', 'property-mortgage', 'recovery', 'high-risk-loan']
