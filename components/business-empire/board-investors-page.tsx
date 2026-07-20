'use client'

import { useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { computeEarnedBoardSeats, computeImpliedSharePrice, computeOutsideOwnershipPercent } from '@/lib/business-empire/investors'
import { formatCurrency } from '@/lib/business-empire/format'
import type { GameState } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type BoardInvestorsPageProps = {
  state: GameState
  onPreviewSale: (percentToSell: number) => { amountRaised: number; error?: string }
  onSellShares: (percentToSell: number) => { error?: string }
}

export function BoardInvestorsPage({ state, onPreviewSale, onSellShares }: BoardInvestorsPageProps) {
  const [percentToSell, setPercentToSell] = useState(10)
  const [result, setResult] = useState<{ error?: string } | null>(null)

  const outsideOwnership = computeOutsideOwnershipPercent(state.founderOwnershipPercent)
  const sharePrice = computeImpliedSharePrice(state.companyValue)
  const preview = useMemo(() => onPreviewSale(percentToSell), [onPreviewSale, percentToSell])
  const earnedSeats = computeEarnedBoardSeats(outsideOwnership)

  const handleSell = () => {
    setResult(onSellShares(percentToSell))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Users className="size-5 text-amber-300" />Board &amp; Investors</h1>
        <p className="mt-1 text-sm text-slate-400">Selling equity is the only way outside cash ever becomes company capital — it always dilutes founder ownership by exactly the percent sold, in exchange for cash at the company&apos;s current valuation.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Founder ownership</p>
          <p className="mt-1 text-2xl font-bold text-white">{state.founderOwnershipPercent}%</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Outside ownership</p>
          <p className="mt-1 text-2xl font-bold text-white">{outsideOwnership}%</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Implied share price</p>
          <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(sharePrice)}</p>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Raise capital by selling equity</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs text-slate-400">Percent to sell</span>
            <input type="number" min={1} max={90} step={1} value={percentToSell} onChange={(event) => setPercentToSell(Math.max(0, Number(event.target.value) || 0))} className="glass-input mt-1 w-28 rounded-lg px-3 py-2 text-sm outline-none" />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-300">Raises approximately <span className="font-semibold text-white">{formatCurrency(preview.amountRaised)}</span> at the current valuation.</p>
        {preview.error && <p className="mt-2 text-xs text-rose-300">{preview.error}</p>}
        <button type="button" onClick={handleSell} disabled={Boolean(preview.error)} className="primary-action mt-3 disabled:cursor-not-allowed disabled:opacity-40">Sell equity</button>
        {result?.error && <p role="alert" className="mt-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{result.error}</p>}
        {result && !result.error && <p className="mt-2 text-xs text-emerald-300">Shares sold — funds added to cash.</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white">Board of directors</h2>
        {state.boardMembers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{earnedSeats === 0 ? 'No board yet — one forms once outside ownership crosses 20%.' : 'No board members yet.'}</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {state.boardMembers.map((member) => (
              <div key={member.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">{member.name}</p>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] capitalize',
                    member.riskTolerance === 'aggressive' ? 'bg-rose-400/10 text-rose-300' : member.riskTolerance === 'cautious' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300')}>
                    {member.riskTolerance}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{member.role} · joined {member.joinedYear}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {state.shareSales.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white">Fundraising history</h2>
          <div className="mt-3 space-y-1.5">
            {[...state.shareSales].reverse().map((sale) => (
              <div key={sale.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
                <span>Sold {sale.percentSold}% equity in Year {sale.year}</span>
                <span>{formatCurrency(sale.amountRaised)} at a {formatCurrency(sale.valuationAtSale)} valuation</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
