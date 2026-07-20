import type {
  DifficultyProfile,
  Facility,
  FacilityType,
  FacilityUpgradeId,
  IndustryProfile,
  Region,
  RegionProfile,
} from '@/lib/business-empire/types'

/**
 * Five fictional regions with a genuinely different cost/workforce/access
 * profile each — buying or renting land here is a real trade-off, not a
 * flavour choice. Prices scale from these indices combined with the
 * industry's own price level, so a Cars factory in Harborview costs more
 * than a Clothing warehouse in Eastvale, but the regional shape stays
 * consistent across every industry.
 */
export const REGION_PROFILES: Record<Region, RegionProfile> = {
  northgate: {
    id: 'northgate', name: 'Northgate', description: 'A dense, established commercial district — expensive but well-connected and highly visible to customers.',
    costOfLivingIndex: 1.35, wageLevel: 1.25, propertyTaxRate: 0.022, transportAccess: 'high', customerAccess: 'high',
    availableWorkforce: 'abundant', educationLevel: 'highly-skilled', utilityCostIndex: 1.2, environmentalRestrictions: 'strict',
    disasterRisk: 0.03, expansionCapacity: 'limited', nearbyCompetitors: 'abundant',
  },
  riverside: {
    id: 'riverside', name: 'Riverside', description: 'A mixed-use waterfront area — good transport links, moderate costs, occasional flood risk.',
    costOfLivingIndex: 1.05, wageLevel: 1.05, propertyTaxRate: 0.016, transportAccess: 'high', customerAccess: 'medium',
    availableWorkforce: 'moderate', educationLevel: 'skilled', utilityCostIndex: 1.0, environmentalRestrictions: 'moderate',
    disasterRisk: 0.09, expansionCapacity: 'moderate', nearbyCompetitors: 'moderate',
  },
  harborview: {
    id: 'harborview', name: 'Harborview', description: 'An industrial port district — strong logistics access, lower property costs, heavier regulation on emissions.',
    costOfLivingIndex: 0.85, wageLevel: 0.95, propertyTaxRate: 0.014, transportAccess: 'high', customerAccess: 'low',
    availableWorkforce: 'abundant', educationLevel: 'skilled', utilityCostIndex: 0.9, environmentalRestrictions: 'strict',
    disasterRisk: 0.05, expansionCapacity: 'ample', nearbyCompetitors: 'limited',
  },
  eastvale: {
    id: 'eastvale', name: 'Eastvale', description: 'A quiet outer-suburb area — cheap land and low wages, but limited transport and a smaller customer base.',
    costOfLivingIndex: 0.55, wageLevel: 0.75, propertyTaxRate: 0.009, transportAccess: 'low', customerAccess: 'low',
    availableWorkforce: 'moderate', educationLevel: 'basic', utilityCostIndex: 0.8, environmentalRestrictions: 'light',
    disasterRisk: 0.02, expansionCapacity: 'ample', nearbyCompetitors: 'limited',
  },
  'summit-ridge': {
    id: 'summit-ridge', name: 'Summit Ridge', description: 'An affluent suburban centre popular with premium and luxury brands — high customer spending power, tight zoning.',
    costOfLivingIndex: 1.5, wageLevel: 1.15, propertyTaxRate: 0.025, transportAccess: 'medium', customerAccess: 'high',
    availableWorkforce: 'limited', educationLevel: 'highly-skilled', utilityCostIndex: 1.1, environmentalRestrictions: 'strict',
    disasterRisk: 0.04, expansionCapacity: 'limited', nearbyCompetitors: 'moderate',
  },
}

export const REGION_ORDER: Region[] = ['northgate', 'riverside', 'harborview', 'eastvale', 'summit-ridge']

