import type { TechnologyType } from './types'

export const CORE_ENERGY_SETUP_DEFENCE_SLUGS = new Set([
  'mirage',
  'firewall',
  'core-lock',
  'ghost-layer',
  'counter-trace',
])

export const ADVANCED_STRENGTH_DEFENCE_SLUGS = new Set([
  'core-shield',
  'signal-redirect',
  'fortress-core',
])

export function isCoreEnergySetupDefence(slug: string) {
  return CORE_ENERGY_SETUP_DEFENCE_SLUGS.has(slug)
}

export function isAdvancedStrengthDefence(slug: string) {
  return ADVANCED_STRENGTH_DEFENCE_SLUGS.has(slug)
}

export function effectiveNexusPointCost(slug: string, technologyType: TechnologyType, catalogCost: number) {
  if (technologyType === 'breach') return 0
  if (technologyType === 'defence' && isCoreEnergySetupDefence(slug)) return 0
  return Math.max(0, Math.round(Number(catalogCost) || 0))
}

export function requiresNexusPoints(slug: string, technologyType: TechnologyType, catalogCost: number) {
  return effectiveNexusPointCost(slug, technologyType, catalogCost) > 0
}