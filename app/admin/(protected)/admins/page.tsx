'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

type AdminAccountView = {
  id: string
  username: string
  role: 'super_admin' | 'admin'
  permissions: string[]
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
}

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminAccountView[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/admins', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setAdmins(((await response.json()) as { admins: AdminAccountView[] }).admins)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const remove = async (id: string) => {
    setError(null)
    const response = await fetch(`/api/admin/admins/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null
      setError(data?.error ?? 'Could not remove admin.')
      return
    }
    void load()
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><ShieldAlert className="size-5" /> Admins</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage who can sign in to this console and what they can do.</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="primary-action px-4 py-2 text-xs"><Plus className="size-3.5" /> New admin</button>
      </header>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {admins == null ? (
        <p className="text-sm text-muted-foreground">Loading admins…</p>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="divide-y divide-white/6">
            {admins.map((admin) => (
              <div key={admin.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{admin.username}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {admin.role === 'super_admin' ? 'Super Admin · all permissions' : `${admin.permissions.length} permission${admin.permissions.length === 1 ? '' : 's'}`}
                    {admin.lastLoginAt && ` · last login ${new Date(admin.lastLoginAt).toLocaleString()}`}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', admin.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/40')}>
                  {admin.isActive ? 'Active' : 'Removed'}
                </span>
                {admin.isActive && (
                  <button type="button" onClick={() => void remove(admin.id)} aria-label={`Remove ${admin.username}`} className="interactive-icon size-8 shrink-0 text-rose-300">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {createOpen && <CreateAdminModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void load() }} />}
    </div>
  )
}

function CreateAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, permissions: [] }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Could not create admin.')
        return
      }
      onCreated()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title="New admin" description="A non-super_admin is created with zero permissions — grant specific ones from the Permissions page next." onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="form-label" htmlFor="new-admin-username">Username</label>
        <input id="new-admin-username" value={username} onChange={(event) => setUsername(event.target.value)} className="calculator-input" />
        <label className="form-label" htmlFor="new-admin-password">Password (12+ characters)</label>
        <input id="new-admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="calculator-input" />
        <label className="form-label" htmlFor="new-admin-role">Role</label>
        <select id="new-admin-role" value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'super_admin')} className="calculator-input">
          <option value="admin">Admin (explicit permissions)</option>
          <option value="super_admin">Super Admin (all permissions)</option>
        </select>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button type="button" disabled={busy || !username || !password} onClick={() => void submit()} className="primary-action mt-2 justify-center py-2.5">
          {busy ? 'Creating…' : 'Create admin'}
        </button>
      </div>
    </Modal>
  )
}
