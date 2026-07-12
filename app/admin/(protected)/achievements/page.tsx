'use client'

import { useCallback, useEffect, useState } from 'react'
import { Award, Plus, Trash2, UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

type AdminAchievement = { id: string; slug: string; name: string; description: string; earnedCount: number }

export default function AdminAchievementsPage() {
  const [achievements, setAchievements] = useState<AdminAchievement[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [grantTarget, setGrantTarget] = useState<AdminAchievement | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/achievements', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setAchievements(((await response.json()) as { achievements: AdminAchievement[] }).achievements)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const remove = async (id: string) => {
    const response = await fetch(`/api/admin/achievements/${id}`, { method: 'DELETE', credentials: 'include' })
    if (response.ok) void load()
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Award className="size-5" /> Achievements</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real Apex achievement catalog — create, edit, delete, and manually grant/revoke.</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="primary-action px-4 py-2 text-xs"><Plus className="size-3.5" /> New</button>
      </header>

      {achievements == null ? (
        <p className="text-sm text-muted-foreground">Loading achievements…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {achievements.map((item) => (
            <article key={item.id} className="glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-white">{item.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{item.slug}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">{item.earnedCount} earned</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setGrantTarget(item)} className="secondary-action px-2.5 py-1.5 text-[11px]"><UserPlus className="size-3" /> Grant</button>
                <button type="button" onClick={() => void remove(item.id)} className="secondary-action px-2.5 py-1.5 text-[11px] text-rose-300"><Trash2 className="size-3" /> Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && <CreateAchievementModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void load() }} />}
      {grantTarget && <GrantModal achievement={grantTarget} onClose={() => setGrantTarget(null)} onGranted={() => { setGrantTarget(null); void load() }} />}
    </div>
  )
}

function CreateAchievementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/achievements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, description }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Could not create achievement.')
        return
      }
      onCreated()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title="New achievement" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="form-label" htmlFor="ach-slug">Slug</label>
        <input id="ach-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="early-riser" className="calculator-input" />
        <label className="form-label" htmlFor="ach-name">Name</label>
        <input id="ach-name" value={name} onChange={(event) => setName(event.target.value)} className="calculator-input" />
        <label className="form-label" htmlFor="ach-desc">Description</label>
        <textarea id="ach-desc" value={description} onChange={(event) => setDescription(event.target.value)} className="calculator-input min-h-20" />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button type="button" disabled={busy || !slug || !name} onClick={() => void submit()} className="primary-action mt-2 justify-center py-2.5">
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
    </Modal>
  )
}

function GrantModal({ achievement, onClose, onGranted }: { achievement: AdminAchievement; onClose: () => void; onGranted: () => void }) {
  const [userId, setUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/achievements/${achievement.id}/grants`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Could not grant achievement.')
        return
      }
      onGranted()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={`Grant "${achievement.name}"`} description="Paste the target user's id (visible on the Users page)." onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="form-label" htmlFor="grant-user-id">User ID</label>
        <input id="grant-user-id" value={userId} onChange={(event) => setUserId(event.target.value)} className="calculator-input" />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button type="button" disabled={busy || !userId} onClick={() => void submit()} className="primary-action mt-2 justify-center py-2.5">
          {busy ? 'Granting…' : 'Grant'}
        </button>
      </div>
    </Modal>
  )
}
