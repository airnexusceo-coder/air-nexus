'use client'

import { useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'
import { InfoTip } from '@/components/business-empire/info-tip'
import { estimateProductDemandAtPrice } from '@/lib/business-empire/game-state'
import { getIndustryProfile } from '@/lib/business-empire/industries'
import { formatCurrency, formatPercent } from '@/lib/business-empire/format'
import type { GameState } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type PricingPageProps = {
  state: GameState
  onUpdatePrice: (productId: string, price: number) => { error?: string }
}

export function PricingPage({ state, onUpdatePrice }: PricingPageProps) {
  const industry = useMemo(() => getIndustryProfile(state.industry), [state.industry])
  const active = state.products.filter((p) => !p.discontinued)
  const competitorAverage = state.competitors.length > 0 ? state.competitors.reduce((sum, c) => sum + c.price, 0) / state.competitors.length : industry.averagePrice

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Wallet className="size-5 text-amber-300" />Pricing</h1>
        <p className="mt-1 text-sm text-slate-400">Price realistically affects demand. A price that is too high can suppress demand even for a great product; a price that is too low can sell fast but leave little profit.</p>
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-slate-500">Create a product first to set its price.</p>
      ) : (
        active.map((product) => (
          <PricingCard key={product.id} state={state} productId={product.id} competitorAverage={competitorAverage} onUpdatePrice={onUpdatePrice} />
        ))
      )}
    </div>
  )
}

function PricingCard({ state, productId, competitorAverage, onUpdatePrice }: { state: GameState; productId: string; competitorAverage: number; onUpdatePrice: PricingPageProps['onUpdatePrice'] }) {
  const product = state.products.find((p) => p.id === productId)!
  const [draftPrice, setDraftPrice] = useState(product.price)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const relatedResearch = [...state.researchReports].reverse().find((r) => r.targetGroupId === product.targetGroupId)
  // Memoized on (state, productId, draftPrice) so the estimate only recomputes when one of those
  // actually changes — computeDemand rolls a fresh Math.random() swing internally, and without
  // memoizing, unrelated re-renders (e.g. the "Saved." timeout below) made the number visibly
  // jump around even though the player hadn't touched the price.
  const estimatedDemand = useMemo(() => estimateProductDemandAtPrice(state, productId, draftPrice), [state, productId, draftPrice])
  const margin = draftPrice > 0 ? ((draftPrice - product.costPerUnit) / draftPrice) * 100 : 0
  const breakEvenPrice = product.costPerUnit

  const handleSave = () => {
    const result = onUpdatePrice(productId, draftPrice)
    if (result.error) {
      setError(result.error)
      setSaved(false)
      return
    }
    setError(null)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm font-semibold text-white">{product.name}</p>

      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <Row label="Production cost per unit" value={formatCurrency(product.costPerUnit)} definition="How much it costs to manufacture one unit of this product." />
        <Row label="Break-even price" value={formatCurrency(breakEvenPrice)} definition="The minimum price needed just to cover the cost of making one unit — anything above this is gross profit per unit." />
        <Row label="Competitor average price" value={formatCurrency(competitorAverage)} definition="The average selling price among competitors in your industry." />
        {relatedResearch && <Row label="Recommended range (research)" value={`${formatCurrency(relatedResearch.priceRangeLow)} – ${formatCurrency(relatedResearch.priceRangeHigh)}`} definition="The price range your most recent research report for this customer group suggested." />}
        <Row label="Expected profit margin" value={formatPercent(margin)} definition="How much of each sale, at the price below, would be profit after production cost." tone={margin >= 0 ? 'positive' : 'negative'} />
        <Row label="Estimated demand at this price" value={`~${estimatedDemand.toLocaleString()} units`} definition="A live estimate of how many customers would want to buy at the price you are currently entering — not a guarantee." />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-slate-400">Selling price</span>
          <input type="number" min={1} step={1} value={draftPrice} onChange={(event) => setDraftPrice(Math.max(1, Number(event.target.value) || 0))} className="glass-input mt-1 w-32 rounded-lg px-3 py-2 text-sm outline-none" />
        </label>
        <button type="button" onClick={handleSave} className="primary-action">Save price</button>
        {saved && <span className="text-xs text-emerald-300">Saved.</span>}
      </div>
      {error && <p role="alert" className="mt-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
    </div>
  )
}

function Row({ label, value, definition, tone }: { label: string; value: string; definition: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">{label}<InfoTip term={label} definition={definition} /></p>
      <p className={cn('font-semibold', tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : 'text-white')}>{value}</p>
    </div>
  )
}