export type FacilityTypeInfo = {
  id: FacilityType
  label: string
  description: string
  /** Multiplies the base cost unit (industry averagePrice x this) for purchase price; rent is roughly purchase price / 12. */
  costFactor: number
  /** Years of construction before the facility becomes usable (0 for facilities that open immediately, like renting an existing retail space). */
  constructionYears: number
  /** Yearly base maintenance, before regional utility/upkeep multipliers. */
  baseMaintenance: number
}

export const FACILITY_TYPE_INFO: Record<FacilityType, FacilityTypeInfo> = {
  headquarters: { id: 'headquarters', label: 'Headquarters', description: 'Your administrative base — required before other facility types feel "official", and a small ongoing reputation-with-investors signal.', costFactor: 40, constructionYears: 1, baseMaintenance: 1_200 },
  factory: { id: 'factory', label: 'Factory', description: 'Increases production capacity and lowers per-unit cost once built.', costFactor: 90, constructionYears: 2, baseMaintenance: 2_600 },
  warehouse: { id: 'warehouse', label: 'Warehouse', description: 'Expands how much inventory you can carry without extra storage cost.', costFactor: 45, constructionYears: 1, baseMaintenance: 1_400 },
  'retail-store': { id: 'retail-store', label: 'Retail Store', description: 'A physical storefront — improves customer access and awareness growth in this region.', costFactor: 55, constructionYears: 0, baseMaintenance: 1_800 },
  'research-centre': { id: 'research-centre', label: 'Research Centre', description: 'Lowers research and R&D costs for products developed while it is active.', costFactor: 70, constructionYears: 1, baseMaintenance: 2_000 },
  'distribution-centre': { id: 'distribution-centre', label: 'Distribution Centre', description: 'Reduces production delay risk and speeds delivery.', costFactor: 60, constructionYears: 1, baseMaintenance: 1_900 },
  'customer-support-centre': { id: 'customer-support-centre', label: 'Customer Support Centre', description: 'Improves complaint handling — modestly reduces complaint-driven reputation damage.', costFactor: 35, constructionYears: 0, baseMaintenance: 1_300 },
  'data-centre': { id: 'data-centre', label: 'Data Centre', description: 'Backs advertising and research analytics — small effectiveness boost to both.', costFactor: 65, constructionYears: 1, baseMaintenance: 2_200 },
}

export const FACILITY_TYPE_ORDER: FacilityType[] = ['headquarters', 'factory', 'warehouse', 'retail-store', 'research-centre', 'distribution-centre', 'customer-support-centre', 'data-centre']

export type FacilityUpgradeInfo = {
  id: FacilityUpgradeId
  label: string
  description: string
  costFactor: number
}

export const FACILITY_UPGRADE_INFO: Record<FacilityUpgradeId, FacilityUpgradeInfo> = {
  'production-capacity': { id: 'production-capacity', label: 'Production capacity', description: 'Expands manufacturing throughput at this facility.', costFactor: 18 },
  automation: { id: 'automation', label: 'Automation', description: 'Cuts production cost per unit, at the cost of a small morale dip during the changeover.', costFactor: 25 },
  'storage-expansion': { id: 'storage-expansion', label: 'Storage expansion', description: 'Lowers storage costs for carried inventory.', costFactor: 12 },
  'renewable-energy': { id: 'renewable-energy', label: 'Renewable energy', description: 'Reduces utility costs and improves environmental reputation.', costFactor: 15 },
  'safety-systems': { id: 'safety-systems', label: 'Safety systems', description: 'Lowers recall and workplace-incident risk.', costFactor: 14 },
  security: { id: 'security', label: 'Security', description: 'Reduces disaster and theft-related loss risk.', costFactor: 10 },
  'employee-facilities': { id: 'employee-facilities', label: 'Employee facilities', description: 'Improves staff morale at this facility.', costFactor: 11 },
  'faster-shipping': { id: 'faster-shipping', label: 'Faster shipping', description: 'Improves customer satisfaction tied to delivery speed.', costFactor: 13 },
  'quality-control': { id: 'quality-control', label: 'Quality control equipment', description: 'Improves product reliability for goods made here.', costFactor: 16 },
}

