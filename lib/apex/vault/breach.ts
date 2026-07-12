import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'
import { getAcceptedFriends } from '@/lib/airnexus/social'
import { resolveVaultEconomy } from './economy'
import { BREACH_SESSION_TTL_MINUTES, sanitizeLayerRow } from './breach-config'
import { BREACH_TARGET_WINDOW_HOURS, MAX_BREACHES_PER_TARGET, MAX_BREACH_TOOL_SLOTS, POST_BREACH_PROTECTION_HOURS } from './config'
import type {
  BreachAction,
  BreachEventView,
  BreachHistoryEntry,
  BreachLoadoutItem,
  BreachStateDTO,
  DefenderActivityEntry,
  SanitizedBreachLayer,
} from './types'

function encode(value: string) {
  return encodeURIComponent(value)
}

function isoSince(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

async function countBrokenLayers(breachId: string): Promise<number> {
  const rows = await readSupabaseRestJson<unknown[]>(
    await supabaseServiceFetch(`/apex_breach_layers?breach_id=eq.${encode(breachId)}&is_broken=eq.true&select=id`),
    'Failed to load layer counts',
  )
  return rows.length
}

async function displayName(userId: string): Promise<string> {
  const rows = await readSupabaseRestJson<{ display_name: string }[]>(
    await supabaseServiceFetch(`/profiles?user_id=eq.${encode(userId)}&select=display_name`),
    'Failed to load profile',
  )
  return rows[0]?.display_name ?? 'AirNexus student'
}

export type BreachSessionSummary = {
  id: string
  status: 'active' | 'completed' | 'expired' | 'abandoned'
  defenderId: string
  breachBudgetInitial: number
  breachEnergyRemaining: number
  currentLayerIndex: number
  startedAt: string
}

/**
 * Creates a breach session against an accepted friend: validates
 * eligibility/cooldown/protection, resolves the attacker's economy, atomically
 * commits the breach budget, records the equipped loadout, then snapshots the
 * defender's CURRENT active defences into apex_breach_layers (see the
 * migration header for why a snapshot, not live state). If the snapshot step
 * fails after the budget was already committed, the commit is refunded and
 * the session is marked 'abandoned' — the attacker is never left charged
 * with nothing to show for it.
 */
export async function startBreach(
  auth: ServerAuthSession,
  defenderId: string,
  breachBudget: number,
  loadoutSlugs: string[],
): Promise<BreachSessionSummary> {
  const attackerId = auth.user.id
  if (typeof defenderId !== 'string' || !defenderId) throw new SupabaseRequestError('Target is required.', 400)
  if (defenderId === attackerId) throw new SupabaseRequestError('You cannot breach your own Vault.', 400)

  const budget = Math.floor(Number(breachBudget))
  if (!Number.isFinite(budget) || budget <= 0) throw new SupabaseRequestError('Enter a breach budget greater than 0.', 400)

  const tools = Array.isArray(loadoutSlugs) ? loadoutSlugs.filter((slug) => typeof slug === 'string') : []
  if (tools.length > MAX_BREACH_TOOL_SLOTS) throw new SupabaseRequestError(`You may equip at most ${MAX_BREACH_TOOL_SLOTS} breach tools.`, 400)

  const friends = await getAcceptedFriends(auth)
  if (!friends.some((f) => f.user_id === defenderId)) throw new SupabaseRequestError('You can only breach accepted friends.', 403)

  const [defenderVaultRows, recentBreachRows] = await Promise.all([
    readSupabaseRestJson<{ breaches_enabled: boolean }[]>(
      await supabaseServiceFetch(`/apex_vaults?user_id=eq.${encode(defenderId)}&select=breaches_enabled`),
      'Failed to load target Vault',
    ),
    readSupabaseRestJson<{ id: string }[]>(
      await supabaseServiceFetch(
        `/apex_breach_sessions?attacker_user_id=eq.${encode(attackerId)}&defender_user_id=eq.${encode(defenderId)}&started_at=gte.${encode(isoSince(BREACH_TARGET_WINDOW_HOURS))}&select=id`,
      ),
      'Failed to load breach history',
    ),
  ])
  if (!defenderVaultRows[0]?.breaches_enabled) throw new SupabaseRequestError('This student has disabled Apex breaches.', 403)
  if (recentBreachRows.length >= MAX_BREACHES_PER_TARGET) {
    throw new SupabaseRequestError(`Breach limit reached — ${MAX_BREACHES_PER_TARGET} breaches against this Vault in the last ${BREACH_TARGET_WINDOW_HOURS}h.`, 429)
  }
  const recentlyProtected = await readSupabaseRestJson<unknown[]>(
    await supabaseServiceFetch(
      `/apex_breach_sessions?defender_user_id=eq.${encode(defenderId)}&result=eq.breached&completed_at=gte.${encode(isoSince(POST_BREACH_PROTECTION_HOURS))}&select=id`,
    ),
    'Failed to load recovery status',
  )
  if (recentlyProtected.length > 0) throw new SupabaseRequestError('This Vault has active Recovery protection.', 403)

  await resolveVaultEconomy(attackerId)

  let ownedToolIds: { id: string; slug: string }[] = []
  if (tools.length > 0) {
    const ownedResponse = await supabaseServiceFetch(
      `/apex_technologies?slug=in.(${tools.map(encode).join(',')})&technology_type=eq.breach&select=id,slug`,
    )
    ownedToolIds = await readSupabaseRestJson(ownedResponse, 'Failed to load breach tools')
    const ownershipResponse = await supabaseServiceFetch(
      `/apex_user_technologies?user_id=eq.${encode(attackerId)}&technology_id=in.(${ownedToolIds.map((t) => t.id).join(',') || 'null'})&select=technology_id`,
    )
    const owned = await readSupabaseRestJson<{ technology_id: string }[]>(ownershipResponse, 'Failed to verify tool ownership')
    const ownedIds = new Set(owned.map((row) => row.technology_id))
    if (!ownedToolIds.every((t) => ownedIds.has(t.id))) throw new SupabaseRequestError('You can only equip breach tools you own.', 403)
  }

  const commitResponse = await supabaseServiceFetch('/rpc/apex_adjust_core_energy', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: attackerId, p_delta: -budget, p_transaction_type: 'breach_commit', p_source: `breach:${defenderId}` }),
  })
  if (!commitResponse.ok) {
    const text = await commitResponse.text()
    if (text.includes('Insufficient')) throw new SupabaseRequestError('Not enough Core Energy for this breach budget.', 400)
    throw new SupabaseRequestError('Could not commit breach budget.', 502)
  }

  const expiresAt = new Date(Date.now() + BREACH_SESSION_TTL_MINUTES * 60 * 1000).toISOString()
  const sessionResponse = await supabaseServiceFetch('/apex_breach_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      attacker_user_id: attackerId,
      defender_user_id: defenderId,
      status: 'active',
      breach_budget_initial: budget,
      breach_energy_remaining: budget,
      current_layer_index: 0,
      expires_at: expiresAt,
    }),
  })
  const sessions = await readSupabaseRestJson<{ id: string; status: BreachSessionSummary['status']; started_at: string }[]>(sessionResponse, 'Could not create breach session')
  const session = sessions[0]
  if (!session) {
    await refundCommit(attackerId, budget, 'startBreach:session-create-failed')
    throw new SupabaseRequestError('Could not create breach session.', 502)
  }

  try {
    if (ownedToolIds.length > 0) {
      const loadoutResponse = await supabaseServiceFetch('/apex_breach_loadout', {
        method: 'POST',
        body: JSON.stringify(ownedToolIds.map((tool, index) => ({ breach_id: session.id, technology_id: tool.id, slot_index: index, usage_state: 'unused', charges_remaining: 1 }))),
      })
      if (!loadoutResponse.ok) throw new Error('loadout insert failed')
    }

    const layersResponse = await supabaseServiceFetch('/rpc/apex_create_breach_layers', {
      method: 'POST',
      body: JSON.stringify({ p_breach_id: session.id, p_defender_id: defenderId }),
    })
    if (!layersResponse.ok) throw new Error('layer snapshot failed')
  } catch {
    // Never leave the attacker charged with an unusable session.
    await supabaseServiceFetch(`/apex_breach_sessions?id=eq.${encode(session.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'abandoned', finalized: true }),
    })
    await refundCommit(attackerId, budget, `startBreach:setup-failed:${session.id}`)
    throw new SupabaseRequestError('Could not fully start the breach — your Core Energy has been refunded.', 502)
  }

  return {
    id: session.id,
    status: 'active',
    defenderId,
    breachBudgetInitial: budget,
    breachEnergyRemaining: budget,
    currentLayerIndex: 0,
    startedAt: session.started_at,
  }
}

async function refundCommit(userId: string, amount: number, source: string) {
  await supabaseServiceFetch('/rpc/apex_adjust_core_energy', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId, p_delta: amount, p_transaction_type: 'breach_reward', p_source: source }),
  }).catch(() => undefined)
}

type SessionRow = {
  id: string
  attacker_user_id: string
  defender_user_id: string
  status: 'preparing' | 'active' | 'completed' | 'expired' | 'abandoned'
  current_layer_index: number
  breach_budget_initial: number
  breach_energy_remaining: number
  result: 'breached' | 'contained' | 'retreated' | null
  xp_awarded: number
  reward_energy: number
  expires_at: string | null
}

type LayerRow = {
  layer_index: number
  name: string
  integrity: number
  strength: number
  is_broken: boolean
  is_revealed: boolean
  actions_taken: number
}

type LoadoutRow = { technology_id: string; charges_remaining: number; apex_technologies: { slug: string; name: string } }
type EventRow = { event_type: string; event_payload: { message?: string }; created_at: string }

async function fetchSession(breachId: string): Promise<SessionRow> {
  const rows = await readSupabaseRestJson<SessionRow[]>(
    await supabaseServiceFetch(`/apex_breach_sessions?id=eq.${encode(breachId)}&select=*`),
    'Failed to load breach session',
  )
  const session = rows[0]
  if (!session) throw new SupabaseRequestError('Breach session not found.', 404)
  return session
}

/**
 * Builds the sanitised, attacker-facing breach state. Unrevealed layers NEVER
 * carry a technology name — this is the "purpose-built DTO" boundary; nothing
 * upstream of this function is allowed to send a raw apex_breach_layers row
 * to the client.
 */
async function buildBreachState(session: SessionRow): Promise<BreachStateDTO> {
  const [layerRows, loadoutRows, eventRows, defenderNameValue] = await Promise.all([
    readSupabaseRestJson<LayerRow[]>(
      await supabaseServiceFetch(`/apex_breach_layers?breach_id=eq.${encode(session.id)}&order=layer_index.asc&select=layer_index,name,integrity,strength,is_broken,is_revealed,actions_taken`),
      'Failed to load breach layers',
    ),
    readSupabaseRestJson<LoadoutRow[]>(
      await supabaseServiceFetch(`/apex_breach_loadout?breach_id=eq.${encode(session.id)}&select=technology_id,charges_remaining,apex_technologies(slug,name)`),
      'Failed to load breach loadout',
    ),
    readSupabaseRestJson<EventRow[]>(
      await supabaseServiceFetch(`/apex_breach_events?breach_id=eq.${encode(session.id)}&order=created_at.asc&select=event_type,event_payload,created_at`),
      'Failed to load breach events',
    ),
    displayName(session.defender_user_id),
  ])

  const layers: SanitizedBreachLayer[] = layerRows.map(sanitizeLayerRow)

  const loadout: BreachLoadoutItem[] = loadoutRows.map((row) => ({
    slug: row.apex_technologies.slug,
    name: row.apex_technologies.name,
    chargesRemaining: row.charges_remaining,
  }))

  const events: BreachEventView[] = eventRows.map((row) => ({
    type: row.event_type,
    message: row.event_payload?.message ?? row.event_type,
    createdAt: row.created_at,
  }))

  return {
    id: session.id,
    status: session.status === 'preparing' ? 'active' : session.status,
    defenderId: session.defender_user_id,
    defenderName: defenderNameValue,
    currentLayerIndex: session.current_layer_index,
    breachBudgetInitial: session.breach_budget_initial,
    breachEnergyRemaining: session.breach_energy_remaining,
    layers,
    loadout,
    events,
    result: session.result,
    xpAwarded: session.xp_awarded,
    rewardEnergy: session.reward_energy,
    expiresAt: session.expires_at,
  }
}

/** Attacker-only live/finished breach state (the defender's view is the redacted activity feed, not this). */
export async function getBreachState(auth: ServerAuthSession, breachId: string): Promise<BreachStateDTO> {
  const session = await fetchSession(breachId)
  if (session.attacker_user_id !== auth.user.id) throw new SupabaseRequestError('Not your breach session.', 403)
  return buildBreachState(session)
}

const VALID_ACTIONS: BreachAction[] = ['scan', 'probe', 'use_tool', 'overload', 'retreat']

/**
 * Takes one breach decision. All resolution happens inside
 * apex_breach_take_action (SQL, row-locked, atomic) — this function only
 * forwards the action and re-fetches the sanitised result. Duplicate
 * submissions are safe: a finished/expired session rejects further actions
 * with a clear error rather than re-resolving.
 */
export async function takeBreachAction(auth: ServerAuthSession, breachId: string, action: string, technologySlug: string | null): Promise<BreachStateDTO> {
  if (!VALID_ACTIONS.includes(action as BreachAction)) throw new SupabaseRequestError('Unknown breach action.', 400)
  const session = await fetchSession(breachId)
  if (session.attacker_user_id !== auth.user.id) throw new SupabaseRequestError('Not your breach session.', 403)
  if (session.status !== 'active') throw new SupabaseRequestError('This breach has already ended.', 409)

  const response = await supabaseServiceFetch('/rpc/apex_breach_take_action', {
    method: 'POST',
    body: JSON.stringify({ p_breach_id: breachId, p_attacker_id: auth.user.id, p_action: action, p_technology_slug: technologySlug }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new SupabaseRequestError(readableActionError(text), 400)
  }

  const refreshed = await fetchSession(breachId)
  return buildBreachState(refreshed)
}

function readableActionError(rawText: string): string {
  if (rawText.includes('Insufficient breach energy')) return 'Not enough breach energy remaining for that action.'
  if (rawText.includes('No charges remaining')) return 'That technology has no charges left in this breach.'
  if (rawText.includes('Technology not equipped')) return 'That technology is not equipped for this breach.'
  if (rawText.includes('already been scanned')) return 'This layer has already been scanned.'
  if (rawText.includes('already broken')) return 'This layer has already been breached.'
  if (rawText.includes('not active')) return 'This breach is no longer active.'
  return 'Could not resolve that action.'
}

/** Real, server-persisted breach history for the current user (attacker or defender role). */
export async function listBreachHistory(auth: ServerAuthSession, limit = 20): Promise<BreachHistoryEntry[]> {
  const userId = auth.user.id
  const rows = await readSupabaseRestJson<(SessionRow & { started_at: string; completed_at: string | null })[]>(
    await supabaseServiceFetch(
      `/apex_breach_sessions?or=(attacker_user_id.eq.${encode(userId)},defender_user_id.eq.${encode(userId)})&status=in.(completed,expired)&order=completed_at.desc&limit=${limit}&select=*`,
    ),
    'Failed to load breach history',
  )
  if (rows.length === 0) return []

  const layerCounts = await Promise.all(rows.map((row) => countBrokenLayers(row.id)))

  const opponentIds = rows.map((row) => (row.attacker_user_id === userId ? row.defender_user_id : row.attacker_user_id))
  const names = await Promise.all(opponentIds.map((id) => displayName(id)))

  return rows.map((row, index) => ({
    id: row.id,
    role: row.attacker_user_id === userId ? 'attacker' : 'defender',
    opponentName: names[index],
    result: row.result,
    status: row.status === 'preparing' ? 'active' : row.status,
    xpAwarded: row.attacker_user_id === userId ? row.xp_awarded : 0,
    layersBroken: layerCounts[index] ?? 0,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }))
}

/** The defender's activity feed — asynchronous, useful even though they were offline when it happened. */
export async function listDefenderActivity(auth: ServerAuthSession, limit = 10): Promise<DefenderActivityEntry[]> {
  const userId = auth.user.id
  const rows = await readSupabaseRestJson<(SessionRow & { completed_at: string | null })[]>(
    await supabaseServiceFetch(
      `/apex_breach_sessions?defender_user_id=eq.${encode(userId)}&finalized=eq.true&order=completed_at.desc&limit=${limit}&select=*`,
    ),
    'Failed to load defence activity',
  )
  if (rows.length === 0) return []

  const [attackerNames, layerCounts] = await Promise.all([
    Promise.all(rows.map((row) => displayName(row.attacker_user_id))),
    Promise.all(rows.map((row) => countBrokenLayers(row.id))),
  ])

  return rows.map((row, index) => {
    const layersBroken = layerCounts[index] ?? 0
    const message =
      row.result === 'breached'
        ? `A breach succeeded against your Vault — ${layersBroken} defence layer${layersBroken === 1 ? '' : 's'} fell.`
        : row.result === 'retreated'
          ? 'An attacker retreated before reaching your Core Gate.'
          : layersBroken === 0
            ? 'Your Vault held — no defence layers were lost.'
            : `Your Vault contained the breach after ${layersBroken} layer${layersBroken === 1 ? '' : 's'} were pressured.`
    return {
      id: row.id,
      attackerName: attackerNames[index],
      result: row.result,
      layersBroken,
      completedAt: row.completed_at,
      message,
    }
  })
}
