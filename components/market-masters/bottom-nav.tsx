'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { NAV_ITEMS, PRIMARY_MOBILE_VIEWS, type MarketMastersView } from '@/components/market-masters/nav-items'
import { cn } from '@/lib/utils'

type BottomNavProps = {
  active: MarketMastersView
  onNavigate: (view: MarketMastersView) => void
}

/** Mobile-only bottom bar for the most important pages, plus an accessible "More" menu for the rest — nothing is ever more than two taps away. */
export function BottomNav({ active, onNavigate }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const primaryItems = NAV_ITEMS.filter((item) => PRIMARY_MOBILE_VIEWS.includes(item.id))
  const moreItems = NAV_ITEMS.filter((item) => !PRIMARY_MOBILE_VIEWS.includes(item.id))
  const moreIsActive = moreItems.some((item) => item.id === active)

  return (
    <div className="lg:hidden">
      {moreOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-slate-950/70" role="presentation" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More Market Masters pages"
            onClick={(event) => event.stopPropagation()}
            className="glass-strong w-full rounded-t-3xl border-b-0 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">More</p>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close menu" className="interactive-icon"><X className="size-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onNavigate(item.id); setMoreOpen(false) }}
                  aria-current={active === item.id ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition',
                    active === item.id ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5',
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav aria-label="Market Masters navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/95 px-2 py-1.5 backdrop-blur">
        <div className="grid grid-cols-5 gap-1">
          {primaryItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active === item.id ? 'page' : undefined}
              className={cn('flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition', active === item.id ? 'text-white' : 'text-slate-500')}
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn('flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition', moreIsActive ? 'text-white' : 'text-slate-500')}
          >
            <Menu className="size-5" aria-hidden="true" />
            More
          </button>
        </div>
      </nav>
    </div>
  )
}
