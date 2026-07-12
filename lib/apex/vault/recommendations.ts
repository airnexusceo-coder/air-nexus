import type { VaultOverview } from './types'

export type VaultRecommendation = { id: string; message: string; severity: 'info' | 'warning' }

/**
 * Deterministic, rule-based Vault advice derived from real state — never an
 * AI guess. Used on the Apex home screen so the player always has a clear
 * next action.
 *
 * Deliberately has no `server-only` import: it's pure and called directly
 * from the client (`apex-home.tsx`) using the `VaultOverview` already
 * fetched from `/api/apex/vault`, not re-fetched.
 */
export function deriveVaultRecommendations(overview: VaultOverview): VaultRecommendation[] {
  const recommendations: VaultRecommendation[] = []

  if (overview.vaultIntegrity < 50) {
    recommendations.push({ id: 'integrity-low', message: 'Vault Integrity is below 50% — repair it in Manage Vault before your next breach.', severity: 'warning' })
  }
  if (overview.netEnergyFlowPerHour < 0) {
    recommendations.push({ id: 'deficit', message: 'Energy upkeep exceeds generation — deactivate a lower-priority system to stop the drain.', severity: 'warning' })
  }
  const disabledCount = overview.installedDefences.filter((defence) => !defence.isEnabled).length
  if (disabledCount > 0) {
    recommendations.push({ id: 'disabled-defences', message: `${disabledCount} defence system${disabledCount === 1 ? '' : 's'} ${disabledCount === 1 ? 'is' : 'are'} offline from insufficient Core Energy.`, severity: 'warning' })
  }
  if (overview.installedDefences.length === 0) {
    recommendations.push({ id: 'no-defences', message: 'No defence systems installed — your Vault relies on baseline protection only.', severity: 'info' })
  } else if (overview.defenceCapacityUsed < overview.defenceCapacityMax) {
    recommendations.push({ id: 'capacity-available', message: `${overview.defenceCapacityMax - overview.defenceCapacityUsed} Defence Capacity available — visit the Systems Lab to strengthen your Vault.`, severity: 'info' })
  }

  return recommendations
}
