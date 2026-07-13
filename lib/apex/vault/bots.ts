import 'server-only'

import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import type { ServerAuthSession } from '@/lib/supabase/server'
import { SupabaseRequestError } from '@/lib/supabase/server'
import {
  BREACH_REWARD_FRACTION,
  BREACH_SESSION_TTL_MINUTES,
  MAX_ACTIONS_PER_LAYER,
  MIN_VIABLE_BREACH_ENERGY,
  OVERLOAD_COST,
  OVERLOAD_PRESSURE_FRACTION,
  PROBE_COST,
  PROBE_PRESSURE_FRACTION,
  SCAN_COST,
  TOOL_MATCHED_PRESSURE_FRACTION,
  TOOL_MISMATCHED_PRESSURE_FRACTION,
  XP_BASE_VICTORY,
  XP_PARTICIPATION_CONTAINED,
  XP_PER_LAYER_BROKEN,
  sanitizeLayerRow,
} from './breach-config'
import type { ApexTarget, BreachAction, BreachEventView, BreachLoadoutItem, BreachResult, BreachSessionStatus, BreachStateDTO, SanitizedBreachLayer } from './types'

type BotDifficulty = 'Training' | 'Standard' | 'Elite'

type BotLayerDefinition = {
  slug: string
  name: string
  strength: number
}

type BotTargetDefinition = {
  id: string
  displayName: string
  rankLabel: string
  difficulty: BotDifficulty
  vaultSignal: ApexTarget['vaultSignal']
  layers: [BotLayerDefinition, BotLayerDefinition, BotLayerDefinition]
  defaultLoadout: string[]
}

type BotToolDefinition = {
  slug: string
  name: string
  activationEnergyCost: number
  countersSlug: string | null
}

type BotSessionLayer = BotLayerDefinition & {
  layerIndex: number
  integrity: number
  revealed: boolean
  broken: boolean
  actionsTaken: number
}

type BotSession = {
  version: 1
  nonce: string
  ownerUserId: string
  botId: string
  defenderName: string
  status: BreachSessionStatus
  result: BreachResult | null
  currentLayerIndex: number
  breachBudgetInitial: number
  breachEnergyRemaining: number
  xpAwarded: number
  rewardEnergy: number
  startedAt: string
  expiresAt: string
  layers: BotSessionLayer[]
  loadout: BreachLoadoutItem[]
  events: BreachEventView[]
}

export const APEX_BOT_ID_PREFIX = 'apex-bot:'
const BOT_SESSION_PREFIX = 'bot.'
const BOT_SESSION_VERSION = 1
const MAX_BOT_EVENTS = 14

const BOT_TARGETS: BotTargetDefinition[] = [
  {
    id: `${APEX_BOT_ID_PREFIX}sentinel-01`,
    displayName: 'Sentinel-01',
    rankLabel: 'Training Vault',
    difficulty: 'Training',
    vaultSignal: 'stable',
    layers: [
      { slug: 'mirage', name: 'Mirage Shell', strength: 58 },
      { slug: 'firewall', name: 'Firewall Lattice', strength: 72 },
      { slug: 'core-gate', name: 'Sentinel Core Gate', strength: 90 },
    ],
    defaultLoadout: ['true-signal', 'phase-signal', 'signal-probe'],
  },
  {
    id: `${APEX_BOT_ID_PREFIX}cipher-mirror`,
    displayName: 'Cipher Mirror',
    rankLabel: 'Silver Simulation',
    difficulty: 'Standard',
    vaultSignal: 'elevated_activity',
    layers: [
      { slug: 'ghost-layer', name: 'Ghost Layer', strength: 78 },
      { slug: 'core-lock', name: 'Core Lock', strength: 92 },
      { slug: 'core-gate', name: 'Mirror Core Gate', strength: 118 },
    ],
    defaultLoadout: ['deep-scan', 'breach-key', 'overclock'],
  },
  {
    id: `${APEX_BOT_ID_PREFIX}blackbox-vault`,
    displayName: 'Blackbox Vault',
    rankLabel: 'Gold Simulation',
    difficulty: 'Elite',
    vaultSignal: 'unstable',
    layers: [
      { slug: 'core-shield', name: 'Core Shield', strength: 105 },
      { slug: 'signal-redirect', name: 'Signal Redirect', strength: 118 },
      { slug: 'fortress-core', name: 'Fortress Core', strength: 155 },
    ],
    defaultLoadout: ['overclock', 'signal-fork', 'emergency-extract'],
  },
]

