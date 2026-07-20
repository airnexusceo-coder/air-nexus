import type {
  ComplianceCategory,
  ComplianceStaffRole,
  DifficultyProfile,
  IndustryProfile,
  Law,
  LawCategory,
  Region,
} from '@/lib/business-empire/types'

/** Which compliance front each law category is judged against — used to decide penalty severity and who is prepared. */
export const LAW_CATEGORY_TO_COMPLIANCE: Record<LawCategory, ComplianceCategory> = {
  'minimum-wage': 'employment',
  'employee-safety': 'employment',
  'working-hours': 'employment',
  'paid-leave': 'employment',
  'product-safety': 'product-safety',
  'product-warranties': 'product-safety',
  'advertising-claims': 'advertising',
  'customer-privacy': 'privacy',
  'environmental-standards': 'environmental',
  pollution: 'environmental',
  recycling: 'environmental',
  'corporate-tax': 'finance-tax',
  'import-tariffs': 'finance-tax',
  'export-restrictions': 'finance-tax',
  'financial-reporting': 'finance-tax',
  'anti-monopoly': 'finance-tax',
  'building-permits': 'construction-property',
  'property-taxes': 'construction-property',
  zoning: 'construction-property',
}

export type ComplianceCategoryInfo = { id: ComplianceCategory; label: string; description: string }

export const COMPLIANCE_CATEGORY_INFO: Record<ComplianceCategory, ComplianceCategoryInfo> = {
  employment: { id: 'employment', label: 'Employment', description: 'Wages, safety, working hours, and paid leave obligations.' },
  'product-safety': { id: 'product-safety', label: 'Product safety', description: 'Safety standards and warranty obligations for what you sell.' },
  'finance-tax': { id: 'finance-tax', label: 'Finance & tax', description: 'Corporate tax, tariffs, and financial reporting accuracy.' },
  environmental: { id: 'environmental', label: 'Environmental', description: 'Emissions, pollution, and recycling standards.' },
  privacy: { id: 'privacy', label: 'Privacy', description: 'How customer data is collected, stored, and used.' },
  advertising: { id: 'advertising', label: 'Advertising', description: 'Honesty and accuracy of marketing claims.' },
  'construction-property': { id: 'construction-property', label: 'Construction & property', description: 'Permits, zoning, and property-related obligations.' },
}

export const COMPLIANCE_CATEGORY_ORDER: ComplianceCategory[] = ['employment', 'product-safety', 'finance-tax', 'environmental', 'privacy', 'advertising', 'construction-property']

export type ComplianceStaffInfo = {
  id: ComplianceStaffRole
  label: string
  description: string
  annualSalaryFactor: number
  coverage: ComplianceCategory[]
}

export const COMPLIANCE_STAFF_INFO: Record<ComplianceStaffRole, ComplianceStaffInfo> = {
  'compliance-officer': { id: 'compliance-officer', label: 'Compliance officer', description: 'Oversees general regulatory readiness across employment and product safety.', annualSalaryFactor: 12, coverage: ['employment', 'product-safety'] },
  accountant: { id: 'accountant', label: 'Accountant', description: 'Keeps financial reporting and tax obligations accurate.', annualSalaryFactor: 10, coverage: ['finance-tax'] },
  lawyer: { id: 'lawyer', label: 'Lawyer', description: 'Reduces legal exposure broadly and softens penalty outcomes.', annualSalaryFactor: 16, coverage: ['advertising', 'privacy'] },
  'safety-inspector': { id: 'safety-inspector', label: 'Safety inspector', description: 'Keeps product safety and construction/property compliance current.', annualSalaryFactor: 9, coverage: ['product-safety', 'construction-property'] },
  'environmental-specialist': { id: 'environmental-specialist', label: 'Environmental specialist', description: 'Keeps environmental compliance ahead of new standards.', annualSalaryFactor: 9, coverage: ['environmental'] },
}

export const COMPLIANCE_STAFF_ROLE_ORDER: ComplianceStaffRole[] = ['compliance-officer', 'accountant', 'lawyer', 'safety-inspector', 'environmental-specialist']

