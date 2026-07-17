'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ban, Coins, Crown, Gift, Plus, Search, Shield, ShieldOff, Sparkles, Trash2, UserCog } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

type NexusPlan = 'Free' | 'Plus' | 'Premium'
type PaidPlan = 'Plus' | 'Premium'

type AdminUserView = {
  id: string
  email: string
  displayName: string
  createdAt: string
  suspendedUntil: string | null
  suspendedReason: string | null
  bannedAt: string | null
  bannedReason: string | null
  deletedAt: string | null
  plan: NexusPlan
  planExpiresAt: string | null
  subscriptionStatus: string | null
  hasActiveSubscription: boolean
  adminGrantedPlan: PaidPlan | null
  adminPlanExpiresAt: string | null
  adminPlanActive: boolean
  pendingNexusPoints: number
  pendingNexusPointGrantCount: number
}

function statusOf(user: AdminUserView): { label: string; tone: string } {
  if (user.deletedAt) return { label: 'Deleted', tone: 'bg-white/10 text-white/40' }
  if (user.bannedAt) return { label: 'Banned', tone: 'bg-rose-500/15 text-rose-300' }
  if (user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) return { label: 'Suspended', tone: 'bg-amber-500/15 text-amber-300' }
  return { label: 'Active', tone: 'bg-emerald-500/15 text-emerald-300' }
}

function planTone(plan: NexusPlan) {
  if (plan === 'Premium') return 'border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100'
  if (plan === 'Plus') return 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100'
  return 'border-white/10 bg-white/5 text-white/45'
}

function formatDate(value: string | null) {
  if (!value) return 'No expiry'
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserView[] | null>(null)
  const [selected, setSelected] = useState<AdminUserView | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' })
    if (!response.ok) return null
    const nextUsers = ((await response.json()) as { users: AdminUserView[] }).users
    setUsers(nextUsers)
    return nextUsers
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const refreshSelected = useCallback(async () => {
    const nextUsers = await load()
    if (!selected || !nextUsers) return
    setSelected(nextUsers.find((user) => user.id === selected.id) ?? null)
  }, [load, selected])

  const trimmedQuery = query.trim().toLowerCase()
  const visibleUsers = (users ?? []).filter(
    (user) => !trimmedQuery || user.displayName.toLowerCase().includes(trimmedQuery) || user.email.toLowerCase().includes(trimmedQuery),
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users == null
              ? 'Real AirNexus accounts — loading powers.'
              : `${users.length.toLocaleString()} account${users.length === 1 ? '' : 's'} · users, plans, Nexus Points, XP, moderation.`}
          </p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="primary-action px-4 py-2 text-xs"><Plus className="size-3.5" /> Create user</button>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search users"
          className="calculator-input w-full pl-10"
        />
      </div>

      {users == null ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : (
        <div className="glass overflow-hidden rounded-3xl">
          <div className="divide-y divide-white/6">
            {visibleUsers.map((user) => {
              const status = statusOf(user)
              return (
                <button key={user.id} type="button" onClick={() => setSelected(user)} className="grid w-full gap-3 p-4 text-left transition hover:bg-white/5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-500 to-zinc-900 text-sm font-bold text-white shadow-lg shadow-black/20">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">{user.displayName}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{user.email}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', planTone(user.plan))}>{user.plan}</span>
                      {user.adminPlanActive && <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-100">Gifted until {formatDate(user.adminPlanExpiresAt)}</span>}
                      {user.pendingNexusPoints > 0 && <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">+{user.pendingNexusPoints.toLocaleString()} pending points</span>}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 md:justify-end">
                    <span className="hidden shrink-0 text-[11px] text-white/40 sm:block">Joined {formatDate(user.createdAt)}</span>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', status.tone)}>{status.label}</span>
                  </span>
                </button>
              )
            })}
            {visibleUsers.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {users.length === 0 ? 'No users yet.' : `No accounts match "${query.trim()}".`}
              </p>
            )}
          </div>
        </div>
      )}

      {selected && (
        <UserDetailModal
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={refreshSelected}
          onDeleted={async () => { setSelected(null); await load() }}
        />
      )}
      {createOpen && (
        <CreateUserModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void load() }} />
      )}
    </div>
  )
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName: displayName || undefined }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Could not create user.')
        return
      }
      onCreated()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title="Create user" description="Creates a real AirNexus account via the Supabase Admin API." onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="form-label" htmlFor="new-user-email">Email</label>
        <input id="new-user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="calculator-input" />
        <label className="form-label" htmlFor="new-user-password">Password</label>
        <input id="new-user-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="calculator-input" />
        <label className="form-label" htmlFor="new-user-name">Display name (optional)</label>
        <input id="new-user-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="calculator-input" />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button type="button" disabled={busy || !email || !password} onClick={() => void submit()} className="primary-action mt-2 justify-center py-2.5">
          {busy ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </Modal>
  )
}