const BOT_TOOLS: BotToolDefinition[] = [
  { slug: 'signal-probe', name: 'Signal Probe', activationEnergyCost: 40, countersSlug: null },
  { slug: 'breach-key', name: 'Breach Key', activationEnergyCost: 90, countersSlug: 'core-lock' },
  { slug: 'phase-signal', name: 'Phase Signal', activationEnergyCost: 150, countersSlug: 'firewall' },
  { slug: 'true-signal', name: 'True Signal', activationEnergyCost: 70, countersSlug: 'mirage' },
  { slug: 'overclock', name: 'Overclock', activationEnergyCost: 180, countersSlug: 'core-shield' },
  { slug: 'deep-scan', name: 'Deep Scan', activationEnergyCost: 110, countersSlug: 'ghost-layer' },
  { slug: 'emergency-extract', name: 'Emergency Extract', activationEnergyCost: 50, countersSlug: null },
  { slug: 'signal-fork', name: 'Signal Fork', activationEnergyCost: 130, countersSlug: null },
]

const VALID_ACTIONS: BreachAction[] = ['scan', 'probe', 'use_tool', 'overload', 'retreat']

export function listApexBotTargets(): ApexTarget[] {
  return BOT_TARGETS.map((bot) => ({
    userId: bot.id,
    displayName: bot.displayName,
    apexRankLabel: bot.rankLabel,
    vaultSignal: bot.vaultSignal,
    defenceLayerCount: bot.layers.length,
    status: 'available',
    breachesUsedInWindow: 0,
    breachesMaxInWindow: 999,
    targetType: 'bot',
    difficulty: bot.difficulty,
  }))
}

export function isApexBotTargetId(value: string) {
  return value.startsWith(APEX_BOT_ID_PREFIX)
}

export function isApexBotSessionId(value: string) {
  return value.startsWith(BOT_SESSION_PREFIX)
}

export async function startBotBreach(
  auth: ServerAuthSession,
  botId: string,
  breachBudget: number,
  loadoutSlugs: string[],
): Promise<{ id: string; status: 'active'; defenderId: string; breachBudgetInitial: number; breachEnergyRemaining: number; currentLayerIndex: number; startedAt: string }> {
  const bot = getBotTarget(botId)
  const budget = Math.max(150, Math.min(2500, Math.floor(Number(breachBudget) || 500)))
  const selectedLoadout = buildPracticeLoadout(loadoutSlugs.length > 0 ? loadoutSlugs : bot.defaultLoadout)
  const startedAt = new Date()
  const session: BotSession = {
    version: BOT_SESSION_VERSION,
    nonce: randomUUID(),
    ownerUserId: auth.user.id,
    botId,
    defenderName: bot.displayName,
    status: 'active',
    result: null,
    currentLayerIndex: 0,
    breachBudgetInitial: budget,
    breachEnergyRemaining: budget,
    xpAwarded: 0,
    rewardEnergy: 0,
    startedAt: startedAt.toISOString(),
    expiresAt: new Date(startedAt.getTime() + BREACH_SESSION_TTL_MINUTES * 60 * 1000).toISOString(),
    layers: bot.layers.map((layer, index) => ({
      ...layer,
      layerIndex: index,
      integrity: layer.strength,
      revealed: false,
      broken: false,
      actionsTaken: 0,
    })),
    loadout: selectedLoadout,
    events: [
      {
        type: 'practice_started',
        message: `${bot.displayName} opened a practice Vault. No player Vault will be damaged.`,
        createdAt: startedAt.toISOString(),
      },
    ],
  }

  return {
    id: encodeBotSession(session),
    status: 'active',
    defenderId: botId,
    breachBudgetInitial: budget,
    breachEnergyRemaining: budget,
    currentLayerIndex: 0,
    startedAt: session.startedAt,
  }
}

export async function getBotBreachState(auth: ServerAuthSession, breachId: string): Promise<BreachStateDTO> {
  const session = decodeBotSession(breachId)
  assertBotOwner(auth, session)
  return toBotStateDTO(expireIfNeeded(session))
}

