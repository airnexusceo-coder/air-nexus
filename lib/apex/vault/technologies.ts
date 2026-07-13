import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import type { ServerAuthSession } from '@/lib/supabase/server'
import { effectiveNexusPointCost, isCoreEnergySetupDefence } from './technology-costs'
import type { TechnologyDefinition } from './types'

function encode(value: string) {
  return encodeURIComponent(value)
}

type TechnologyRow = {
  id: string
  slug: string
  name: string
  technology_type: 'defence' | 'breach'
  description: string
  np_acquisition_cost: number
  capacity_cost: number
  startup_energy_cost: number
  upkeep_energy_per_hour: number
  activation_energy_cost: number
  is_active: boolean
}

function toDefinition(row: TechnologyRow, owned: boolean): TechnologyDefinition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    technologyType: row.technology_type,
    description: row.description,
    npAcquisitionCost: effectiveNexusPointCost(row.slug, row.technology_type, row.np_acquisition_cost),
    capacityCost: row.capacity_cost,
    startupEnergyCost: row.startup_energy_cost,
    upkeepEnergyPerHour: row.upkeep_energy_per_hour,
    activationEnergyCost: row.activation_energy_cost,
    owned,
  }
}

/**
 * Full technology catalog + this user's ownership flags. The catalog itself
 * is public (RLS: select-true), read with the service role for a stable,
 * single trusted view; ownership is looked up from `apex_user_technologies`.
 */
export async function listTechnologies(userId: string): Promise<TechnologyDefinition[]> {
  const [catalogResponse, ownedResponse] = await Promise.all([
    supabaseServiceFetch('/apex_technologies?is_active=eq.true&order=technology_type.asc,name.asc&select=*'),
    supabaseServiceFetch(`/apex_user_technologies?user_id=eq.${encode(userId)}&select=technology_id`),
  ])
  const [catalog, owned] = await Promise.all([
    readSupabaseRestJson<TechnologyRow[]>(catalogResponse, 'Failed to load technology catalog'),
    readSupabaseRestJson<{ technology_id: string }[]>(ownedResponse, 'Failed to load owned technology'),
  ])
  const ownedIds = new Set(owned.map((row) => row.technology_id))
  return catalog.map((row) => toDefinition(row, ownedIds.has(row.id) || (row.technology_type === 'defence' && isCoreEnergySetupDefence(row.slug))))
}

/**
 * Records technology ownership. This is server-side and trusted for the
 * OWNERSHIP write itself. The Nexus Points cost check is NOT independently
 * verified here — see APEX_HANDOFF.md ("Nexus Points integration"): AirGPT
 * has no server-side NP ledger anywhere yet (NP lives in client localStorage
 * app-wide), so this endpoint trusts the client's report that it already
 * spent the NP, exactly like the existing Marketplace reward-redemption flow
 * does. That gap is inherited from the platform, not introduced here.
 */
export async function acquireTechnology(auth: ServerAuthSession, technologySlug: string): Promise<TechnologyDefinition> {
  const userId = auth.user.id
  if (typeof technologySlug !== 'string' || !technologySlug) throw new SupabaseRequestError('Technology is required.', 400)

  const techResponse = await supabaseServiceFetch(`/apex_technologies?slug=eq.${encode(technologySlug)}&is_active=eq.true&select=*`)
  const techRows = await readSupabaseRestJson<TechnologyRow[]>(techResponse, 'Failed to load technology')
  const tech = techRows[0]
  if (!tech) throw new SupabaseRequestError('Unknown technology.', 404)

  const existingResponse = await supabaseServiceFetch(
    `/apex_user_technologies?user_id=eq.${encode(userId)}&technology_id=eq.${encode(tech.id)}&select=technology_id`,
  )
  const existing = await readSupabaseRestJson<unknown[]>(existingResponse, 'Failed to check ownership')
  if (existing.length > 0) throw new SupabaseRequestError('Technology already owned.', 409)

  const insertResponse = await supabaseServiceFetch('/apex_user_technologies', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, technology_id: tech.id }),
  })
  if (!insertResponse.ok) await readSupabaseRestJson(insertResponse, 'Could not acquire technology')

  return toDefinition(tech, true)
}
