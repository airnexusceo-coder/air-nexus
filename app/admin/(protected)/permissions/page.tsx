'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, LockKeyhole, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type PermissionEntry = { permission: string; live: boolean; lockedReason: string | null }

export default function AdminPermissionsPage() {
  const [entries, setEntries] = useState<PermissionEntry[] | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/permissions', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setEntries(((await response.json()) as { permissions: PermissionEntry[] }).permissions)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const groups = new Map<string, PermissionEntry[]>()
  for (const entry of entries ?? []) {
    const group = entry.permission.split('.')[0]
    groups.set(group, [...(groups.get(group) ?? []), entry])
  }
  const liveCount = (entries ?? []).filter((entry) => entry.live).length

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Sparkles className="size-5" /> Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The full permission taxonomy. {entries && `${liveCount} of ${entries.length} are live — the rest are visibly locked, not faked, until their backing system exists.`}
        </p>
      </header>

      {entries == null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(groups.entries()).map(([group, items]) => (
            <section key={group} className="glass rounded-2xl p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">{group.replaceAll('_', ' ')}</h2>
              <ul className="mt-3 flex flex-col gap-1.5">
                {items.map((entry) => (
                  <li key={entry.permission} className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm', entry.live ? 'bg-white/[0.04]' : 'bg-white/[0.015] opacity-60')}>
                    {entry.live ? <CheckCircle2 className="size-4 shrink-0 text-emerald-300" /> : <LockKeyhole className="size-4 shrink-0 text-white/35" />}
                    <span className="min-w-0 flex-1">
                      <code className="text-xs text-white/85">{entry.permission}</code>
                      {!entry.live && entry.lockedReason && <span className="ml-2 text-[11px] text-white/40">{entry.lockedReason}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