type LawTemplate = {
  category: LawCategory
  name: string
  description: string
  complianceCostFactor: number
  penaltyFactor: number
  national: boolean
}

const LAW_TEMPLATES: LawTemplate[] = [
  { category: 'minimum-wage', name: 'Minimum Wage Increase', description: 'Raises the legal minimum wage for staff in this region.', complianceCostFactor: 6, penaltyFactor: 10, national: false },
  { category: 'employee-safety', name: 'Workplace Safety Standards Act', description: 'Tightens required workplace safety equipment and procedures.', complianceCostFactor: 8, penaltyFactor: 14, national: true },
  { category: 'working-hours', name: 'Working Hours Limit', description: 'Caps standard working hours and mandates overtime pay above the cap.', complianceCostFactor: 5, penaltyFactor: 8, national: false },
  { category: 'paid-leave', name: 'Paid Leave Expansion', description: 'Expands mandatory paid leave entitlements for employees.', complianceCostFactor: 5, penaltyFactor: 8, national: true },
  { category: 'product-safety', name: 'Consumer Product Safety Standard', description: 'Introduces stricter safety testing requirements before sale.', complianceCostFactor: 9, penaltyFactor: 16, national: true },
  { category: 'product-warranties', name: 'Minimum Warranty Requirement', description: 'Requires a minimum warranty period on products sold.', complianceCostFactor: 4, penaltyFactor: 9, national: true },
  { category: 'advertising-claims', name: 'Truth in Advertising Act', description: 'Requires advertising claims to be independently substantiated.', complianceCostFactor: 3, penaltyFactor: 12, national: true },
  { category: 'customer-privacy', name: 'Customer Data Protection Law', description: 'Regulates how customer data is collected, stored, and shared.', complianceCostFactor: 7, penaltyFactor: 15, national: true },
  { category: 'environmental-standards', name: 'Emissions Standard Update', description: 'Tightens allowable emissions from production facilities.', complianceCostFactor: 10, penaltyFactor: 18, national: true },
  { category: 'pollution', name: 'Pollution Control Ordinance', description: 'Restricts waste discharge from production processes in this region.', complianceCostFactor: 8, penaltyFactor: 16, national: false },
  { category: 'recycling', name: 'Mandatory Recycling Standard', description: 'Requires a minimum recycled-material content or take-back program.', complianceCostFactor: 6, penaltyFactor: 10, national: true },
  { category: 'corporate-tax', name: 'Corporate Tax Adjustment', description: 'Adjusts the corporate tax rate applied to company profit.', complianceCostFactor: 2, penaltyFactor: 20, national: true },
  { category: 'import-tariffs', name: 'Import Tariff Change', description: 'Changes tariffs on imported materials relevant to this industry.', complianceCostFactor: 7, penaltyFactor: 6, national: true },
  { category: 'export-restrictions', name: 'Export Restriction Rule', description: 'Restricts export of certain goods without additional certification.', complianceCostFactor: 5, penaltyFactor: 9, national: true },
  { category: 'financial-reporting', name: 'Financial Transparency Requirement', description: 'Requires more detailed and frequent financial disclosure.', complianceCostFactor: 4, penaltyFactor: 18, national: true },
  { category: 'anti-monopoly', name: 'Market Concentration Review', description: 'Introduces review triggers for companies with large market share.', complianceCostFactor: 3, penaltyFactor: 22, national: true },
  { category: 'building-permits', name: 'Building Permit Reform', description: 'Changes permit requirements for new or expanded facilities in this region.', complianceCostFactor: 5, penaltyFactor: 8, national: false },
  { category: 'property-taxes', name: 'Property Tax Revaluation', description: 'Revalues commercial property tax rates in this region.', complianceCostFactor: 3, penaltyFactor: 5, national: false },
  { category: 'zoning', name: 'Zoning Ordinance Update', description: 'Changes what facility types are permitted in parts of this region.', complianceCostFactor: 4, penaltyFactor: 7, national: false },
]

