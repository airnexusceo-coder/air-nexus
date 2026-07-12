'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Radar, Swords } from 'lucide-react'
import type { ApexTarget, ApexTargetStatus, TechnologyDefinition } from '@/lib/apex/vault/types'
import { cn } from '@/lib/utils'
import { readApexError } from './apex-fetch'
import { BreachShell } from './breach-shell'

type NoticeTone = 'success' | 'info' | 'warning'

type FindATargetProps = {
  notify: (message: string, tone?: NoticeTone) => void
  onBack: () => void
}

const STATUS_LABEL: Record<ApexTargetStatus, string> = {
  available: 'Available',
  protected: 'Vault Recovery active',
  breaches_disabled: 'Breaches disabled',
  limit_reached: 'Daily limit reached',
}

export function FindATarget({ notify, onBack }: FindATargetProps) {
  const [targets, setTargets] = useState<ApexTarget[] | null>(null)
  const [breachTools, setBreachTools] = useState<TechnologyDefinition[]>([])
  const [preparing, setPreparing] = useState<ApexTarget | null>(null)
  const [activeBreachId, setActiveBreachId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [targetsResponse, techResponse] = await Promise.all([
      fetch('/api/apex/targets', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/apex/technologies', { credentials: 'include', cache: 'no-store' }),
    ])
    if (targetsResponse.ok) setTargets(((await targetsResponse.json()) as { targets: ApexTarget[] }).targets)
    if (techResponse.ok) {
      const data = (await techResponse.json()) as { technologies: TechnologyDefinition[] }
      setBreachTools(data.technologies.filter((t) => t.technologyType === 'breach' && t.owned))
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  if (activeBreachId) {
    return (
      <BreachShell
        breachId={activeBreachId}
        notify={notify}
        onExit={() => {
          setActiveBreachId(null)
          setPreparing(null)
          void load()
        }}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-white">
        <ArrowLeft className="size-4" /> Back to Apex
      </button>

      <header>
        <h1 className="text-2xl font-semibold text-white">Find a Target</h1>
        <p className="mt-1 text-sm text-muted-foreground">Breach an accepted friend&apos;s Nexus Vault. Their defence configuration stays hidden until you engage.</p>
      </header>

      {targets == null ? (
        <p className="text-sm text-muted-foreground">Loading targets…</p>
      ) : targets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
          No eligible Apex targets yet.<br />Your AirGPT friends can appear here when they enable Apex breaches.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {targets.map((target) => (
            <div key={target.userId} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{target.displayName}</p>
                  <p className="text-[11px] text-muted-foreground">{target.apexRankLabel} · {target.defenceLayerCount} defence layer{target.defenceLayerCount === 1 ? '' : 's'} · Signal: {target.vaultSignal.replace('_', ' ')}</p>
                </div>
                <button
                  type="button"
                  disabled={target.status !== 'available'}
                  onClick={() => setPreparing(preparing?.userId === target.userId ? null : target)}
                  className="secondary-action px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  <Radar className="size-3.5" /> {target.status === 'available' ? 'Prepare Breach' : STATUS_LABEL[target.status]}
                </button>
              </div>

              {preparing?.userId === target.userId && (
                <BreachPrepForm
                  target={target}
                  breachTools={breachTools}
                  notify={notify}
                  onStarted={(breachId) => setActiveBreachId(breachId)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BreachPrepForm({ target, breachTools, notify, onStarted }: { target: ApexTarget; breachTools: TechnologyDefinition[]; notify: (message: string, tone?: NoticeTone) => void; onStarted: (breachId: string) => void }) {
  const [budget, setBudget] = useState(500)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const toggleTool = (slug: string) => {
    setSelectedTools((current) => (current.includes(slug) ? current.filter((s) => s !== slug) : current.length >= 3 ? current : [...current, slug]))
  }

  const begin = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/apex/breach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defenderId: target.userId, breachBudget: budget, loadoutSlugs: selectedTools }),
      })
      if (!response.ok) {
        notify(await readApexError(response, 'Could not start breach.'), 'warning')
        return
      }
      const session = (await response.json()) as { id: string }
      onStarted(session.id)
    } catch {
      notify('Network error. Please try again.', 'warning')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 border-t border-white/8 pt-4">
      <label className="block text-xs text-muted-foreground">
        Breach Budget (Core Energy committed)
        <input type="number" min={50} step={50} value={budget} onChange={(event) => setBudget(Number(event.target.value))} className="calculator-input mt-1.5 w-full" />
      </label>

      {breachTools.length > 0 && (
        <div className="mt-3">
          <p className="form-label">Breach Loadout (up to 3)</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {breachTools.map((tool) => (
              <button
                key={tool.slug}
                type="button"
                onClick={() => toggleTool(tool.slug)}
                className={cn('rounded-lg border px-3 py-1.5 text-xs', selectedTools.includes(tool.slug) ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-muted-foreground')}
              >
                {tool.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" disabled={busy} onClick={() => void begin()} className="primary-action mt-4 px-5 py-2 text-xs">
        <Swords className="size-3.5" /> Initiate Breach
      </button>
    </div>
  )
}
