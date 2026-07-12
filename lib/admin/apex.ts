import 'server-only'

import { getVaultOverview } from '@/lib/apex/vault/vault'
import type { VaultOverview } from '@/lib/apex/vault/types'

/** apex.full_access — read-only override so an admin can view any user's Vault state without owning it. */
export async function viewUserVault(userId: string): Promise<VaultOverview> {
  return getVaultOverview(userId)
}