function UserDetailModal({ user, onClose, onChanged, onDeleted }: { user: AdminUserView; onClose: () => void; onChanged: () => void | Promise<void>; onDeleted: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [suspendHours, setSuspendHours] = useState('24')
  const [reason, setReason] = useState('')
  const [xp, setXp] = useState<number | null>(null)
  const [xpAmount, setXpAmount] = useState('100')
  const [giftPlan, setGiftPlan] = useState<PaidPlan>('Plus')
  const [giftDays, setGiftDays] = useState('30')
  const [pointsAmount, setPointsAmount] = useState('500')
  const [pointsDescription, setPointsDescription] = useState('Admin Nexus Points gift')

  useEffect(() => {
    void fetch(`/api/admin/users/${user.id}/xp`, { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { xp: number } | null) => setXp(data?.xp ?? null))
  }, [user.id])

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Action failed.')
        return
      }
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const runXp = async (action: 'grant' | 'remove' | 'set') => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}/xp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount: Number(xpAmount) }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Could not update XP.')
        return
      }
      setXp(((await response.json()) as { xp: number }).xp)
    } finally {
      setBusy(false)
    }
  }

  const giftSubscription = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}/plan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gift', plan: giftPlan, durationDays: Number(giftDays) }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Could not gift subscription.')
        return
      }
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const revokeGift = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}/plan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Could not revoke gifted subscription.')
        return
      }
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const giftPoints = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}/nexus-points`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(pointsAmount), description: pointsDescription }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Could not gift Nexus Points.')
        return
      }
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const deleteUser = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Could not delete user.')
        return
      }
      await onDeleted()
    } finally {
      setBusy(false)
    }
  }

  const status = statusOf(user)

  return (
    <Modal open title={user.displayName} description={user.email} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', status.tone)}>{status.label}</span>
          <span className={cn('w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', planTone(user.plan))}>{user.plan}</span>
          <code className="select-all rounded bg-white/5 px-2 py-1 text-[10px] text-white/50">{user.id}</code>
        </div>
        {error && <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

        <section className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.045] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-100"><Crown className="size-3.5" /> Gift subscription</p>
          <div className="mt-2 grid gap-2 rounded-xl bg-black/20 p-3 text-xs text-white/60 sm:grid-cols-2">
            <span>Effective plan: <strong className="text-white">{user.plan}</strong></span>
            <span>Stripe: <strong className="text-white">{user.hasActiveSubscription ? user.subscriptionStatus ?? 'active' : 'none'}</strong></span>
            <span>Gift: <strong className="text-white">{user.adminGrantedPlan ?? 'none'}</strong></span>
            <span>Expires: <strong className="text-white">{formatDate(user.adminPlanExpiresAt)}</strong></span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_100px_auto]">
            <select value={giftPlan} onChange={(event) => setGiftPlan(event.target.value as PaidPlan)} className="calculator-input py-2 text-xs">
              <option value="Plus">Plus</option>
              <option value="Premium">Premium</option>
            </select>
            <input value={giftDays} onChange={(event) => setGiftDays(event.target.value)} type="number" min={1} max={3650} className="calculator-input py-2 text-xs" aria-label="Gift days" />
            <button type="button" disabled={busy} onClick={() => void giftSubscription()} className="primary-action justify-center px-3 py-2 text-[11px]"><Gift className="size-3.5" /> Gift</button>
          </div>
          <button type="button" disabled={busy || !user.adminGrantedPlan} onClick={() => void revokeGift()} className="secondary-action mt-2 px-3 py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-40">
            Revoke admin gift
          </button>
        </section>

        <section className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.045] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-100"><Coins className="size-3.5" /> Gift Nexus Points</p>
          <p className="mt-1 text-[11px] text-white/50">Pending unclaimed gifts: {user.pendingNexusPointGrantCount} · {user.pendingNexusPoints.toLocaleString()} points.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr_auto]">
            <input value={pointsAmount} onChange={(event) => setPointsAmount(event.target.value)} type="number" min={1} max={1000000} className="calculator-input py-2 text-xs" aria-label="Nexus Points amount" />
            <input value={pointsDescription} onChange={(event) => setPointsDescription(event.target.value)} maxLength={160} className="calculator-input py-2 text-xs" placeholder="Gift note" />
            <button type="button" disabled={busy} onClick={() => void giftPoints()} className="primary-action justify-center px-3 py-2 text-[11px]"><Sparkles className="size-3.5" /> Send</button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/70"><UserCog className="size-3.5" /> Apex Clash XP</p>
          <p className="mt-1 text-lg font-semibold text-white">{xp ?? '…'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input value={xpAmount} onChange={(event) => setXpAmount(event.target.value)} type="number" min={0} className="calculator-input w-24 py-1.5 text-xs" />
            <button type="button" disabled={busy} onClick={() => void runXp('grant')} className="secondary-action px-2.5 py-1.5 text-[11px]">Grant</button>
            <button type="button" disabled={busy} onClick={() => void runXp('remove')} className="secondary-action px-2.5 py-1.5 text-[11px]">Remove</button>
            <button type="button" disabled={busy} onClick={() => void runXp('set')} className="secondary-action px-2.5 py-1.5 text-[11px]">Set</button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-xs font-semibold text-white/70">Suspend (temporary)</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[84px_auto_1fr] sm:items-center">
            <input value={suspendHours} onChange={(event) => setSuspendHours(event.target.value)} type="number" min={1} className="calculator-input py-1.5 text-xs" />
            <span className="text-xs text-muted-foreground">hours</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (optional)" className="calculator-input py-1.5 text-xs" />
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void patch({ action: 'suspend', hours: Number(suspendHours), reason })} className="secondary-action px-3 py-1.5 text-[11px]">Suspend</button>
            {user.suspendedUntil && <button type="button" disabled={busy} onClick={() => void patch({ action: 'unsuspend' })} className="secondary-action px-3 py-1.5 text-[11px]"><ShieldOff className="size-3.5" /> Lift</button>}
          </div>
        </section>

        <section className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.03] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-300"><Ban className="size-3.5" /> Ban (indefinite)</p>
          <div className="mt-2 flex gap-2">
            {!user.bannedAt ? (
              <button type="button" disabled={busy} onClick={() => void patch({ action: 'ban', reason })} className="secondary-action border-rose-400/30 px-3 py-1.5 text-[11px] text-rose-300">Ban user</button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void patch({ action: 'unban' })} className="secondary-action px-3 py-1.5 text-[11px]"><Shield className="size-3.5" /> Unban</button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.03] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-300"><Trash2 className="size-3.5" /> Delete account</p>
          <p className="mt-1 text-[11px] text-white/50">Soft delete — anonymises the display name and blocks sign-in. Not a hard, irreversible deletion.</p>
          {!confirmDelete ? (
            <button type="button" disabled={busy || Boolean(user.deletedAt)} onClick={() => setConfirmDelete(true)} className="secondary-action mt-2 border-rose-400/30 px-3 py-1.5 text-[11px] text-rose-300 disabled:opacity-40">
              {user.deletedAt ? 'Already deleted' : 'Delete user'}
            </button>
          ) : (
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy} onClick={() => void deleteUser()} className="primary-action bg-rose-500 px-3 py-1.5 text-[11px] text-white hover:bg-rose-600">Confirm delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="secondary-action px-3 py-1.5 text-[11px]">Cancel</button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}