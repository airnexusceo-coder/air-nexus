'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CalendarRange, Coins, Crown, Gift, Lock, ShieldCheck, Sparkles, Swords, Users, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type NexusPlan = 'Free' | 'Plus' | 'Premium'
type PaidPlan = 'Plus' | 'Premium'

type DashboardStats = {
  totalPlayers: number
  clashesToday: number
  clashesThisWeek: number
  activeGiftedSubscriptions: number
  pendingNexusPointGifts: number
  systemStatus: 'ok' | 'degraded'
}

type AdminUserView = {
  id: string
  email: string
  displayName: string
  plan: NexusPlan
  adminGrantedPlan: PaidPlan | null
  adminPlanExpiresAt: string | null
  pendingNexusPoints: number
}

function formatDate(value: string | null) {
  if (!value) return 'No expiry'
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [users, setUsers] = useState<AdminUserView[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [giftPlan, setGiftPlan] = useState<PaidPlan>('Plus')
  const [giftDays, setGiftDays] = useState('30')
  const [pointsAmount, setPointsAmount] = useState('500')
  const [pointsDescription, setPointsDescription] = useState('Dashboard Nexus Points gift')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? users[0] ?? null, [selectedUserId, users])

  const load = useCallback(async () => {
    const [statsResponse, usersResponse] = await Promise.all([
      fetch('/api/admin/dashboard', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' }),
    ])
    if (statsResponse.ok) setStats((await statsResponse.json()) as DashboardStats)
    if (usersResponse.ok) {
      const nextUsers = ((await usersResponse.json()) as { users: AdminUserView[] }).users
      setUsers(nextUsers)
      setSelectedUserId((current) => current || nextUsers[0]?.id || '')
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const runPower = async (kind: 'plan' | 'points') => {
    if (!selectedUser) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/${kind === 'plan' ? 'plan' : 'nexus-points'}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'plan'
          ? { action: 'gift', plan: giftPlan, durationDays: Number(giftDays) }
          : { amount: Number(pointsAmount), description: pointsDescription }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setMessage({ tone: 'warning', text: data?.error ?? 'Power action failed.' })
        return
      }
      setMessage({ tone: 'success', text: kind === 'plan' ? `Gifted ${giftPlan} to ${selectedUser.displayName}.` : `Queued ${Number(pointsAmount).toLocaleString()} Nexus Points for ${selectedUser.displayName}.` })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">Owner console</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live platform metrics plus real controls for users, subscriptions, Nexus Points, XP, moderation, admins, and permissions.</p>
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
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={Users} label="Total players" value={stats ? stats.totalPlayers.toLocaleString() : '…'} note="Real AirNexus accounts." />
          <StatCard icon={Swords} label="Clashes today" value={stats ? stats.clashesToday.toLocaleString() : '…'} note="Apex Breach sessions." />
          <StatCard icon={CalendarRange} label="Clashes week" value={stats ? stats.clashesThisWeek.toLocaleString() : '…'} note="Rolling 7-day window." />
          <StatCard icon={Crown} label="Gifted plans" value={stats ? stats.activeGiftedSubscriptions.toLocaleString() : '…'} note="Active admin plan gifts." />
          <StatCard icon={Coins} label="Pending gifts" value={stats ? stats.pendingNexusPointGifts.toLocaleString() : '…'} note="Unclaimed point gift rows." />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-100"><Zap className="size-4" /> Quick powers</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Gift access and Nexus Points</h2>
            </div>
            <Link href="/admin/users" className="secondary-action px-3 py-2 text-[11px]">Full user console</Link>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="form-label" htmlFor="power-user">Target user</label>
            <select id="power-user" value={selectedUser?.id ?? ''} onChange={(event) => setSelectedUserId(event.target.value)} className="calculator-input">
              {users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.email}</option>)}
            </select>
            {selectedUser && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3 text-xs text-white/55">
                Current plan <strong className="text-white">{selectedUser.plan}</strong>
                {selectedUser.adminGrantedPlan && <> · gift <strong className="text-white">{selectedUser.adminGrantedPlan}</strong> until {formatDate(selectedUser.adminPlanExpiresAt)}</>}
                {selectedUser.pendingNexusPoints > 0 && <> · pending <strong className="text-white">{selectedUser.pendingNexusPoints.toLocaleString()}</strong> points</>}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-violet-300/15 bg-violet-400/[0.045] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-violet-100"><Gift className="size-4" /> Gift subscription</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
              <select value={giftPlan} onChange={(event) => setGiftPlan(event.target.value as PaidPlan)} className="calculator-input py-2 text-sm">
                <option value="Plus">Plus</option>
                <option value="Premium">Premium</option>
              </select>
              <input value={giftDays} onChange={(event) => setGiftDays(event.target.value)} type="number" min={1} max={3650} className="calculator-input py-2 text-sm" aria-label="Gift duration days" />
              <button type="button" disabled={busy || !selectedUser} onClick={() => void runPower('plan')} className="primary-action justify-center px-4 py-2 text-xs disabled:opacity-50">Gift plan</button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 rounded-2xl border border-amber-300/15 bg-amber-400/[0.045] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-100"><Coins className="size-4" /> Gift Nexus Points</p>
            <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
              <input value={pointsAmount} onChange={(event) => setPointsAmount(event.target.value)} type="number" min={1} max={1000000} className="calculator-input py-2 text-sm" aria-label="Nexus Points amount" />
              <input value={pointsDescription} onChange={(event) => setPointsDescription(event.target.value)} maxLength={160} className="calculator-input py-2 text-sm" aria-label="Nexus Points gift note" />
              <button type="button" disabled={busy || !selectedUser} onClick={() => void runPower('points')} className="primary-action justify-center px-4 py-2 text-xs disabled:opacity-50">Send points</button>
            </div>
          </div>

          {message && <p className={cn('mt-4 rounded-2xl border p-3 text-sm', message.tone === 'success' ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/20 bg-amber-400/10 text-amber-100')}>{message.text}</p>}
        </div>

        <div className="glass rounded-3xl p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100"><ShieldCheck className="size-4" /> Power map</p>
          <div className="mt-4 grid gap-3">
            <PowerLink href="/admin/users" icon={Users} title="Users" detail="Create accounts, moderate, gift plans, gift points, manage XP." />
            <PowerLink href="/admin/admins" icon={ShieldCheck} title="Admins" detail="Create/remove admin users and assign admin authority." />
            <PowerLink href="/admin/permissions" icon={Sparkles} title="Permissions" detail="See what is live, locked, or intentionally not built yet." />
            <PowerLink href="/admin/achievements" icon={Crown} title="Achievements" detail="Create, edit, grant, and revoke real achievements." />
            <PowerLink href="/admin/clashes" icon={Swords} title="Apex Clashes" detail="View and resolve real breach sessions." />
          </div>
        </div>
      </section>

      <section>
        <h2 className="form-label">Still intentionally locked</h2>
        <p className="mt-1 text-xs text-white/40">Shown honestly so the console does not pretend unsupported systems exist.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LockedCard label="Players online" note="Needs a presence/heartbeat system." />
          <LockedCard label="Active today" note="Needs server-side activity tracking." />
          <LockedCard label="Quest completions" note="No quest system exists yet." />
          <LockedCard label="Current season" note="No season system exists yet." />
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

function PowerLink({ href, icon: Icon, title, detail }: { href: string; icon: LucideIcon; title: string; detail: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-white/18 hover:bg-white/[0.055]">
      <span className="flex items-center gap-3 text-sm font-semibold text-white"><span className="flex size-9 items-center justify-center rounded-xl bg-white/10"><Icon className="size-4" /></span>{title}</span>
      <span className="mt-2 block text-xs leading-5 text-white/45">{detail}</span>
    </Link>
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