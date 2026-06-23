'use client'

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  Coins,
  Flame,
  Plus,
  X,
} from 'lucide-react'
import { ThinkingLogo } from '@/components/thinking-logo'
import { PLAN_DETAILS, type NexusPlan } from '@/lib/plans'
import { navItems, rooms } from '@/lib/data'
import { cn } from '@/lib/utils'

type SidebarProps = {
  active: string
  activeRoom: string
  plan: NexusPlan
  nexusPoints: number
  profileName: string
  mobileOpen: boolean
  desktopCollapsed: boolean
  onCloseMobile: () => void
  onToggleDesktopCollapse: () => void
  onNavigate: (section: string) => void
  onSelectRoom: (room: string) => void
  onCreateRoom: () => void
  onUpgrade: () => void
  onProfile: () => void
  onBackToWebsite: () => void
}

function Avatar({
  initials,
  color,
  className,
}: {
  initials: string
  color: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white ring-2 ring-slate-950/60',
        color,
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function AppSidebar({
  active,
  activeRoom,
  plan,
  nexusPoints,
  profileName,
  mobileOpen,
  desktopCollapsed,
  onCloseMobile,
  onToggleDesktopCollapse,
  onNavigate,
  onSelectRoom,
  onCreateRoom,
  onUpgrade,
  onProfile,
  onBackToWebsite,
}: SidebarProps) {
  const initials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AN'
  const collapsedNav = navItems.slice(0, 12)
  return (
    <>
      {desktopCollapsed && (
        <aside
          aria-label="Collapsed workspace navigation"
          className="hidden w-16 shrink-0 flex-col items-center border-r border-white/8 bg-[oklch(0.09_0.02_45_/_96%)] px-2 py-4 shadow-2xl backdrop-blur-2xl lg:flex"
        >
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            aria-label="Expand navigation"
            title="Expand navigation"
            className="interactive-icon size-11"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('Dashboard')}
            aria-label="Go to AirGPT dashboard"
            title="AirGPT dashboard"
            className="mt-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
          >
            <ThinkingLogo isThinking={false} className="size-10" priority />
          </button>
          <div className="my-4 h-px w-9 bg-white/10" />
          <nav className="scrollbar-thin flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto" aria-label="Collapsed workspace sections">
            {collapsedNav.map((item) => {
              const Icon = item.icon
              const isActive = active === item.label
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onNavigate(item.label)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  className={cn(
                    'relative flex size-10 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/50',
                    isActive ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/[0.055] hover:text-white',
                  )}
                >
                  <Icon className="size-[18px]" />
                  {item.badge && <span className="absolute right-1 top-1 size-2 rounded-full bg-orange-400" />}
                </button>
              )
            })}
          </nav>
          <div className="mt-3 flex flex-col items-center gap-2 border-t border-white/8 pt-3">
            <button type="button" onClick={onBackToWebsite} aria-label="Back to Air Nexus website" title="Back to Air Nexus" className="interactive-icon size-10">
              <ArrowLeft className="size-4" />
            </button>
            <button type="button" onClick={onUpgrade} aria-label="Upgrade or manage plan" title={plan === 'Free' ? 'Upgrade plan' : 'Manage plan'} className="interactive-icon size-10 text-orange-200">
              <Coins className="size-4" />
            </button>
            <button type="button" onClick={onProfile} aria-label="Open profile and settings" title={profileName} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/50">
              <Avatar initials={initials} color="from-orange-400 to-amber-500" className="size-10" />
            </button>
          </div>
        </aside>
      )}

      <aside
        aria-label="Workspace navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[286px] shrink-0 flex-col border-r border-white/8 bg-[oklch(0.09_0.02_45_/_96%)] shadow-2xl backdrop-blur-2xl transition-transform duration-300',
          desktopCollapsed ? 'lg:hidden' : 'lg:static lg:z-20 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
      <div className="flex items-center gap-3 px-5 py-5">
        <button
          type="button"
          onClick={() => onNavigate('Dashboard')}
          aria-label="Go to AirGPT dashboard"
          className="flex items-center gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
        >
          <ThinkingLogo isThinking={false} className="size-11" priority />
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-white">AirGPT</span>
            <span className="block text-xs text-white/55">Workspace OS</span>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            aria-label="Collapse navigation"
            title="Collapse navigation"
            className="interactive-icon hidden lg:flex"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="interactive-icon lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={onBackToWebsite}
          className="flex w-full items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-xs text-white/60 transition hover:border-orange-400/25 hover:bg-orange-500/10 hover:text-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/50"
        >
          <ArrowLeft className="size-3.5" />
          Back to Air Nexus website
        </button>
      </div>
      <div className="px-4 pb-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
            Current plan
          </p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-base font-semibold text-white">{plan}</p>
            {plan === 'Premium' && (
              <span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                Priority
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-white/45">
            {PLAN_DETAILS[plan].price} · {PLAN_DETAILS[plan].summary}
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500/70 to-orange-400/55 px-3 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/10 transition hover:brightness-110 active:scale-[0.98]"
          >
            {plan === 'Free' ? 'Upgrade plan' : 'Manage plan'}
          </button>
        </div>
      </div>

      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45">
          Workspace
        </p>
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = active === item.label
            return (
              <li key={item.label}>
                <button
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate(item.label)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/50',
                    isActive
                      ? 'bg-white/10 text-white shadow-inner shadow-white/5'
                      : 'text-white/58 hover:bg-white/[0.055] hover:text-white',
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 flex items-center justify-between px-2 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45">
            Active rooms
          </p>
          <button
            type="button"
            onClick={onCreateRoom}
            aria-label="Create collaboration room"
            className="interactive-icon size-7"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {rooms.map((room) => {
            const selected = activeRoom === room.name && active === 'Collaboration Rooms'
            return (
              <li key={room.name}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectRoom(room.name)}
                  className={cn(
                    'w-full rounded-2xl border p-3 text-left transition',
                    selected
                      ? 'border-orange-400/30 bg-orange-500/10'
                      : 'border-transparent bg-white/[0.035] hover:bg-white/[0.07]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-white">{room.name}</span>
                    {room.unread && (
                      <span className="flex size-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                        {room.unread}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {room.members.map((member) => (
                        <Avatar
                          key={member.initials}
                          initials={member.initials}
                          color={member.color}
                          className="size-5"
                        />
                      ))}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <Circle className="size-2 fill-emerald-400" />
                      {room.online} online
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-white/45">
                    {room.summary}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-white/6 px-4 pb-4 pt-3">
        <div className="rounded-2xl bg-white/[0.04] p-3">
          <div className="flex items-center justify-between text-xs text-white/55">
            <span>Storage</span>
            <span>68.4 / 100 GB</span>
          </div>
          <div
            className="mt-2 h-1.5 w-full rounded-full bg-white/10"
            role="progressbar"
            aria-label="Storage used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={68}
          >
            <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-orange-400 to-orange-500" />
          </div>
        </div>

        <button
          type="button"
          onClick={onProfile}
          aria-label="Open profile and settings"
          className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.045] p-3 text-left transition hover:bg-white/[0.08]"
        >
          <Avatar initials={initials} color="from-orange-400 to-amber-500" className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{profileName}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-amber-300">
                <Coins className="size-3" />
                {nexusPoints.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-orange-300">
                <Flame className="size-3" />
                27d
              </span>
            </div>
          </div>
          <ChevronsUpDown className="size-4 text-white/35" />
        </button>
      </div>
    </aside>
    </>
  )
}