export const FACILITY_UPGRADE_ORDER: FacilityUpgradeId[] = ['production-capacity', 'automation', 'storage-expansion', 'renewable-energy', 'safety-systems', 'security', 'employee-facilities', 'faster-shipping', 'quality-control']

function unitCost(industry: IndustryProfile): number {
  return Math.max(20, industry.averagePrice)
}

export function computeFacilityPurchasePrice(type: FacilityType, region: Region, industry: IndustryProfile, difficulty: DifficultyProfile): number {
  const info = FACILITY_TYPE_INFO[type]
  const regionProfile = REGION_PROFILES[region]
  const base = unitCost(industry) * info.costFactor * regionProfile.costOfLivingIndex * difficulty.costMultiplier
  return Math.max(2_000, Math.round(base / 100) * 100)
}

export function computeFacilityAnnualRent(type: FacilityType, region: Region, industry: IndustryProfile, difficulty: DifficultyProfile): number {
  return Math.max(500, Math.round((computeFacilityPurchasePrice(type, region, industry, difficulty) / 11) / 50) * 50)
}

/** Storage/insurance/maintenance-style ongoing cost for one facility, before construction is finished (which still needs upkeep) — property tax applies only to owned facilities. */
export function computeFacilityUpkeep(facility: Facility, industry: IndustryProfile, difficulty: DifficultyProfile): number {
  const info = FACILITY_TYPE_INFO[facility.type]
  const regionProfile = REGION_PROFILES[facility.region]
  const maintenance = info.baseMaintenance * regionProfile.utilityCostIndex * difficulty.costMultiplier
  const propertyTax = facility.ownership === 'owned' ? facility.currentValue * regionProfile.propertyTaxRate : 0
  const rent = facility.ownership === 'rented' ? facility.annualRent : 0
  const securityDiscount = facility.upgrades.includes('renewable-energy') ? 0.85 : 1
  return Math.round((maintenance * securityDiscount + propertyTax + rent) * 100) / 100
}

/** Wage expectations scale with the regional wage level and are gently softened by strong employee reputation (a trusted employer can attract staff without matching every dollar of local wage pressure). */
export function computeRegionalWageMultiplier(region: Region, employeeReputation: number): number {
  const regionProfile = REGION_PROFILES[region]
  const reputationRelief = Math.max(0, (employeeReputation - 50) / 100) * 0.1
  return Math.max(0.5, regionProfile.wageLevel - reputationRelief)
}

/** A blended production-cost multiplier from every active (built, non-construction) factory/automation facility the company owns or rents — capped so facilities help but never make production nearly free. */
export function computeFacilityProductionDiscount(facilities: Facility[]): number {
  const activeFactories = facilities.filter((facility) => !facility.underConstruction && (facility.type === 'factory' || facility.type === 'distribution-centre'))
  if (activeFactories.length === 0) return 1
  let discount = 1
  for (const facility of activeFactories) {
    discount *= facility.type === 'factory' ? 0.97 : 0.99
    if (facility.upgrades.includes('automation')) discount *= 0.94
    if (facility.upgrades.includes('production-capacity')) discount *= 0.98
  }
  return Math.max(0.65, discount)
}

/** Owned property values drift year to year with the region's own trend, distinct from and on top of general economic conditions — represented as a small named factor, never silent. */
export function computePropertyValueDrift(currentValue: number, region: Region, rng: () => number): number {
  const regionProfile = REGION_PROFILES[region]
  const baseTrend = regionProfile.expansionCapacity === 'limited' ? 0.03 : regionProfile.expansionCapacity === 'moderate' ? 0.015 : 0.005
  const noise = (rng() - 0.5) * 0.04
  const changeFraction = baseTrend + noise
  return Math.round(currentValue * (1 + changeFraction) * 100) / 100
}
