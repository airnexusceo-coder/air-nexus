import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch } from '@/lib/supabase/server'

function encode(value: string) {
  return encodeURIComponent(value)
}

type ClaimedGrantRow = {
  id: string
  amount: number
  description: string | null
  created_at: string
}

export type ClaimedNexusPointGrant = {
  id: string
  amount: number
  description: string
  createdAt: string
}

export async function claimNexusPointGrants(userId: string): Promise<ClaimedNexusPointGrant[]> {
  const response = await supabaseServiceFetch(
    `/nexus_point_grants?user_id=eq.${encode(userId)}&claimed_at=is.null&select=id,amount,description,created_at`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ claimed_at: new Date().toISOString() }),
    },
  )
  const rows = await readSupabaseRestJson<ClaimedGrantRow[]>(response, 'Could not claim Nexus Points adjustments')
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    description: row.description || (row.amount >= 0 ? 'Admin Nexus Points gift' : 'Admin Nexus Points removal'),
    createdAt: row.created_at,
  }))
}
