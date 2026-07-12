'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CalendarRange, Lock, Swords, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type DashboardStats = {
  totalPlayers: number
  clashesToday: number
  clashesThisWeek: number
  systemStatus: 'ok' | 'degraded'
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/dashboard', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setStats((await response.json()) as DashboardStats)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live platform metrics. Cards with no backing system say so honestly.</p>
        </div>
        <span
          className={cn(
            'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide',
            stats == null ? 'border-white/15 text-white/50' : stats.systemStatus === 'ok' ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' : 'border-rose-400/25 bg-rose-500/10 text-rose-300',
          )}
        >
          <span className={cn('size-2 rounded-full', stats == null ? 'bg-white/30' : stats.systemStatus === 'ok' ? 'bg-emerald-400' : 'bg-rose-400')} />
          {stats == null ? 'Checking…' : stats.systemStatus === 'ok' ? 'Operational' : 'Degraded'}
        </span>
      </header>

      <section>
        <h2 className="form-label">Live metrics</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <StatCard icon={Users} label="Total Players" value={stats ? stats.totalPlayers.toLocaleString() : '…'} note="Real AirNexus accounts." />
          <StatCard icon={Swords} label="Clashes Today" value={stats ? stats.clashesToday.toLocaleString() : '…'} note="Apex Breach sessions — the real 'clash' system." />
          <StatCard icon={CalendarRange} label="Clashes This Week" value={stats ? stats.clashesThisWeek.toLocaleString() : '…'} note="Rolling 7-day window." />
        </div>
      </section>

      <section>
        <h2 className="form-label">Not yet tracked</h2>
        <p className="mt-1 text-xs text-white/40">These need systems that don&apos;t exist yet — shown as locked instead of a fabricated figure.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LockedCard label="Players Online" note="Needs a presence/heartbeat system." />
          <LockedCard label="Active Today" note="Needs server-side activity tracking." />
          <LockedCard label="Active This Week" note="Needs server-side activity tracking." />
          <LockedCard label="Nexus Points in Circulation" note="Points are stored per-browser — no server ledger." />
          <LockedCard label="Quest Completions" note="No quest system exists yet." />
          <LockedCard label="Current Season" note="No season system exists yet." />
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note?: string }) {
  return (
    <div className="glass rounded-3xl p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/45">
        <span className="flex size-7 items-center justify-center rounded-lg bg-white/10"><Icon className="size-3.5 text-white/80" /></span>
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-white">{value}</p>
      {note && <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">{note}</p>}
    </div>
  )
}

function LockedCard({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/35">
        <Lock className="size-3" /> {label}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/30">{note}</p>
    </div>
  )
}
