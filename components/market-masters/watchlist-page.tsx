'use client'

import { Star } from 'lucide-react'
import { StockMarketView } from '@/components/market-masters/stock-market-view'
import type { GameState, Stock } from '@/lib/market-masters/types'

type WatchlistPageProps = {
  stocks: Stock[]
  state: GameState
  onOpenDetail: (ticker: string) => void
  onToggleWatchlist: (ticker: string) => void
}

export function WatchlistPage({ stocks, state, onOpenDetail, onToggleWatchlist }: WatchlistPageProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Star className="size-5 text-amber-300" />Watchlist</h1>
        <p className="mt-1 text-sm text-slate-400">Companies you&apos;re keeping an eye on, without owning them yet.</p>
      </div>
      <StockMarketView stocks={stocks} state={state} onOpenDetail={onOpenDetail} onToggleWatchlist={onToggleWatchlist} lockedToWatchlist />
    </div>
  )
}
