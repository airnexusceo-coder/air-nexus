'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Crosshair, LogOut, Radar, ShieldCheck, ShieldX, Zap } from 'lucide-react'
import { ThinkingLogo } from '@/components/thinking-logo'
import type { BreachStateDTO } from '@/lib/apex/vault/types'
import { cn } from '@/lib/utils'
import { readApexError } from './apex-fetch'

type NoticeTone = 'success' | 'info' | 'warning'

type BreachShellProps = {
  breachId: string
  notify: (message: string, tone?: NoticeTone) => void
  onExit: () => void
}

/**
 * The interactive breach experience. Real player breaches are resolved by the
 * Supabase SQL resolver. Practice bot breaches use signed backend state and do
 * not mutate any player Vault or ranked rewards.
 */
export function BreachShell({ breachId, notify, onExit }: BreachShellProps) {
  const [requestBreachId, setRequestBreachId] = useState(breachId)
  const [state, setState] = useState<BreachStateDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const eventLogRef = useRef<HTMLDivElement>(null)


  const load = useCallback(async () => {
    const response = await fetch(`/api/apex/breach/${encodeURIComponent(requestBreachId)}`, { credentials: 'include', cache: 'no-store' })
    if (response.ok) {
      const next = (await response.json()) as BreachStateDTO
      setState(next)
      if (next.id !== requestBreachId) setRequestBreachId(next.id)
    }
  }, [requestBreachId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  useEffect(() => {
    eventLogRef.current?.scrollTo({ top: eventLogRef.current.scrollHeight, behavior: 'smooth' })
  }, [state?.events.length])

  const act = useCallback(
    async (action: string, technologySlug?: string) => {
      setBusy(true)
      try {
        const response = await fetch(`/api/apex/breach/${encodeURIComponent(requestBreachId)}/action`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, technologySlug: technologySlug ?? null }),
        })
        if (!response.ok) {
          notify(await readApexError(response, 'Could not resolve that action.'), 'warning')
          return
        }
        const next = (await response.json()) as BreachStateDTO
        setRequestBreachId(next.id)
        setState(next)
        setSelectedTool(null)
        if (next.status !== 'active') {
          notify(resultNotice(next), next.result === 'breached' ? 'success' : 'info')
        }
      } catch {
        notify('Network error. Please try again.', 'warning')
      } finally {
        setBusy(false)
      }
    },
    [requestBreachId, notify],
  )

  if (!state) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <BackLink onExit={onExit} />
        <p className="text-sm text-muted-foreground">Loading breach...</p>
      </div>
    )
  }

  const currentLayer = state.layers[state.currentLayerIndex]
  const finished = state.status !== 'active'
  const equippedTool = selectedTool ? state.loadout.find((item) => item.slug === selectedTool) : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <BackLink onExit={onExit} label={finished ? 'Back to Apex' : 'Exit (forfeits progress)'} />

      <div className="glass grid grid-cols-3 gap-3 rounded-2xl p-4 text-center">
        <div>
          <p className="form-label">Target</p>
          <p className="mt-1 text-sm font-semibold text-white">{state.defenderName}{state.practice ? ' Bot' : ''}</p>
        </div>
        <div>
          <p className="form-label">Stage</p>
          <p className="mt-1 text-sm font-semibold text-white">{currentLayer?.label ?? 'Result'}</p>
        </div>
        <div>
          <p className="form-label">Breach Energy</p>
          <p className="mt-1 text-sm font-semibold text-white">◇ {state.breachEnergyRemaining.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {state.layers.map((layer) => (
          <div key={layer.layerIndex} className={cn('glass rounded-2xl p-3', layer.layerIndex === state.currentLayerIndex && !finished && 'ring-1 ring-white/40')}>
            <p className="text-[11px] uppercase tracking-wide text-white/50">{layer.label}</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">{layer.revealed ? layer.name : layer.broken ? layer.name : '???'}</p>
            <div className="cc-meter-track mt-2">
              <div className="cc-meter-fill" style={{ width: `${layer.broken ? 0 : layer.integrityPercent}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-white/45">{layer.broken ? 'Breached' : `${layer.integrityPercent}% integrity`}</p>
          </div>
        ))}
      </div>

      <div className="glass flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl p-6">
        <ThinkingLogo isThinking={!finished} className="size-20" />
        {!finished && <p className="text-xs text-white/60">Signal engaged with {currentLayer?.revealed ? currentLayer.name : 'an unidentified layer'}.</p>}
        {state.practice && <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Practice Simulation</p>}
      </div>

      <div ref={eventLogRef} className="glass scrollbar-thin max-h-48 overflow-y-auto rounded-2xl p-4">
        {state.events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-xs text-white/75">
            {state.events.map((event, index) => (
              <li key={index}>{event.message}</li>
            ))}
          </ul>
        )}
      </div>

      {finished ? (
        <ResultPanel state={state} onDone={onExit} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <ActionButton icon={<Radar className="size-4" />} label="Scan - ◇10" disabled={busy || currentLayer?.revealed} onClick={() => void act('scan')} />
            <ActionButton icon={<Crosshair className="size-4" />} label="Probe - ◇20" disabled={busy} onClick={() => void act('probe')} />
            <ActionButton icon={<Zap className="size-4" />} label="Overload - ◇60" disabled={busy} onClick={() => void act('overload')} />
          </div>

          {state.loadout.length > 0 && (
            <div className="glass rounded-2xl p-4">
              <p className="form-label">Deploy a Breach Tool</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {state.loadout.map((tool) => (
                  <button
                    key={tool.slug}
                    type="button"
                    disabled={busy || tool.chargesRemaining <= 0}
                    onClick={() => setSelectedTool(tool.slug === selectedTool ? null : tool.slug)}
                    className={cn('rounded-lg border px-3 py-1.5 text-xs disabled:opacity-30', selectedTool === tool.slug ? 'border-white/50 bg-white/15 text-white' : 'border-white/10 bg-white/[0.02] text-muted-foreground')}
                  >
                    {tool.name} ({tool.chargesRemaining})
                  </button>
                ))}
              </div>
              {selectedTool && (
                <button type="button" disabled={busy || !equippedTool || equippedTool.chargesRemaining <= 0} onClick={() => void act('use_tool', selectedTool)} className="primary-action mt-3 px-4 py-1.5 text-xs">
                  Deploy {equippedTool?.name}
                </button>
              )}
            </div>
          )}

          <button type="button" disabled={busy} onClick={() => void act('retreat')} className="secondary-action justify-center py-2 text-xs">
            <LogOut className="size-3.5" /> Retreat
          </button>
        </>
      )}
    </div>
  )
}

function resultNotice(state: BreachStateDTO) {
  if (state.practice) {
    return state.result === 'breached' ? `Practice Core Gate breached - ${state.xpAwarded} XP preview` : state.result === 'retreated' ? 'You retreated from the practice breach.' : 'The practice Vault contained your breach.'
  }
  return state.result === 'breached' ? `Core Gate breached - +${state.xpAwarded} Clash XP` : state.result === 'retreated' ? 'You retreated from the breach.' : 'The Vault contained your breach.'
}

function ResultPanel({ state, onDone }: { state: BreachStateDTO; onDone: () => void }) {
  const Icon = state.result === 'breached' ? ShieldX : state.result === 'retreated' ? LogOut : ShieldCheck
  const title = state.result === 'breached' ? 'Core Gate Breached' : state.result === 'retreated' ? 'Retreated' : 'Breach Contained'
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-3xl p-6 text-center">
      <Icon className="size-8 text-white" />
      <p className="text-lg font-semibold text-white">{title}</p>
      {state.practice ? (
        <p className="text-sm text-muted-foreground">Practice score: {state.xpAwarded} XP preview. No ranked XP, Core Energy, or player Vault damage was written.</p>
      ) : state.result === 'breached' ? (
        <p className="text-sm text-muted-foreground">+{state.xpAwarded} Clash XP - ◇{state.rewardEnergy} recovered</p>
      ) : state.result === 'contained' && state.xpAwarded > 0 ? (
        <p className="text-sm text-muted-foreground">+{state.xpAwarded} Clash XP for the attempt</p>
      ) : (
        <p className="text-sm text-muted-foreground">No Clash XP awarded.</p>
      )}
      <button type="button" onClick={onDone} className="primary-action mt-2 px-6 py-2 text-xs">Return to Apex</button>
    </div>
  )
}

function ActionButton({ icon, label, disabled, onClick }: { icon: React.ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="secondary-action flex-col gap-1 py-3 text-[11px] disabled:opacity-30">
      {icon} {label}
    </button>
  )
}

function BackLink({ onExit, label = 'Exit' }: { onExit: () => void; label?: string }) {
  return (
    <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-white">
      <ArrowLeft className="size-4" /> {label}
    </button>
  )
}