function unitCost(industry: IndustryProfile): number {
  return Math.max(20, industry.averagePrice)
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Each year there is a small chance (scaled by difficulty and the
 * industry's own regulation intensity) that a new law is proposed,
 * targeting either the whole company (national) or one region the
 * company actually operates in. It always arrives with a 2-year advance
 * warning, an estimated compliance cost and penalty, and a passage
 * probability — never a surprise regulation.
 */
export function generateLawProposal(
  existingLaws: Law[],
  operatingRegions: Region[],
  industry: IndustryProfile,
  difficulty: DifficultyProfile,
  year: number,
  rng: () => number,
): Law | null {
  const activeCategories = new Set(existingLaws.filter((law) => law.status === 'proposed' || law.status === 'active').map((law) => law.category))
  const candidates = LAW_TEMPLATES.filter((template) => !activeCategories.has(template.category))
  if (candidates.length === 0) return null

  const baseChance = 0.1 * difficulty.volatility * (0.6 + industry.challengeProfile.regulationIntensity)
  if (rng() >= baseChance) return null

  const template = candidates[Math.floor(rng() * candidates.length)]
  const region: Region | 'national' = template.national || operatingRegions.length === 0 ? 'national' : operatingRegions[Math.floor(rng() * operatingRegions.length)]
  const passageProbability = Math.round((0.35 + rng() * 0.45) * 100) / 100
  const estimatedComplianceCost = Math.round(unitCost(industry) * template.complianceCostFactor * difficulty.costMultiplier / 50) * 50
  const possiblePenalty = Math.round(unitCost(industry) * template.penaltyFactor * difficulty.costMultiplier / 50) * 50

  return {
    id: createId('law'),
    category: template.category,
    name: template.name,
    description: template.description,
    region,
    status: 'proposed',
    proposedYear: year,
    passageProbability,
    expectedStartYear: year + 2,
    estimatedComplianceCost,
    possiblePenalty,
    decidedYear: null,
  }
}

/** Resolves every proposed law whose decision year has arrived — a real probability roll against the passage odds shown to the player in advance, never a guaranteed outcome either way. */
export function resolveLawDecisions(laws: Law[], year: number, rng: () => number): { laws: Law[]; decided: Law[] } {
  const decided: Law[] = []
  const updated = laws.map((law) => {
    if (law.status !== 'proposed' || year < law.expectedStartYear) return law
    const passed = rng() < law.passageProbability
    const resolvedLaw: Law = { ...law, status: passed ? 'active' : 'rejected', decidedYear: year }
    decided.push(resolvedLaw)
    return resolvedLaw
  })
  return { laws: updated, decided }
}

/** Compliance ratings drift toward a target set by current staffing coverage — more relevant staff pulls a category up over several years, none lets it decay, matching "compliance is built, not switched on". */
export function computeComplianceRatingTarget(category: ComplianceCategory, staffing: Record<ComplianceStaffRole, number>): number {
  const coveringRoles = COMPLIANCE_STAFF_ROLE_ORDER.filter((role) => COMPLIANCE_STAFF_INFO[role].coverage.includes(category))
  const coverage = coveringRoles.reduce((sum, role) => sum + Math.min(2, staffing[role] ?? 0), 0)
  return Math.min(95, 30 + coverage * 20)
}

export function driftComplianceRating(current: number, target: number): number {
  return Math.max(0, Math.min(100, Math.round(current + (target - current) * 0.25)))
}

/** More active laws touching a category, and a lower rating in that category, both raise the odds of an inspection landing there this year. */
export function computeInspectionProbability(rating: number, activeLawsInCategory: number, difficulty: DifficultyProfile): number {
  const base = 0.03 + activeLawsInCategory * 0.03
  const ratingRelief = (rating / 100) * 0.06
  return Math.max(0.01, Math.min(0.4, (base - ratingRelief) * difficulty.volatility))
}

export function computeComplianceStaffAnnualSalary(role: ComplianceStaffRole, industry: IndustryProfile, difficulty: DifficultyProfile): number {
  return Math.round((unitCost(industry) * COMPLIANCE_STAFF_INFO[role].annualSalaryFactor * difficulty.costMultiplier) / 50) * 50
}
