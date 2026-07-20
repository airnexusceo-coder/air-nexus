'use client'

import { useMemo, useState } from 'react'
import { Building2, Landmark, Lock } from 'lucide-react'
import { InfoTip } from '@/components/business-empire/info-tip'
import { getRegionAvailability, previewFacilityCost } from '@/lib/business-empire/game-state'
import { FACILITY_TYPE_INFO, FACILITY_TYPE_ORDER, FACILITY_UPGRADE_INFO, FACILITY_UPGRADE_ORDER, REGION_PROFILES } from '@/lib/business-empire/land'
import { formatCurrency } from '@/lib/business-empire/format'
import type { Facility, FacilityOwnership, FacilityType, FacilityUpgradeId, GameState, Region } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type LandFacilitiesPageProps = {
  state: GameState
  onBuild: (type: FacilityType, region: Region, ownership: FacilityOwnership) => { error?: string }
  onUpgrade: (facilityId: string, upgradeId: FacilityUpgradeId) => { error?: string }
  onSell: (facilityId: string) => { error?: string }
  onVacate: (facilityId: string) => { error?: string }
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xs font-semibold capitalize text-white">{value}</p>
    </div>
  )
}

function FacilityCard({ facility, onUpgrade, onSell, onVacate, error }: { facility: Facility; onUpgrade: (upgradeId: FacilityUpgradeId) => void; onSell: () => void; onVacate: () => void; error?: string }) {
  const info = FACILITY_TYPE_INFO[facility.type]
  const region = REGION_PROFILES[facility.region]
  const [pickingUpgrade, setPickingUpgrade] = useState(false)
  const availableUpgrades = FACILITY_UPGRADE_ORDER.filter((id) => !facility.upgrades.includes(id))

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{info.label} · {region.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{facility.ownership === 'owned' ? `Owned · value ${formatCurrency(facility.currentValue)}` : `Rented · ${formatCurrency(facility.annualRent)}/yr · ${facility.leaseYearsRemaining} yr${facility.leaseYearsRemaining === 1 ? '' : 's'} left on lease`}</p>
        </div>
        {facility.underConstruction && <span className="shrink-0 rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">Under construction · {facility.constructionYearsRemaining} yr left</span>}
      </div>
      {facility.upgrades.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {facility.upgrades.map((id) => <span key={id} className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200">{FACILITY_UPGRADE_INFO[id].label}</span>)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setPickingUpgrade((open) => !open)} disabled={availableUpgrades.length === 0} className="secondary-action text-xs disabled:cursor-not-allowed disabled:opacity-40">Upgrade</button>
        {facility.ownership === 'owned'
          ? <button type="button" onClick={onSell} className="secondary-action text-xs">Sell facility</button>
          : <button type="button" onClick={onVacate} className="secondary-action text-xs">Vacate lease</button>}
      </div>
      {pickingUpgrade && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {availableUpgrades.map((id) => {
            const upgrade = FACILITY_UPGRADE_INFO[id]
            return (
              <button key={id} type="button" onClick={() => { onUpgrade(id); setPickingUpgrade(false) }} className="rounded-xl border border-white/8 bg-white/[0.025] p-2.5 text-left transition hover:border-white/20">
                <p className="text-xs font-semibold text-white">{upgrade.label}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{upgrade.description}</p>
              </button>
            )
          })}
        </div>
      )}
      {error && <p role="alert" className="mt-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
    </div>
  )
}

function RegionCard({ region, state, claimed, onBuild }: { region: Region; state: GameState; claimed: boolean; onBuild: (type: FacilityType, ownership: FacilityOwnership) => { error?: string } }) {
  const profile = REGION_PROFILES[region]
  const [expanded, setExpanded] = useState(false)
  const [facilityType, setFacilityType] = useState<FacilityType>('retail-store')
  const [error, setError] = useState<string | null>(null)
  const preview = useMemo(() => previewFacilityCost(state, facilityType, region), [state, facilityType, region])

  const handleBuild = (ownership: FacilityOwnership) => {
    const result = onBuild(facilityType, ownership)
    setError(result.error ?? null)
  }

  return (
    <div className={cn('glass rounded-2xl p-4', claimed && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white">{profile.name}{claimed && <Lock className="size-3.5 text-slate-500" />}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{profile.description}</p>
        </div>
        {!claimed && <button type="button" onClick={() => setExpanded((open) => !open)} className="secondary-action shrink-0 text-xs">{expanded ? 'Close' : 'Build here'}</button>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        <StatChip label="Cost of living" value={`${Math.round(profile.costOfLivingIndex * 100)}%`} />
        <StatChip label="Wage level" value={`${Math.round(profile.wageLevel * 100)}%`} />
        <StatChip label="Property tax" value={`${(profile.propertyTaxRate * 100).toFixed(1)}%`} />
        <StatChip label="Transport" value={profile.transportAccess} />
        <StatChip label="Customer access" value={profile.customerAccess} />
        <StatChip label="Workforce" value={profile.availableWorkforce} />
        <StatChip label="Education" value={profile.educationLevel} />
        <StatChip label="Utilities" value={`${Math.round(profile.utilityCostIndex * 100)}%`} />
        <StatChip label="Environment rules" value={profile.environmentalRestrictions} />
        <StatChip label="Disaster risk" value={`${Math.round(profile.disasterRisk * 100)}%`} />
        <StatChip label="Expansion room" value={profile.expansionCapacity} />
        <StatChip label="Nearby rivals" value={profile.nearbyCompetitors} />
      </div>

      {claimed && <p className="mt-3 text-xs text-rose-300">A competitor has purchased land here — this region is no longer available for new facilities.</p>}

      {expanded && !claimed && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <label className="block text-xs text-slate-400">Facility type
            <select value={facilityType} onChange={(event) => setFacilityType(event.target.value as FacilityType)} className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none">
              {FACILITY_TYPE_ORDER.map((type) => <option key={type} value={type}>{FACILITY_TYPE_INFO[type].label}</option>)}
            </select>
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-400">{FACILITY_TYPE_INFO[facilityType].description}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white/[0.03] px-2.5 py-2"><p className="text-[10px] text-slate-500">Buy price</p><p className="font-semibold text-white">{formatCurrency(preview.purchasePrice)}</p></div>
            <div className="rounded-lg bg-white/[0.03] px-2.5 py-2"><p className="text-[10px] text-slate-500">Rent (5-yr lease)</p><p className="font-semibold text-white">{formatCurrency(preview.annualRent)}/yr</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => handleBuild('owned')} className="primary-action text-xs">Buy</button>
            <button type="button" onClick={() => handleBuild('rented')} className="secondary-action text-xs">Rent</button>
          </div>
          {error && <p role="alert" className="mt-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
        </div>
      )}
    </div>
  )
}

export function LandFacilitiesPage({ state, onBuild, onUpgrade, onSell, onVacate }: LandFacilitiesPageProps) {
  const availability = getRegionAvailability(state)
  const [actionErrors, setActionErrors] = useState<Record<string, string | undefined>>({})

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Landmark className="size-5 text-amber-300" />Land &amp; Facilities</h1>
        <p className="mt-1 text-sm text-slate-400">Real estate is a real trade-off: five regions with genuinely different cost, workforce, and access profiles. Competitors can buy land too — a region they claim is gone for good.</p>
      </div>

      <section>
        <h2 className="flex items-center gap-1 text-sm font-semibold text-white"><Building2 className="size-4 text-amber-300" />Your facilities<InfoTip term="Facilities" definition="Owned or rented property drives ongoing upkeep (rent, property tax, maintenance) but factories/automation lower production cost and retail stores improve local customer access." /></h2>
        {state.facilities.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">You don&apos;t own or rent any facilities yet — build one in a region below.</p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {state.facilities.map((facility) => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                error={actionErrors[facility.id]}
                onUpgrade={(upgradeId) => { const result = onUpgrade(facility.id, upgradeId); setActionErrors((current) => ({ ...current, [facility.id]: result.error })) }}
                onSell={() => { const result = onSell(facility.id); setActionErrors((current) => ({ ...current, [facility.id]: result.error })) }}
                onVacate={() => { const result = onVacate(facility.id); setActionErrors((current) => ({ ...current, [facility.id]: result.error })) }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white">Available regions</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {availability.map(({ region, claimedByCompetitor }) => (
            <RegionCard key={region} region={region} state={state} claimed={claimedByCompetitor} onBuild={(type, ownership) => onBuild(type, region, ownership)} />
          ))}
        </div>
      </section>
    </div>
  )
}
