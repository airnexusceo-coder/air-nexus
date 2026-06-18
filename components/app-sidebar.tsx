'use client'

import { useState } from 'react'
import {
  Plus,
  Sparkles,
  ChevronsUpDown,
  Flame,
  Coins,
  Circle,
} from 'lucide-react'
import { navItems, rooms } from '@/lib/data'
import { cn } from '@/lib/utils'

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
        'inline-flex items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white ring-2 ring-background/40',
        color,
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function AppSidebar() {
  const [active, setActive] = useState('Documents')

  return (
    <aside className="glass-strong z-20 flex h-screen w-[260px] shrink-0 flex-col rounded-none border-y-0 border-l-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="glow-blue-sm flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500">
          <Sparkles className="size-5 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">AirNexus</p>
          <p className="text-xs text-muted-foreground">Workspace OS</p>
        </div>
      </div>

      {/* Current Plan & Upgrade */}
      <div className="px-4 pb-4">
        <div className="message-highlight rounded-2xl border border-[oklch(0.7_0.16_250_/_35%)] p-4">
          <div className="mb-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Current Plan
            </p>
            <p className="text-sm font-semibold text-foreground">Plus</p>
            <p className="text-[10px] text-muted-foreground">
              $5/month · Unlimited workspaces
            </p>
          </div>
          <button className="glow-blue-md w-full rounded-lg bg-gradient-to-r from-blue-500/40 to-cyan-400/30 px-3 py-2.5 text-xs font-bold text-[oklch(0.88_0.16_250)] transition-all hover:from-blue-500/50 hover:to-cyan-400/40 active:scale-95">
            Upgrade to Premium
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="scrollbar-thin mt-2 flex-1 overflow-y-auto px-3">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Workspace
        </p>
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = active === item.label
            return (
              <li key={item.label}>
                <button
                  onClick={() => setActive(item.label)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'glass text-foreground'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-[18px]',
                      isActive && 'text-[oklch(0.78_0.15_240)]',
                    )}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {/* Active rooms */}
        <div className="mt-5 flex items-center justify-between px-2 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Active Rooms
          </p>
          <button className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground">
            <Plus className="size-3.5" />
          </button>
        </div>
        <ul className="flex flex-col gap-2 pb-4">
          {rooms.map((room) => (
            <li key={room.name}>
              <button className="glass-subtle w-full rounded-2xl p-3 text-left transition-colors hover:bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium">
                    {room.name}
                  </span>
                  {room.unread && (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
                      {room.unread}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {room.members.map((m, i) => (
                      <Avatar
                        key={i}
                        initials={m.initials}
                        color={m.color}
                        className="size-5"
                      />
                    ))}
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <Circle className="size-2 fill-emerald-400" />
                    {room.online} online
                  </span>
                </div>
                {room.tag && (
                  <span
                    className={cn(
                      'mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold',
                      room.tag === 'Urgent'
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-violet-500/15 text-violet-300',
                    )}
                  >
                    {room.tag === 'AI Suggested' && (
                      <Sparkles className="size-2.5" />
                    )}
                    {room.tag}
                  </span>
                )}
                <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {room.summary}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Storage + profile */}
      <div className="space-y-3 px-4 pb-4 pt-2">
        <div className="glass-subtle rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Storage</span>
            <span className="font-medium">68.4 / 100 GB</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
          </div>
        </div>

        <button className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white/5">
          <Avatar
            initials="PS"
            color="from-blue-400 to-violet-500"
            className="size-9"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">Parth Sharma</p>
            <div className="mt-0.5 flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-amber-300">
                <Coins className="size-3" />
                3,940
              </span>
              <span className="flex items-center gap-1 text-orange-300">
                <Flame className="size-3" />
                27d
              </span>
            </div>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </button>
      </div>
    </aside>
  )
}
