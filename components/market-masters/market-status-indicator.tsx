'use client'

import { CalendarClock, CircleDot, Timer } from 'lucide-react'
import type { MarketStatus } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

type MarketStatusIndicatorProps = {
  day: number
  simulatedDate: string
  secondsRemaining: number
  status: MarketStatus
}

/** Shown on Dashboard, Market, and Portfolio — the one place a player checks "is the market open, and when does it move next." Follows real 9am-5pm local trading hours, Monday to Friday. */
export function MarketStatusIndicator({ day, simulatedDate, secondsRemaining, status }: MarketStatusIndicatorProps) {
  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl px-3 py-2 text-xs text-slate-300" role="status" aria-live="polite">
      <span className="flex items-center gap-1.5">
        <CircleDot className={cn('size-3', status === 'open' ? 'text-emerald-300' : 'text-slate-500')} aria-hidden="true" />
        Market {status === 'open' ? 'open' : 'closed'}
      </span>
      <span className="flex items-center gap-1.5">
        <CalendarClock className="size-3.5 text-slate-500" aria-hidden="true" />
        {day > 0 ? `Trading day ${day} · ` : ''}{simulatedDate}
      </span>
      <span className="flex items-center gap-1.5">
        <Timer className="size-3.5 text-slate-500" aria-hidden="true" />
        {status === 'open' ? `Next update in ${formatDuration(secondsRemaining)}` : `Opens in ${formatDuration(secondsRemaining)}`}
      </span>
    </div>
  )
}