export async function takeBotBreachAction(auth: ServerAuthSession, breachId: string, action: string, technologySlug: string | null): Promise<BreachStateDTO> {
  if (!VALID_ACTIONS.includes(action as BreachAction)) throw new SupabaseRequestError('Unknown breach action.', 400)
  const session = expireIfNeeded(decodeBotSession(breachId))
  assertBotOwner(auth, session)
  if (session.status !== 'active') throw new SupabaseRequestError('This practice breach has already ended.', 409)

  if (action === 'retreat') {
    return toBotStateDTO(finalizeBotSession(session, 'retreated'))
  }

  const layer = session.layers[session.currentLayerIndex]
  if (!layer) throw new SupabaseRequestError('Practice breach layer not found.', 404)
  if (layer.broken) throw new SupabaseRequestError('This layer is already breached.', 409)

  if (action === 'scan') {
    if (layer.revealed) throw new SupabaseRequestError('This layer has already been scanned.', 409)
    spendBotEnergy(session, SCAN_COST)
    layer.revealed = true
    appendBotEvent(session, 'scan', `Scan complete - ${layer.name} identified.`)
    return toBotStateDTO(session)
  }

  let cost = PROBE_COST
  let pressureFraction = PROBE_PRESSURE_FRACTION
  let matchedCounter = false
  let actionLabel = 'Standard probe'

  if (action === 'overload') {
    cost = OVERLOAD_COST
    pressureFraction = OVERLOAD_PRESSURE_FRACTION
    actionLabel = 'Overload pressure'
  }

  if (action === 'use_tool') {
    const tool = BOT_TOOLS.find((item) => item.slug === technologySlug)
    if (!tool) throw new SupabaseRequestError('Unknown breach technology.', 400)
    const loadoutItem = session.loadout.find((item) => item.slug === tool.slug)
    if (!loadoutItem) throw new SupabaseRequestError('That technology is not equipped for this practice breach.', 403)
    if (loadoutItem.chargesRemaining <= 0) throw new SupabaseRequestError('That technology has no charges left in this breach.', 409)
    loadoutItem.chargesRemaining -= 1
    cost = tool.activationEnergyCost
    matchedCounter = tool.countersSlug === layer.slug
    pressureFraction = matchedCounter ? TOOL_MATCHED_PRESSURE_FRACTION : TOOL_MISMATCHED_PRESSURE_FRACTION
    actionLabel = matchedCounter ? `${tool.name} exploited a direct weakness` : `${tool.name} struck an awkward matchup`
  }

  spendBotEnergy(session, cost)
  const randomFactor = randomInt(850, 1151) / 1000
  const pressure = Math.max(1, Math.round(layer.strength * pressureFraction * randomFactor))
  layer.integrity = Math.max(0, layer.integrity - pressure)
  layer.actionsTaken += 1
  layer.revealed = true
  appendBotEvent(session, 'layer_pressure', `${actionLabel} against ${layer.name}. ${pressure} pressure applied.`)

  if (layer.integrity <= 0) {
    layer.broken = true
    appendBotEvent(session, 'layer_broken', `${layer.name} breached.`)
    if (session.currentLayerIndex >= session.layers.length - 1) {
      return toBotStateDTO(finalizeBotSession(session, 'breached'))
    }
    session.currentLayerIndex += 1
    appendBotEvent(session, 'layer_advanced', 'A new defensive layer has been detected ahead.')
    return toBotStateDTO(session)
  }

  if (session.breachEnergyRemaining < MIN_VIABLE_BREACH_ENERGY || layer.actionsTaken >= MAX_ACTIONS_PER_LAYER) {
    return toBotStateDTO(finalizeBotSession(session, 'contained'))
  }

  return toBotStateDTO(session)
}

function getBotTarget(botId: string) {
  const bot = BOT_TARGETS.find((item) => item.id === botId)
  if (!bot) throw new SupabaseRequestError('Practice bot not found.', 404)
  return bot
}

function buildPracticeLoadout(slugs: string[]): BreachLoadoutItem[] {
  const uniqueSlugs = [...new Set(slugs)].slice(0, 3)
  const tools = uniqueSlugs
    .map((slug) => BOT_TOOLS.find((tool) => tool.slug === slug))
    .filter((tool): tool is BotToolDefinition => Boolean(tool))

  const resolvedTools = tools.length > 0 ? tools : BOT_TOOLS.slice(0, 3)
  return resolvedTools.map((tool) => ({ slug: tool.slug, name: tool.name, chargesRemaining: 1 }))
}

