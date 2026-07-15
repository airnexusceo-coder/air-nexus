'use client'

import { Search } from 'lucide-react'
import { NAV_ITEMS, type MarketMastersView } from '@/components/market-masters/nav-items'
import { cn } from '@/lib/utils'

type SidebarNavProps = {
  active: MarketMastersView
  onNavigate: (view: MarketMastersView) => void
  onSearch: (query: string) => void
}

/** Persistent desktop sidebar — every major area is one click away, and none is more than two clicks from any other. */
export function SidebarNav({ active, onNavigate, onSearch }: SidebarNavProps) {
  return (
    <nav aria-label="Market Masters navigation" className="hidden w-56 shrink-0 lg:block">
      <div className="glass-input mb-4 flex items-center gap-2 rounded-xl px-3 py-2">
        <Search className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search companies..."
          aria-label="Search companies"
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearch(event.currentTarget.value)
          }}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
        />
      </div>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active === item.id ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-medium transition',
                active === item.id ? 'border-white/25 bg-white text-black' : 'border-transparent text-slate-300 hover:bg-white/5',
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
