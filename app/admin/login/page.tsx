'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { NexusLogo } from '@/components/brand/nexus-mark'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Invalid credentials.')
        return
      }
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-7">
        <div className="flex items-center gap-3">
          <NexusLogo className="size-10" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-white">AirNexus</span>
            <span className="flex items-center gap-1 text-[11px] text-white/50"><ShieldAlert className="size-3" /> Admin Console</span>
          </span>
        </div>
        <h1 className="mt-5 text-xl font-semibold text-white">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">This is a separate credential from your AirNexus account.</p>

        <form onSubmit={(event) => void submit(event)} className="mt-6 flex flex-col gap-3">
          <label className="form-label" htmlFor="admin-username">Username</label>
          <input
            id="admin-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className="calculator-input"
            required
          />
          <label className="form-label" htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="calculator-input"
            required
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button type="submit" disabled={busy || !username || !password} className="primary-action mt-2 justify-center py-2.5">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
