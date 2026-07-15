'use client'

import { NAV_ITEMS, type BusinessEmpireView } from '@/components/business-empire/nav-items'
import { cn } from '@/lib/utils'

type SidebarNavProps = {
  companyName: string
  year: number
  active: BusinessEmpireView
  onNavigate: (view: BusinessEmpireView) => void
}

/** Persistent desktop sidebar for Business Empire — every one of the 12 sections is a single click away. */
export function SidebarNav({ companyName, year, active, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Business Empire navigation" className="hidden w-56 shrink-0 lg:block">
      <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-400/[0.05] px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-white">{companyName}</p>
        <p className="text-xs text-amber-200/80">Financial Year {year}</p>
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
                active === item.id ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : 'border-transparent text-slate-300 hover:bg-white/5',
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
