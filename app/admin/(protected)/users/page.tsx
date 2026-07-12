'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ban, Plus, Search, Shield, ShieldOff, Trash2, UserCog } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

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
}

function statusOf(user: AdminUserView): { label: string; tone: string } {
  if (user.deletedAt) return { label: 'Deleted', tone: 'bg-white/10 text-white/40' }
  if (user.bannedAt) return { label: 'Banned', tone: 'bg-rose-500/15 text-rose-300' }
  if (user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) return { label: 'Suspended', tone: 'bg-amber-500/15 text-amber-300' }
  return { label: 'Active', tone: 'bg-emerald-500/15 text-emerald-300' }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserView[] | null>(null)
  const [selected, setSelected] = useState<AdminUserView | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setUsers(((await response.json()) as { users: AdminUserView[] }).users)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const trimmedQuery = query.trim().toLowerCase()
  const visibleUsers = (users ?? []).filter(
    (user) => !trimmedQuery || user.displayName.toLowerCase().includes(trimmedQuery) || user.email.toLowerCase().includes(trimmedQuery),
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users == null ? 'Real AirNexus accounts — view, edit, suspend, ban, delete, create.' : `${users.length.toLocaleString()} account${users.length === 1 ? '' : 's'} · view, edit, suspend, ban, delete, create.`}
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
        <div className="glass overflow-hidden rounded-2xl">
          <div className="divide-y divide-white/6">
            {visibleUsers.map((user) => {
              const status = statusOf(user)
              return (
                <button key={user.id} type="button" onClick={() => setSelected(user)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-xs font-bold text-white">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{user.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <span className="hidden shrink-0 text-[11px] text-white/40 sm:block">Joined {new Date(user.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', status.tone)}>{status.label}</span>
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
          onChanged={() => { setSelected(null); void load() }}
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

function UserDetailModal({ user, onClose, onChanged }: { user: AdminUserView; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [suspendHours, setSuspendHours] = useState('24')
  const [reason, setReason] = useState('')
  const [xp, setXp] = useState<number | null>(null)
  const [xpAmount, setXpAmount] = useState('100')

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
      onChanged()
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
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const status = statusOf(user)

  return (
    <Modal open title={user.displayName} description={user.email} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <span className={cn('w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', status.tone)}>{status.label}</span>
          <code className="select-all rounded bg-white/5 px-2 py-1 text-[10px] text-white/50">{user.id}</code>
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}

        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/70"><UserCog className="size-3.5" /> Apex Clash XP</p>
          <p className="mt-1 text-lg font-semibold text-white">{xp ?? '…'}</p>
          <div className="mt-2 flex items-center gap-2">
            <input value={xpAmount} onChange={(event) => setXpAmount(event.target.value)} type="number" min={0} className="calculator-input w-24 py-1.5 text-xs" />
            <button type="button" disabled={busy} onClick={() => void runXp('grant')} className="secondary-action px-2.5 py-1.5 text-[11px]">Grant</button>
            <button type="button" disabled={busy} onClick={() => void runXp('remove')} className="secondary-action px-2.5 py-1.5 text-[11px]">Remove</button>
            <button type="button" disabled={busy} onClick={() => void runXp('set')} className="secondary-action px-2.5 py-1.5 text-[11px]">Set</button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
          <p className="text-xs font-semibold text-white/70">Suspend (temporary)</p>
          <div className="mt-2 flex items-center gap-2">
            <input value={suspendHours} onChange={(event) => setSuspendHours(event.target.value)} type="number" min={1} className="calculator-input w-20 py-1.5 text-xs" />
            <span className="text-xs text-muted-foreground">hours</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (optional)" className="calculator-input flex-1 py-1.5 text-xs" />
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void patch({ action: 'suspend', hours: Number(suspendHours), reason })} className="secondary-action px-3 py-1.5 text-[11px]">Suspend</button>
            {user.suspendedUntil && <button type="button" disabled={busy} onClick={() => void patch({ action: 'unsuspend' })} className="secondary-action px-3 py-1.5 text-[11px]"><ShieldOff className="size-3.5" /> Lift</button>}
          </div>
        </section>

        <section className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.03] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-300"><Ban className="size-3.5" /> Ban (indefinite)</p>
          <div className="mt-2 flex gap-2">
            {!user.bannedAt ? (
              <button type="button" disabled={busy} onClick={() => void patch({ action: 'ban', reason })} className="secondary-action border-rose-400/30 px-3 py-1.5 text-[11px] text-rose-300">Ban user</button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void patch({ action: 'unban' })} className="secondary-action px-3 py-1.5 text-[11px]"><Shield className="size-3.5" /> Unban</button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.03] p-3">
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
