'use client'

import { Swords } from 'lucide-react'
import { formatCurrency } from '@/lib/business-empire/format'
import type { GameState } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type CompetitorsPageProps = {
  state: GameState
}

export function CompetitorsPage({ state }: CompetitorsPageProps) {
  const sorted = [...state.competitors].sort((a, b) => b.marketShare - a.marketShare)
  const yourShare = state.marketShare

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Swords className="size-5 text-amber-300" />Competitors</h1>
        <p className="mt-1 text-sm text-slate-400">Fictional companies in your industry — they set their own prices, adjust quality, and react to the market every year, just like you do.</p>
      </div>

      <div className="glass flex items-center justify-between rounded-2xl p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Your market share</p>
          <p className="text-lg font-bold text-white">{yourShare.toFixed(1)}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Your reputation</p>
          <p className="text-lg font-bold text-white">{state.brandReputation}/100</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Competitor comparison: name, price, quality, market share, reputation, strengths, and weaknesses.</caption>
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-2.5 font-medium">Company</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Price</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Quality</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Market share</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Reputation</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Strengths &amp; weaknesses</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((competitor) => (
              <tr key={competitor.id}>
                <td className="px-4 py-2.5 font-medium text-white">{competitor.name}</td>
                <td className="px-4 py-2.5 text-slate-300">{formatCurrency(competitor.price)}</td>
                <td className="px-4 py-2.5 capitalize text-slate-300">{competitor.quality}</td>
                <td className="px-4 py-2.5 text-slate-300">{competitor.marketShare}%</td>
                <td className={cn('px-4 py-2.5 font-medium', competitor.reputation >= 60 ? 'text-emerald-300' : competitor.reputation < 40 ? 'text-rose-300' : 'text-slate-300')}>{competitor.reputation}/100</td>
                <td className="px-4 py-2.5 text-xs text-slate-400">
                  <p className="text-emerald-300/80">+ {competitor.strengths.join(', ')}</p>
                  <p className="text-rose-300/80">− {competitor.weaknesses.join(', ')}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
