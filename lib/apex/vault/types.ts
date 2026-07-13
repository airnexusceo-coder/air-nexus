export type TechnologyType = 'defence' | 'breach'

export type TechnologyDefinition = {
  id: string
  slug: string
  name: string
  technologyType: TechnologyType
  description: string
  npAcquisitionCost: number
  capacityCost: number
  startupEnergyCost: number
  upkeepEnergyPerHour: number
  activationEnergyCost: number
  owned: boolean
}

export type InstalledDefence = {
  id: string
  technologyId: string
  slug: string
  name: string
  capacityCost: number
  upkeepEnergyPerHour: number
  defenceOrder: number
  energyPriority: number
  isEnabled: boolean
}

export type VaultStatus = 'secured' | 'deficit' | 'destabilised'

export type VaultOverview = {
  coreEnergy: number
  vaultIntegrity: number
  generatorLevel: number
  energyStorageCapacity: number
  energyOutputPerHour: number
  energyUpkeepPerHour: number
  netEnergyFlowPerHour: number
  /** Hours current reserves will last at the current net flow; null if flow is >= 0. */
  reservesLastHours: number | null
  status: VaultStatus
  autoRepairEnabled: boolean
  autoRepairReserve: number
  breachesEnabled: boolean
  defenceCapacityUsed: number
  defenceCapacityMax: number
  installedDefences: InstalledDefence[]
}

export type ApexTargetStatus = 'available' | 'protected' | 'breaches_disabled' | 'limit_reached'

export type ApexTarget = {
  userId: string
  displayName: string
  apexRankLabel: string
  vaultSignal: 'stable' | 'elevated_activity' | 'unstable' | 'weakening'
  defenceLayerCount: number
  status: ApexTargetStatus
  breachesUsedInWindow: number
  breachesMaxInWindow: number
  targetType?: 'player' | 'bot'
  difficulty?: 'Training' | 'Standard' | 'Elite'
}

// ---------------------------------------------------------------------------
// Breach — sanitized, purpose-built DTOs. NEVER a raw `apex_breach_layers` or
// `apex_breach_events` row: unrevealed layers must never carry technology
// identity to the client, and the event log is redacted per-viewer (attacker
// vs defender see different things — see lib/apex/vault/breach.ts).
// ---------------------------------------------------------------------------

export type BreachSessionStatus = 'active' | 'completed' | 'expired' | 'abandoned'
export type BreachResult = 'breached' | 'contained' | 'retreated'
export type BreachAction = 'scan' | 'probe' | 'use_tool' | 'overload' | 'retreat'
export type BreachStageLabel = 'Outer Perimeter' | 'Inner Sanctum' | 'Core Gate'

export type SanitizedBreachLayer = {
  layerIndex: number
  label: BreachStageLabel
  /** True once the attacker has scanned or attacked this layer. */
  revealed: boolean
  /** null until revealed — the defence's identity is hidden information. */
  name: string | null
  integrityPercent: number
  broken: boolean
  actionsTaken: number
}

export type BreachLoadoutItem = {
  slug: string
  name: string
  chargesRemaining: number
}

export type BreachEventView = {
  type: string
  message: string
  createdAt: string
}

export type BreachStateDTO = {
  id: string
  status: BreachSessionStatus
  defenderId: string
  defenderName: string
  currentLayerIndex: number
  breachBudgetInitial: number
  breachEnergyRemaining: number
  layers: SanitizedBreachLayer[]
  loadout: BreachLoadoutItem[]
  events: BreachEventView[]
  result: BreachResult | null
  xpAwarded: number
  rewardEnergy: number
  expiresAt: string | null
  practice?: boolean
}

export type BreachHistoryEntry = {
  id: string
  role: 'attacker' | 'defender'
  opponentName: string
  result: BreachResult | null
  status: BreachSessionStatus
  xpAwarded: number
  layersBroken: number
  startedAt: string
  completedAt: string | null
}

export type DefenderActivityEntry = {
  id: string
  attackerName: string
  result: BreachResult | null
  layersBroken: number
  completedAt: string | null
  message: string
}

export type ApexAchievement = {
  slug: string
  name: string
  description: string
  earned: boolean
  earnedAt: string | null
}
