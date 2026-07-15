'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GraduationCap, LayoutDashboard, LogOut, ShieldCheck, Sparkles, Swords, Trophy, Users } from 'lucide-react'
import { NexusLogo } from '@/components/brand/nexus-mark'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/clashes', label: 'Clashes', icon: Swords },
  { href: '/admin/achievements', label: 'Achievements', icon: Trophy },
  { href: '/admin/market-masters', label: 'Market Masters', icon: GraduationCap },
  { href: '/admin/admins', label: 'Admins', icon: ShieldCheck },
  { href: '/admin/permissions', label: 'Permissions', icon: Sparkles },
]

export function AdminShell({ username, role, children }: { username: string; role: string; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const roleLabel = role === 'super_admin' ? 'Super Admin' : 'Admin'
  const initials = username.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AD'

  const signOut = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined)
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh flex-col text-white lg:flex-row">
      {/* Mobile top bar — the only navigation below lg */}
      <header className="glass-subtle sticky top-0 z-20 flex flex-col gap-3 border-x-0 border-t-0 px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <NexusLogo className="size-8" />
            <span className="leading-tight">
              <span className="block text-sm font-semibold">Admin Console</span>
              <span className="block text-[10px] text-white/50">{username} · {roleLabel}</span>
            </span>
          </span>
          <button type="button" onClick={() => void signOut()} aria-label="Sign out" className="interactive-icon">
            <LogOut className="size-4" />
          </button>
        </div>
        <nav aria-label="Admin sections" className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition',
                  active ? 'bg-white/12 text-white' : 'text-white/55 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <Icon className="size-3.5" /> {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/8 bg-[oklch(0.09_0.004_255_/_92%)] p-4 backdrop-blur-2xl lg:flex">
        <div className="flex items-center gap-3 px-1 pt-1">
          <NexusLogo className="size-9" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">AirNexus</span>
            <span className="block text-[11px] text-white/50">Admin Console</span>
          </span>
        </div>
        <nav aria-label="Admin sections" className="mt-7 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition',
                  active ? 'bg-white/10 text-white shadow-inner shadow-white/5' : 'text-white/55 hover:bg-white/[0.055] hover:text-white',
                )}
              >
                <Icon className="size-4" /> {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-white/8 pt-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-[11px] font-bold">{initials}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-xs font-medium">{username}</span>
              <span className="block text-[10px] text-white/50">{roleLabel}</span>
            </span>
            <button type="button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="interactive-icon size-8">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-8">{children}</main>
    </div>
  )
}
