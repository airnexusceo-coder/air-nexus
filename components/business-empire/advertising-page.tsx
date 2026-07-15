'use client'

import { useMemo, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { InfoTip } from '@/components/business-empire/info-tip'
import { ADVERTISING_CHANNELS } from '@/lib/business-empire/advertising'
import { formatCurrency } from '@/lib/business-empire/format'
import { getIndustryProfile } from '@/lib/business-empire/industries'
import type { AdvertisingChannel, GameState } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type AdvertisingPageProps = {
  state: GameState
  onLaunch: (productId: string, channel: AdvertisingChannel, budget: number) => { error?: string }
}

export function AdvertisingPage({ state, onLaunch }: AdvertisingPageProps) {
  const industry = useMemo(() => getIndustryProfile(state.industry), [state.industry])
  const active = state.products.filter((p) => !p.discontinued)
  const [productId, setProductId] = useState(active[0]?.id ?? '')
  const [channel, setChannel] = useState<AdvertisingChannel>('social-media')
  const channelProfile = ADVERTISING_CHANNELS.find((c) => c.id === channel)!
  const [budget, setBudget] = useState(channelProfile.minBudget)
  const [error, setError] = useState<string | null>(null)

  const effectiveness = industry.advertisingEffectiveness[channel]
  const estimatedReach = Math.round(budget * channelProfile.reachPerDollar * effectiveness)

  const handleChannelChange = (next: AdvertisingChannel) => {
    setChannel(next)
    const nextProfile = ADVERTISING_CHANNELS.find((c) => c.id === next)!
    setBudget(Math.max(budget, nextProfile.minBudget))
  }

  const handleLaunch = () => {
    if (!productId) {
      setError('Create a product first.')
      return
    }
    const result = onLaunch(productId, channel, budget)
    if (result.error) {
      setError(result.error)
      return
    }
    setError(null)
  }

  const campaigns = [...state.advertisingCampaigns].reverse()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Megaphone className="size-5 text-amber-300" />Advertising</h1>
        <p className="mt-1 text-sm text-slate-400">Advertising raises awareness, which increases the chance of a sale — it never guarantees one.</p>
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-slate-500">Create a product first to advertise it.</p>
      ) : (
        <section className="glass rounded-2xl p-5">
          <label className="block">
            <span className="text-xs text-slate-400">Product to advertise</span>
            <select value={productId} onChange={(event) => setProductId(event.target.value)} className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none">
              {active.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>

          <p className="mt-4 text-xs text-slate-400">Channel</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ADVERTISING_CHANNELS.map((option) => {
              const industryEffectiveness = industry.advertisingEffectiveness[option.id]
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleChannelChange(option.id)}
                  aria-pressed={channel === option.id}
                  className={cn('rounded-xl border p-3 text-left transition', channel === option.id ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <p className="min-w-0 truncate text-sm font-semibold text-white">{option.label}</p>
                    <span className="shrink-0 text-[10px] text-slate-500">{Math.round(industryEffectiveness * 100)}% fit for {state.industry}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
                  <p className="mt-1 text-[10px] text-slate-500">Targets: {option.targetAudience}</p>
                  {option.id !== 'none' && <p className="mt-1 text-[10px] text-amber-200/80">Risk: {option.risk}</p>}
                </button>
              )
            })}
          </div>

          {channel !== 'none' && (
            <>
              <label className="mt-4 block">
                <span className="text-xs text-slate-400">Campaign budget (minimum {formatCurrency(channelProfile.minBudget)})</span>
                <input type="number" min={channelProfile.minBudget} step={50} value={budget} onChange={(event) => setBudget(Math.max(channelProfile.minBudget, Number(event.target.value) || 0))} className="glass-input mt-1 w-40 rounded-lg px-3 py-2 text-sm outline-none" />
              </label>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
                <span>Estimated reach: <span className="font-semibold text-white">~{estimatedReach.toLocaleString()} potential customers</span></span>
                <InfoTip term="Advertising reach" />
              </div>

              {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

              <button type="button" onClick={handleLaunch} className="primary-action mt-4">Launch campaign</button>
            </>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-white">Campaign history (this year)</h2>
        {campaigns.filter((c) => c.year === state.year).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No campaigns launched yet this year.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {campaigns.filter((c) => c.year === state.year).map((campaign) => {
              const product = state.products.find((p) => p.id === campaign.productId)
              const label = ADVERTISING_CHANNELS.find((c) => c.id === campaign.channel)?.label
              return (
                <div key={campaign.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                  {label} for {product?.name ?? 'a product'} — {formatCurrency(campaign.budget)} budget, ~{campaign.estimatedReach.toLocaleString()} reach
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
