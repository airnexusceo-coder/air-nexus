'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ban, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'

type AdminClash = {
  id: string
  attackerId: string
  defenderId: string
  status: string
  result: string | null
  currentLayerIndex: number
  breachEnergyRemaining: number
  startedAt: string
  completedAt: string | null
}

const RESULTS = ['breached', 'contained', 'retreated'] as const

export default function AdminClashesPage() {
  const [clashes, setClashes] = useState<AdminClash[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/clashes', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setClashes(((await response.json()) as { clashes: AdminClash[] }).clashes)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const act = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id)
    try {
      const response = await fetch(`/api/admin/clashes/${id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) void load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Swords className="size-5" /> Clashes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real Apex Breach sessions — the game&apos;s actual PvP combat, the closest real equivalent to &quot;clashes.&quot;</p>
      </header>

      {clashes == null ? (
        <p className="text-sm text-muted-foreground">Loading clashes…</p>
      ) : clashes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">No clashes yet.</p>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="divide-y divide-white/6">
            {clashes.map((clash) => (
              <div key={clash.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-white/50">{clash.attackerId.slice(0, 8)} → {clash.defenderId.slice(0, 8)}</p>
                  <p className="mt-0.5 text-sm text-white">
                    <span className={cn('font-semibold', clash.status === 'active' ? 'text-emerald-300' : 'text-white/70')}>{clash.status}</span>
                    {clash.result && <span className="text-white/50"> · {clash.result}</span>}
                    <span className="text-white/40"> · layer {clash.currentLayerIndex} · ◇{clash.breachEnergyRemaining}</span>
                  </p>
                </div>
                {clash.status === 'active' && (
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" disabled={busyId === clash.id} onClick={() => void act(clash.id, { action: 'cancel' })} className="secondary-action px-2.5 py-1.5 text-[11px]">
                      <Ban className="size-3 shrink-0" /> Cancel
                    </button>
                    {RESULTS.map((result) => (
                      <button key={result} type="button" disabled={busyId === clash.id} onClick={() => void act(clash.id, { action: 'force_result', result })} className="secondary-action px-2.5 py-1.5 text-[11px] capitalize">
                        Force {result}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