function assertBotOwner(auth: ServerAuthSession, session: BotSession) {
  if (session.ownerUserId !== auth.user.id) throw new SupabaseRequestError('Not your practice breach session.', 403)
}

function spendBotEnergy(session: BotSession, cost: number) {
  if (session.breachEnergyRemaining < cost) throw new SupabaseRequestError('Not enough breach energy remaining for that action.', 400)
  session.breachEnergyRemaining -= cost
}

function appendBotEvent(session: BotSession, type: string, message: string) {
  session.events = [...session.events, { type, message, createdAt: new Date().toISOString() }].slice(-MAX_BOT_EVENTS)
}

function expireIfNeeded(session: BotSession) {
  if (session.status === 'active' && Date.now() > new Date(session.expiresAt).getTime()) {
    session.status = 'expired'
    session.result = 'contained'
    appendBotEvent(session, 'expired', 'The practice breach window expired.')
  }
  return session
}

function finalizeBotSession(session: BotSession, result: BreachResult) {
  if (session.status !== 'active') return session
  const layersBroken = session.layers.filter((layer) => layer.broken).length
  const reachedInnerLayer = session.currentLayerIndex >= 1 || layersBroken > 0
  session.status = 'completed'
  session.result = result
  session.xpAwarded = result === 'breached' ? XP_BASE_VICTORY + layersBroken * XP_PER_LAYER_BROKEN : result === 'contained' && reachedInnerLayer ? XP_PARTICIPATION_CONTAINED : 0
  session.rewardEnergy = result === 'breached' ? Math.round(session.breachBudgetInitial * BREACH_REWARD_FRACTION) : 0
  appendBotEvent(session, 'breach_result', result === 'breached' ? 'Practice Vault breached.' : result === 'retreated' ? 'You retreated from the practice breach.' : 'The practice Vault contained your breach.')
  return session
}

function toBotStateDTO(session: BotSession): BreachStateDTO {
  const layers: SanitizedBreachLayer[] = session.layers.map((layer) =>
    sanitizeLayerRow({
      layer_index: layer.layerIndex,
      name: layer.name,
      integrity: layer.integrity,
      strength: layer.strength,
      is_broken: layer.broken,
      is_revealed: layer.revealed,
      actions_taken: layer.actionsTaken,
    }),
  )

  return {
    id: encodeBotSession(session),
    status: session.status,
    defenderId: session.botId,
    defenderName: session.defenderName,
    currentLayerIndex: session.currentLayerIndex,
    breachBudgetInitial: session.breachBudgetInitial,
    breachEnergyRemaining: session.breachEnergyRemaining,
    layers,
    loadout: session.loadout,
    events: session.events,
    result: session.result,
    xpAwarded: session.xpAwarded,
    rewardEnergy: session.rewardEnergy,
    expiresAt: session.expiresAt,
    practice: true,
  }
}

function encodeBotSession(session: BotSession) {
  const payload = deflateRawSync(Buffer.from(JSON.stringify(session), 'utf8')).toString('base64url')
  return `${BOT_SESSION_PREFIX}${payload}.${signPayload(payload)}`
}

function decodeBotSession(value: string): BotSession {
  const parts = value.split('.')
  if (parts.length !== 3 || parts[0] !== 'bot') throw new SupabaseRequestError('Practice breach session not found.', 404)
  const [, payload, signature] = parts
  if (!safeEqual(signature, signPayload(payload))) throw new SupabaseRequestError('Practice breach session expired or invalid.', 403)
  try {
    const parsed = JSON.parse(inflateRawSync(Buffer.from(payload, 'base64url')).toString('utf8')) as Partial<BotSession>
    if (parsed.version !== BOT_SESSION_VERSION || typeof parsed.ownerUserId !== 'string' || typeof parsed.botId !== 'string') {
      throw new Error('invalid bot session')
    }
    return parsed as BotSession
  } catch {
    throw new SupabaseRequestError('Practice breach session expired or invalid.', 403)
  }
}

function signPayload(payload: string) {
  return createHmac('sha256', botSessionSecret()).update(payload).digest('base64url').slice(0, 32)
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function botSessionSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AIRGPT_ADMIN_PASSWORD_HASH || process.env.SUPABASE_ANON_KEY || 'airnexus-apex-practice-v1'
}
