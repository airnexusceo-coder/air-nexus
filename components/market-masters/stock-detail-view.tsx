'use client'

import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Newspaper, Star } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { PriceChart } from '@/components/market-masters/price-chart'
import { dailyChangePercent } from '@/components/market-masters/stock-market-view'
import { TermTooltip } from '@/components/market-masters/term-tooltip'
import { formatCurrency, formatPercent } from '@/lib/market-masters/format'
import type { GameState, Stock } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

const RISK_STYLES: Record<Stock['risk'], string> = {
  low: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200',
  medium: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  high: 'border-rose-300/25 bg-rose-400/10 text-rose-200',
}

type TradeResult = { error?: string; feedback?: string }

type StockDetailViewProps = {
  stock: Stock
  state: GameState
  onClose: () => void
  onBuy: (ticker: string, shares: number) => TradeResult
  onSell: (ticker: string, shares: number) => TradeResult
  onToggleWatchlist: (ticker: string) => void
}

export function StockDetailView({ stock, state, onClose, onBuy, onSell, onToggleWatchlist }: StockDetailViewProps) {
  const watched = state.watchlist.includes(stock.ticker)
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const [sharesInput, setSharesInput] = useState('1')
  const [result, setResult] = useState<TradeResult | null>(null)

  const price = state.prices[stock.ticker] ?? stock.startingPrice
  const change = dailyChangePercent(state.priceHistory[stock.ticker])
  const positive = change >= 0
  const owned = state.holdings[stock.ticker]?.shares ?? 0
  const sharesNumber = Math.max(0, Math.floor(Number(sharesInput) || 0))
  const maxBuyShares = price > 0 ? Math.floor(state.cash / price) : 0
  const relatedNews = state.news.filter((item) => item.tickers.includes(stock.ticker)).slice(-6).reverse()

  const handleTrade = () => {
    if (sharesNumber <= 0) {
      setResult({ error: 'Enter a whole number of shares greater than zero.' })
      return
    }
    const outcome = mode === 'buy' ? onBuy(stock.ticker, sharesNumber) : onSell(stock.ticker, sharesNumber)
    setResult(outcome)
    if (!outcome.error) setSharesInput('1')
  }

  return (
    <Modal open title={stock.name} description={`${stock.ticker} · ${stock.industry}`} onClose={onClose} className="max-w-2xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-2xl font-bold text-white">{formatCurrency(price)}</p>
            <span className={cn('flex items-center gap-1 text-sm font-semibold', positive ? 'text-emerald-300' : 'text-rose-300')}>
              {positive ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
              {formatPercent(change)} today
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', RISK_STYLES[stock.risk])}>
              {stock.risk} risk
              <TermTooltip term="Risk level" />
            </span>
            <button
              type="button"
              onClick={() => onToggleWatchlist(stock.ticker)}
              aria-pressed={watched}
              aria-label={watched ? `Remove ${stock.name} from watchlist` : `Add ${stock.name} to watchlist`}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
                watched ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
              )}
            >
              <Star className={cn('size-3', watched && 'fill-amber-300')} />
              {watched ? 'Watching' : 'Watch'}
            </button>
          </div>
        </div>

        <div className="h-48 rounded-2xl border border-white/10 bg-black/20 p-2">
          <PriceChart data={state.priceHistory[stock.ticker] ?? []} color={positive ? '#34d399' : '#fb7185'} height={176} showAxes />
        </div>

        <p className="text-sm leading-relaxed text-slate-300">{stock.description}</p>
        {stock.dividendYield > 0 && (
          <p className="text-xs text-slate-500">Pays an approximate {stock.dividendYield}% annual dividend, split into quarterly payments to shareholders.</p>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">You own</span>
            <span className="font-semibold text-white">{owned} share{owned === 1 ? '' : 's'}</span>
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { setMode('buy'); setResult(null) }} className={cn('flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition', mode === 'buy' ? 'bg-white text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10')}>
              Buy
            </button>
            <button type="button" onClick={() => { setMode('sell'); setResult(null) }} className={cn('flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition', mode === 'sell' ? 'bg-white text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10')}>
              Sell
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={sharesInput}
              onChange={(event) => { setSharesInput(event.target.value); setResult(null) }}
              className="glass-input min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              aria-label="Number of shares"
            />
            <button
              type="button"
              onClick={() => setSharesInput(String(mode === 'buy' ? maxBuyShares : owned))}
              className="secondary-action px-3 py-2 text-xs"
            >
              Max
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {mode === 'buy'
              ? `Estimated cost: ${formatCurrency(sharesNumber * price)} · Cash available: ${formatCurrency(state.cash)}`
              : `Estimated proceeds: ${formatCurrency(sharesNumber * price)} · You own ${owned} share${owned === 1 ? '' : 's'}`}
          </p>

          <button type="button" onClick={handleTrade} className="primary-action mt-3 w-full">
            {mode === 'buy' ? 'Buy shares' : 'Sell shares'}
          </button>

          {result?.error && (
            <p role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
              {result.error}
            </p>
          )}
          {result?.feedback && (
            <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
              {result.feedback}
            </p>
          )}
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Newspaper className="size-4 text-slate-400" />
            Recent news about {stock.ticker}
          </h3>
          <div className="mt-3 space-y-2">
            {relatedNews.length === 0 && <p className="text-xs text-slate-500">No news about this company yet — the market updates automatically, so check back soon.</p>}
            {relatedNews.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-medium text-white">{item.headline}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
