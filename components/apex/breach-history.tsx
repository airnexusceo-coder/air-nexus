'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Shield, Swords } from 'lucide-react'
import type { BreachHistoryEntry } from '@/lib/apex/vault/types'
import { cn } from '@/lib/utils'

export function BreachHistory({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<BreachHistoryEntry[] | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/apex/breach/history', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setHistory(((await response.json()) as { history: BreachHistoryEntry[] }).history)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-white">
        <ArrowLeft className="size-4" /> Back to Apex
      </button>

      <header>
        <h1 className="text-2xl font-semibold text-white">Breach History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your finished breaches, as attacker and defender.</p>
      </header>

      {history == null ? (
        <p className="text-sm text-muted-foreground">Loading history…</p>
      ) : history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
          No breaches yet.<br />Your match history will appear here.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((entry) => (
            <li key={entry.id} className="glass flex items-center justify-between gap-3 rounded-2xl p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70">
                  {entry.role === 'attacker' ? <Swords className="size-4" /> : <Shield className="size-4" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{entry.role === 'attacker' ? `Breach on ${entry.opponentName}` : `Defended against ${entry.opponentName}`}</p>
                  <p className="text-[11px] text-muted-foreground">{entry.layersBroken} layer{entry.layersBroken === 1 ? '' : 's'} broken · {entry.completedAt ? new Date(entry.completedAt).toLocaleString() : '—'}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn('text-xs font-semibold uppercase tracking-wide', entry.result === 'breached' && entry.role === 'attacker' ? 'text-white' : 'text-white/60')}>
                  {resultLabel(entry)}
                </p>
                {entry.role === 'attacker' && entry.xpAwarded > 0 && <p className="text-[11px] text-muted-foreground">+{entry.xpAwarded} XP</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function resultLabel(entry: BreachHistoryEntry) {
  if (entry.status === 'expired') return 'Expired'
  if (entry.result === 'retreated') return entry.role === 'attacker' ? 'Retreated' : 'Attacker retreated'
  if (entry.result === 'breached') return entry.role === 'attacker' ? 'Vault Breached' : 'Vault Breached (you)'
  return entry.role === 'attacker' ? 'Contained' : 'Defended'
}
