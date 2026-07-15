'use client'

import { Wallet } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/market-masters/format'
import { getStock } from '@/lib/market-masters/stocks'
import type { GameState } from '@/lib/market-masters/types'

type FirstPurchaseExplainerProps = {
  ticker: string
  state: GameState
  onClose: () => void
}

/** Shown exactly once, right after a player's very first stock purchase — walks through what just happened to their cash and portfolio value in plain language. */
export function FirstPurchaseExplainer({ ticker, state, onClose }: FirstPurchaseExplainerProps) {
  const stock = getStock(ticker)
  const purchase = [...state.cashLedger].reverse().find((entry) => entry.type === 'BUY' && entry.ticker === ticker)
  if (!stock || !purchase) return null

  return (
    <Modal open title="You just made your first purchase!" description="Here's exactly what happened to your money." onClose={onClose} className="max-w-md">
      <div className="space-y-4 text-sm leading-6 text-slate-300">
        <div className="glass rounded-2xl p-4">
          <p className="flex items-center gap-2 font-semibold text-white"><Wallet className="size-4 text-emerald-300" aria-hidden="true" />What you bought</p>
          <p className="mt-2">
            You bought <span className="font-semibold text-white">{purchase.shares} share{purchase.shares === 1 ? '' : 's'}</span> of{' '}
            <span className="font-semibold text-white">{stock.name}</span> ({stock.ticker}) at {formatCurrency(purchase.pricePerShare ?? 0)} per share.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-semibold text-white">Cash spent</p>
          <p className="mt-1">{formatCurrency(Math.abs(purchase.amount))} moved out of your <span className="font-medium text-white">available cash</span> and into <span className="font-medium text-white">shares you own</span>. Your total portfolio value did not change — it just changed form, from cash to stock.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-semibold text-white">How portfolio value works</p>
          <p className="mt-1">Portfolio value = available cash + the current value of everything you own. As {stock.ticker}&apos;s price moves, the value of your shares moves with it — but that change only shows up in <span className="font-medium text-white">portfolio value</span>, never in your spendable cash, unless you sell.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-semibold text-white">Why the price may change</p>
          <p className="mt-1">Prices update automatically as the market simulates each trading day — driven by overall market trends, company-specific movement, and occasional news events. Nothing you do here guarantees a profit; that&apos;s the whole point of practicing.</p>
        </div>

        <button type="button" onClick={onClose} className="primary-action w-full">Got it</button>
      </div>
    </Modal>
  )
}
