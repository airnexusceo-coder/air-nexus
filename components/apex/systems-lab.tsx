'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import type { TechnologyDefinition, TechnologyType } from '@/lib/apex/vault/types'
import { cn } from '@/lib/utils'
import { readApexError } from './apex-fetch'

type NoticeTone = 'success' | 'info' | 'warning'

type SystemsLabProps = {
  notify: (message: string, tone?: NoticeTone) => void
  nexusPoints: number
  onRedeemReward: (reward: { id: string; name: string; cost: number }) => void
  onBack: () => void
}

/**
 * Technology catalog + acquisition. Ownership itself is recorded server-side
 * (trusted). The Nexus Points cost check reuses the app's existing
 * `onRedeemReward` client-trusted spend flow — see APEX_HANDOFF.md ("Nexus
 * Points integration") for why: AirGPT has no server NP ledger anywhere yet.
 */
export function SystemsLab({ notify, nexusPoints, onRedeemReward, onBack }: SystemsLabProps) {
  const [tab, setTab] = useState<TechnologyType>('defence')
  const [technologies, setTechnologies] = useState<TechnologyDefinition[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/apex/technologies', { credentials: 'include', cache: 'no-store' })
    if (!response.ok) return
    const data = (await response.json()) as { technologies: TechnologyDefinition[] }
    setTechnologies(data.technologies)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const acquire = async (tech: TechnologyDefinition) => {
    if (nexusPoints < tech.npAcquisitionCost) {
      notify('You need more Nexus Points for this technology.', 'warning')
      return
    }
    setBusyId(tech.id)
    try {
      const response = await fetch('/api/apex/technologies', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technologySlug: tech.slug }),
      })
      if (!response.ok) {
        notify(await readApexError(response, 'Could not acquire technology.'), 'warning')
        return
      }
      onRedeemReward({ id: tech.id, name: tech.name, cost: tech.npAcquisitionCost })
      setTechnologies((current) => current?.map((item) => (item.id === tech.id ? { ...item, owned: true } : item)) ?? current)
    } catch {
      notify('Network error. Please try again.', 'warning')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = technologies?.filter((tech) => tech.technologyType === tab) ?? []

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-white">
        <ArrowLeft className="size-4" /> Back to Apex
      </button>

      <header>
        <h1 className="text-2xl font-semibold text-white">Systems Lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use Nexus Points to acquire technology. Core Energy powers and maintains it once installed.</p>
      </header>

      <div className="flex gap-2">
        <TabButton active={tab === 'defence'} onClick={() => setTab('defence')}>Defence Systems</TabButton>
        <TabButton active={tab === 'breach'} onClick={() => setTab('breach')}>Breach Systems</TabButton>
      </div>

      {!technologies ? (
        <p className="text-sm text-muted-foreground">Loading catalog…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((tech) => (
            <article key={tech.id} className="glass flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{tech.name}</h3>
                {tech.owned && <span className="flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80"><Check className="size-3" /> Owned</span>}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{tech.description}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-white/70">
                {tech.technologyType === 'defence' ? (
                  <>
                    <Field label="Capacity" value={String(tech.capacityCost)} />
                    <Field label="Startup" value={`◇${tech.startupEnergyCost}`} />
                    <Field label="Upkeep" value={`◇${tech.upkeepEnergyPerHour}/hr`} />
                  </>
                ) : (
                  <Field label="Activation" value={`◇${tech.activationEnergyCost}`} />
                )}
              </dl>
              <button
                type="button"
                disabled={tech.owned || busyId === tech.id}
                onClick={() => void acquire(tech)}
                className="primary-action mt-auto justify-center py-2 text-xs disabled:opacity-50"
              >
                {tech.owned ? 'Owned' : `Acquire · ✦ ${tech.npAcquisitionCost} NP`}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition', active ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:text-white')}>
      {children}
    </button>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-white/40">{label}</dt>
      <dd className="font-medium text-white/85">{value}</dd>
    </div>
  )
}
