'use client'

import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpDown, ArrowUpRight, Search, Star } from 'lucide-react'
import { PriceChart } from '@/components/market-masters/price-chart'
import { formatCurrency, formatPercent } from '@/lib/market-masters/format'
import type { GameState, RiskLevel, Stock } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200',
  medium: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  high: 'border-rose-300/25 bg-rose-400/10 text-rose-200',
}

const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 }

export function dailyChangePercent(history: { day: number; price: number }[] | undefined): number {
  if (!history || history.length < 2) return 0
  const previous = history[history.length - 2].price
  const current = history[history.length - 1].price
  if (previous <= 0) return 0
  return ((current - previous) / previous) * 100
}

type SortKey = 'name' | 'ticker' | 'industry' | 'price' | 'change' | 'risk' | 'owned' | 'watchlist'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'name', label: 'Company name' },
  { id: 'ticker', label: 'Ticker symbol' },
  { id: 'industry', label: 'Industry' },
  { id: 'price', label: 'Share price' },
  { id: 'change', label: 'Daily change' },
  { id: 'risk', label: 'Risk level' },
  { id: 'owned', label: 'Shares owned' },
  { id: 'watchlist', label: 'Watchlist status' },
]

type StockMarketViewProps = {
  stocks: Stock[]
  state: GameState
  onOpenDetail: (ticker: string) => void
  onToggleWatchlist: (ticker: string) => void
  /** Locks the view to watchlisted stocks only and hides the toggle — used by the dedicated Watchlist page. */
  lockedToWatchlist?: boolean
}

export function StockMarketView({ stocks, state, onOpenDetail, onToggleWatchlist, lockedToWatchlist = false }: StockMarketViewProps) {
  const [query, setQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState<string>('All')
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all')
  const [watchlistOnly, setWatchlistOnly] = useState(lockedToWatchlist)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDescending, setSortDescending] = useState(false)

  const industries = useMemo(() => ['All', ...Array.from(new Set(stocks.map((stock) => stock.industry)))], [stocks])

  const rows = useMemo(() => stocks.map((stock) => ({
    stock,
    price: state.prices[stock.ticker] ?? stock.startingPrice,
    change: dailyChangePercent(state.priceHistory[stock.ticker]),
    owned: state.holdings[stock.ticker]?.shares ?? 0,
    watched: state.watchlist.includes(stock.ticker),
  })), [stocks, state.prices, state.priceHistory, state.holdings, state.watchlist])

  const filtered = rows.filter(({ stock, watched }) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = q.length === 0 || stock.name.toLowerCase().includes(q) || stock.ticker.toLowerCase().includes(q)
    const matchesIndustry = industryFilter === 'All' || stock.industry === industryFilter
    const matchesRisk = riskFilter === 'all' || stock.risk === riskFilter
    const matchesWatchlist = !watchlistOnly || watched
    return matchesQuery && matchesIndustry && matchesRisk && matchesWatchlist
  })

  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0
    switch (sortKey) {
      case 'name': comparison = a.stock.name.localeCompare(b.stock.name); break
      case 'ticker': comparison = a.stock.ticker.localeCompare(b.stock.ticker); break
      case 'industry': comparison = a.stock.industry.localeCompare(b.stock.industry); break
      case 'price': comparison = a.price - b.price; break
      case 'change': comparison = a.change - b.change; break
      case 'risk': comparison = RISK_RANK[a.stock.risk] - RISK_RANK[b.stock.risk]; break
      case 'owned': comparison = a.owned - b.owned; break
      case 'watchlist': comparison = Number(a.watched) - Number(b.watched); break
    }
    return sortDescending ? -comparison : comparison
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Market</h1>
        <p className="mt-1 text-sm text-slate-400">Search, sort, and filter every company, then tap one to see its full history and trade.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="glass-input flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 sm:max-w-xs">
          <Search className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company name or ticker..."
            aria-label="Search stocks or tickers"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="market-sort-key">Sort by</label>
          <select
            id="market-sort-key"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-xs text-white outline-none"
          >
            {SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>Sort: {option.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setSortDescending((current) => !current)}
            aria-label={sortDescending ? 'Sort descending — click to sort ascending' : 'Sort ascending — click to sort descending'}
            className="secondary-action px-2.5 py-1.5 text-xs"
          >
            <ArrowUpDown className="size-3.5" />
            {sortDescending ? 'Descending' : 'Ascending'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {industries.map((industry) => (
          <button
            key={industry}
            type="button"
            onClick={() => setIndustryFilter(industry)}
            aria-pressed={industryFilter === industry}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              industryFilter === industry ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
            )}
          >
            {industry}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'low', 'medium', 'high'] as const).map((risk) => (
          <button
            key={risk}
            type="button"
            onClick={() => setRiskFilter(risk)}
            aria-pressed={riskFilter === risk}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition',
              riskFilter === risk ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
            )}
          >
            {risk === 'all' ? 'All risk levels' : `${risk} risk`}
          </button>
        ))}
        {!lockedToWatchlist && (
          <button
            type="button"
            onClick={() => setWatchlistOnly((current) => !current)}
            aria-pressed={watchlistOnly}
            className={cn(
              'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
              watchlistOnly ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
            )}
          >
            <Star className={cn('size-3.5', watchlistOnly && 'fill-amber-300')} aria-hidden="true" />
            Watchlist only
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map(({ stock, price, change, owned, watched }) => {
          const positive = change >= 0
          return (
            <article key={stock.ticker} className="glass relative flex flex-col rounded-2xl p-4 transition hover:border-white/25">
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onToggleWatchlist(stock.ticker) }}
                aria-label={watched ? `Remove ${stock.name} from watchlist` : `Add ${stock.name} to watchlist`}
                aria-pressed={watched}
                className="absolute right-3 top-3 z-10 rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <Star className={cn('size-4', watched && 'fill-amber-300 text-amber-300')} />
              </button>

              <button type="button" onClick={() => onOpenDetail(stock.ticker)} className="flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-xl">
                <div className="flex items-start justify-between gap-2 pr-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{stock.name}</p>
                    <p className="text-xs text-slate-500">{stock.ticker} · {stock.industry}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', RISK_STYLES[stock.risk])}>
                    {stock.risk} risk
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="text-xl font-bold text-white">{formatCurrency(price)}</p>
                  <span className={cn('flex items-center gap-1 text-sm font-semibold', positive ? 'text-emerald-300' : 'text-rose-300')}>
                    {positive ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowDownRight className="size-3.5" aria-hidden="true" />}
                    {formatPercent(change)}
                  </span>
                </div>

                <div className="mt-2 h-12">
                  <PriceChart data={(state.priceHistory[stock.ticker] ?? []).slice(-30)} color={positive ? '#34d399' : '#fb7185'} height={48} />
                </div>
                <span className="sr-only">{`Price history: ${(state.priceHistory[stock.ticker] ?? []).length} trading days, currently ${formatCurrency(price)}, ${positive ? 'up' : 'down'} ${Math.abs(change).toFixed(2)} percent today.`}</span>

                {owned > 0 && <p className="mt-2 text-xs text-slate-400">You own {owned} share{owned === 1 ? '' : 's'}</p>}
              </button>
            </article>
          )
        })}
        {sorted.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">
            {lockedToWatchlist ? 'Nothing on your watchlist yet — star a company in the Market to add it here.' : 'No stocks match your search and filters.'}
          </p>
        )}
      </div>
    </div>
  )
}
