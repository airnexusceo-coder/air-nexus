import type { DifficultyProfile, IndustryProfile, InsurancePolicy, InsurancePolicyType } from '@/lib/business-empire/types'

export type InsurancePolicyTypeInfo = {
  label: string
  description: string
  /** Premium as a fraction of the industry's per-unit price benchmark. */
  premiumFactor: number
  deductibleFactor: number
  coverageLimitFactor: number
}

/** Six real policy types, each with its own premium/deductible/coverage shape — matching the spec's list exactly. Reduces the financial damage of a covered event but never the responsibility for intentional misconduct (enforced at the claim site, not here). */
export const INSURANCE_POLICY_INFO: Record<InsurancePolicyType, InsurancePolicyTypeInfo> = {
  property: { label: 'Property Insurance', description: 'Covers damage to owned facilities from disasters and accidents.', premiumFactor: 6, deductibleFactor: 40, coverageLimitFactor: 800 },
  'product-liability': { label: 'Product Liability Insurance', description: 'Covers the cost of product recalls and defect-related claims.', premiumFactor: 8, deductibleFactor: 30, coverageLimitFactor: 700 },
  'business-interruption': { label: 'Business Interruption Insurance', description: 'Covers lost income when operations are forced to pause.', premiumFactor: 7, deductibleFactor: 35, coverageLimitFactor: 600 },
  cybersecurity: { label: 'Cybersecurity Insurance', description: 'Covers costs from data breaches and system compromise.', premiumFactor: 5, deductibleFactor: 25, coverageLimitFactor: 500 },
  employee: { label: 'Employee Insurance', description: 'Covers workplace injury and employee-related claims.', premiumFactor: 6, deductibleFactor: 20, coverageLimitFactor: 450 },
  'legal-expenses': { label: 'Legal Expenses Insurance', description: 'Covers legal fees and court-ordered fines from cases not tied to your own accepted misconduct.', premiumFactor: 9, deductibleFactor: 45, coverageLimitFactor: 900 },
}

export const INSURANCE_POLICY_TYPE_ORDER: InsurancePolicyType[] = ['property', 'product-liability', 'business-interruption', 'cybersecurity', 'employee', 'legal-expenses']

function unitCost(industry: IndustryProfile): number {
  return Math.max(20, industry.averagePrice)
}

export function computeInsuranceTerms(type: InsurancePolicyType, industry: IndustryProfile, difficulty: DifficultyProfile): { premiumPerYear: number; deductible: number; coverageLimit: number } {
  const info = INSURANCE_POLICY_INFO[type]
  const base = unitCost(industry) * difficulty.costMultiplier
  return {
    premiumPerYear: Math.max(100, Math.round((base * info.premiumFactor) / 10) * 10),
    deductible: Math.max(200, Math.round((base * info.deductibleFactor) / 50) * 50),
    coverageLimit: Math.max(5_000, Math.round((base * info.coverageLimitFactor) / 100) * 100),
  }
}

/**
 * Applies an active policy of the matching type to a financial impact,
 * returning how much the insurer covers and how much is still the
 * company's own cost. Coverage never exceeds the impact-minus-deductible
 * or the policy's coverage limit — a real claim, not a blank check.
 */
export function computeInsuranceCoverage(policies: InsurancePolicy[], type: InsurancePolicyType, financialImpact: number): { coveredAmount: number; policyId: string | null } {
  const policy = policies.find((p) => p.type === type && p.active)
  if (!policy || financialImpact <= 0) return { coveredAmount: 0, policyId: null }
  const coveredAmount = Math.max(0, Math.min(policy.coverageLimit, financialImpact - policy.deductible))
  return { coveredAmount: Math.round(coveredAmount), policyId: policy.id }
}
