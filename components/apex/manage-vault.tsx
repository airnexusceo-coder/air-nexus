'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, PlusCircle, Power, PowerOff, Trash2 } from 'lucide-react'
import { repairCostForPercent } from '@/lib/apex/vault/config'
import type { InstalledDefence, TechnologyDefinition, VaultOverview } from '@/lib/apex/vault/types'
import { readApexError } from './apex-fetch'

type NoticeTone = 'success' | 'info' | 'warning'

type ManageVaultProps = {
  notify: (message: string, tone?: NoticeTone) => void
  onBack: () => void
}

const REPAIR_STEPS = [10, 25, 50, 100]

export function ManageVault({ notify, onBack }: ManageVaultProps) {
  const [overview, setOverview] = useState<VaultOverview | null>(null)
  const [technologies, setTechnologies] = useState<TechnologyDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reserveInput, setReserveInput] = useState('')

  const load = useCallback(async () => {
    try {
      const [vaultResponse, techResponse] = await Promise.all([
        fetch('/api/apex/vault', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/apex/technologies', { credentials: 'include', cache: 'no-store' }),
      ])
      if (!vaultResponse.ok) return
      const data = (await vaultResponse.json()) as VaultOverview
      setOverview(data)
      setReserveInput(String(data.autoRepairReserve))
      if (techResponse.ok) {
        const techData = (await techResponse.json()) as { technologies: TechnologyDefinition[] }
        setTechnologies(techData.technologies)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const mutate = useCallback(
    async (input: RequestInfo, init: RequestInit, successMessage?: string) => {
      setBusy(true)
      try {
        const response = await fetch(input, { credentials: 'include', ...init })
        if (!response.ok) {
          notify(await readApexError(response, 'Something went wrong.'), 'warning')
          return
        }
        if (successMessage) notify(successMessage, 'success')
        setOverview((await response.json()) as VaultOverview)
        void load()
      } catch {
        notify('Network error. Please try again.', 'warning')
      } finally {
        setBusy(false)
      }
    },
    [load, notify],
  )

  const defenceAction = (body: Record<string, unknown>, successMessage?: string) =>
    mutate('/api/apex/vault/defences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, successMessage)

  const reorder = (field: 'defence_order' | 'energy_priority', sorted: InstalledDefence[], index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= sorted.length) return
    const next = [...sorted]
    ;[next[index], next[target]] = [next[target], next[index]]
    const action = field === 'defence_order' ? 'reorder' : 'set_priority'
    void defenceAction({ action, orderedDefenceIds: next.map((d) => d.id) })
  }

  const repair = (percent: number) => mutate('/api/apex/vault/repair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restorePercent: percent }) }, `Vault repaired +${percent}% Integrity`)

  const saveAutoRepair = (enabled: boolean) => {
    const reserve = Math.max(0, Math.round(Number(reserveInput) || 0))
    void mutate('/api/apex/vault', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoRepairEnabled: enabled, autoRepairReserve: reserve }) }, 'Auto-Repair updated.')
  }

  const toggleBreaches = (enabled: boolean) =>
    mutate('/api/apex/vault', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ breachesEnabled: enabled }) }, enabled ? 'Apex breaches enabled.' : 'Apex breaches disabled.')

  if (loading) return <div className="mx-auto w-full max-w-4xl"><BackLink onBack={onBack} /></div>
  if (!overview) return <div className="mx-auto w-full max-w-4xl"><BackLink onBack={onBack} /><p className="mt-4 text-sm text-muted-foreground">Couldn&apos;t load your Vault.</p></div>

  const byOrder = [...overview.installedDefences].sort((a, b) => a.defenceOrder - b.defenceOrder)
  const byPriority = [...overview.installedDefences].sort((a, b) => a.energyPriority - b.energyPriority)
  const installedTechIds = new Set(overview.installedDefences.map((d) => d.technologyId))
  const defenceTechnologies = technologies.filter((tech) => tech.technologyType === 'defence' && !installedTechIds.has(tech.id))
  const availableToInstall = defenceTechnologies.filter((tech) => tech.owned || tech.npAcquisitionCost === 0)
  const lockedAdvanced = defenceTechnologies.filter((tech) => !tech.owned && tech.npAcquisitionCost > 0)
  const capacityRemaining = overview.defenceCapacityMax - overview.defenceCapacityUsed

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink onBack={onBack} />
      <header>
        <h1 className="text-2xl font-semibold text-white">Manage Vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">Core Energy {overview.coreEnergy.toLocaleString()} - Capacity {overview.defenceCapacityUsed} / {overview.defenceCapacityMax}</p>
      </header>

      <section className="glass rounded-3xl p-5">
        <h2 className="text-sm font-semibold text-white">Installed Defence Systems</h2>
        {overview.installedDefences.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-muted-foreground">No defence systems installed. Install a normal setup system below using Core Energy only.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {overview.installedDefences.map((defence) => (
              <li key={defence.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{defence.name}</p>
                  <p className="text-[11px] text-muted-foreground">Capacity {defence.capacityCost} - Upkeep CE {defence.upkeepEnergyPerHour}/hr - {defence.isEnabled ? 'Active' : 'Offline'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" disabled={busy} onClick={() => void defenceAction({ action: defence.isEnabled ? 'deactivate' : 'activate', defenceId: defence.id }, defence.isEnabled ? undefined : `${defence.name} reactivated.`)} className="interactive-icon size-8" aria-label={defence.isEnabled ? `Deactivate ${defence.name}` : `Activate ${defence.name}`}>
                    {defence.isEnabled ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                  </button>
                  <button type="button" disabled={busy} onClick={() => void defenceAction({ action: 'uninstall', defenceId: defence.id }, `${defence.name} removed.`)} className="interactive-icon size-8" aria-label={`Remove ${defence.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {availableToInstall.length > 0 && (
        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-white">Ready to Install</h2>
          <p className="mt-1 text-xs text-muted-foreground">Capacity remaining {capacityRemaining} / {overview.defenceCapacityMax}. Normal setup systems spend Core Energy only; advanced unlocked systems can also be installed here.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {availableToInstall.map((tech) => {
              const included = tech.npAcquisitionCost === 0
              return (
                <li key={tech.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{tech.name}</p>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/55">{included ? 'Core Energy only' : 'Unlocked advanced'}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Capacity {tech.capacityCost} - Startup CE {tech.startupEnergyCost} - Upkeep CE {tech.upkeepEnergyPerHour}/hr</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || tech.capacityCost > capacityRemaining}
                    onClick={() => void defenceAction({ action: 'install', technologySlug: tech.slug }, `${tech.name} installed.`)}
                    className="secondary-action shrink-0 px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    <PlusCircle className="size-3.5" /> Install
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {lockedAdvanced.length > 0 && (
        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-white">Advanced Systems Locked</h2>
          <p className="mt-1 text-xs text-muted-foreground">These strength upgrades still require Nexus Points in the Systems Lab before installation.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {lockedAdvanced.map((tech) => (
              <li key={tech.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{tech.name}</p>
                  <p className="text-[11px] text-muted-foreground">Unlock cost {tech.npAcquisitionCost} NP - then Startup CE {tech.startupEnergyCost}</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Systems Lab</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {overview.installedDefences.length > 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <OrderPanel title="Defence Order" hint="The order an attacker encounters your defences." items={byOrder} busy={busy} onMove={(index, dir) => reorder('defence_order', byOrder, index, dir)} />
          <OrderPanel title="Energy Priority" hint="Lower-priority systems shut down first if Core Energy runs low." items={byPriority} busy={busy} onMove={(index, dir) => reorder('energy_priority', byPriority, index, dir)} />
        </div>
      )}

      <section className="glass rounded-3xl p-5">
        <h2 className="text-sm font-semibold text-white">Repair Vault</h2>
        <p className="mt-1 text-xs text-muted-foreground">Integrity {overview.vaultIntegrity}% - CE 250 per 10% restored</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {REPAIR_STEPS.map((percent) => (
            <button key={percent} type="button" disabled={busy || overview.vaultIntegrity >= 100} onClick={() => void repair(percent)} className="secondary-action px-4 py-1.5 text-xs">
              +{percent}% - CE {repairCostForPercent(percent)}
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="text-sm font-semibold text-white">Auto-Repair</h2>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <span className="text-sm text-white">Enabled</span>
          <input type="checkbox" checked={overview.autoRepairEnabled} disabled={busy} onChange={(event) => saveAutoRepair(event.target.checked)} className="size-4 accent-white" />
        </label>
        <label className="mt-3 block text-xs text-muted-foreground">
          Reserve (Core Energy set aside for automatic repairs)
          <div className="mt-1.5 flex gap-2">
            <input type="number" min={0} value={reserveInput} onChange={(event) => setReserveInput(event.target.value)} className="calculator-input flex-1" />
            <button type="button" disabled={busy} onClick={() => saveAutoRepair(overview.autoRepairEnabled)} className="secondary-action px-4 text-xs">Save</button>
          </div>
        </label>
      </section>

      <section className="glass rounded-3xl p-5">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-white">Allow Apex Breaches</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">Turn off to remove your Vault from friends&apos; target lists.</span>
          </span>
          <input type="checkbox" checked={overview.breachesEnabled} disabled={busy} onChange={(event) => void toggleBreaches(event.target.checked)} className="size-4 accent-white" />
        </label>
      </section>
    </div>
  )
}

function OrderPanel({ title, hint, items, busy, onMove }: { title: string; hint: string; items: InstalledDefence[]; busy: boolean; onMove: (index: number, direction: -1 | 1) => void }) {
  return (
    <div className="glass rounded-3xl p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      <ol className="mt-3 flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <span className="text-white/90">{index + 1}. {item.name}</span>
            <span className="flex gap-1">
              <button type="button" disabled={busy || index === 0} onClick={() => onMove(index, -1)} className="interactive-icon size-7 disabled:opacity-30" aria-label={`Move ${item.name} up`}><ArrowUp className="size-3.5" /></button>
              <button type="button" disabled={busy || index === items.length - 1} onClick={() => onMove(index, 1)} className="interactive-icon size-7 disabled:opacity-30" aria-label={`Move ${item.name} down`}><ArrowDown className="size-3.5" /></button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-white">
      <ArrowLeft className="size-4" /> Back to Apex
    </button>
  )
}