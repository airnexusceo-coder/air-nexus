'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HeartHandshake, Star } from 'lucide-react'
import { InfoTip } from '@/components/business-empire/info-tip'
import { formatCurrency } from '@/lib/business-empire/format'
import { getReputationLevel } from '@/lib/business-empire/simulation'
import type { GameState, ReputationReasonCategory } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

const REASON_LABELS: Record<ReputationReasonCategory, string> = {
  COMPANY_FOUNDED: 'Company founded',
  RELIABLE_PRODUCT: 'Reliable product',
  QUALITY_ISSUE: 'Quality issue',
  COMPLAINT_HANDLED: 'Complaint handled well',
  COMPLAINT_IGNORED: 'Complaint ignored',
  ON_TIME_DELIVERY: 'On-time delivery',
  PRODUCTION_DELAY: 'Production delay',
  FAIR_TREATMENT: 'Fair employee treatment',
  SUPPLIER_PAYMENT_LATE: 'Late supplier payment',
  CRISIS_HANDLED_WELL: 'Crisis handled well',
  CRISIS_MISHANDLED: 'Crisis mishandled',
  HONEST_ADVERTISING: 'Honest advertising',
  MISLEADING_ADVERTISING: 'Misleading advertising',
  COMMUNITY_SUPPORT: 'Community support',
  ENVIRONMENTAL_RESPONSIBILITY: 'Environmental responsibility',
  ENVIRONMENTAL_HARM: 'Environmental harm',
  SATISFACTION_STREAK: 'Sustained high satisfaction',
  SATISFACTION_TREND: 'Satisfaction trend',
  PRODUCT_RECALL: 'Product recall',
  SCANDAL: 'Company scandal',
  REGULATION_BREACH: 'Regulation breach',
  UNFAIR_PRICING: 'Unfair pricing',
  PRODUCT_CANCELLED_POORLY: 'Product cancelled poorly',
  REPEATED_STOCKOUT: 'Repeated stockout',
  MULTI_YEAR_STABILITY: 'Long-term stability',
  MEDIA_COVERAGE: 'Media coverage',
  SAVE_MIGRATION: 'Save upgraded',
}

const LEVEL_COLOR: Record<string, string> = {
  Disastrous: 'text-rose-300',
  Poor: 'text-orange-300',
  Average: 'text-slate-300',
  Strong: 'text-emerald-300',
  Excellent: 'text-amber-300',
}

type ReputationPageProps = {
  state: GameState
  onInvestInCommunity: (budget: number) => { error?: string }
}

export function ReputationPage({ state, onInvestInCommunity }: ReputationPageProps) {
  const level = getReputationLevel(state.brandReputation)
  const chartData = state.reputationHistory.map((entry, index) => ({ index: index + 1, year: entry.year, value: entry.valueAfter }))
  const history = [...state.reputationHistory].reverse()
  const [communityBudget, setCommunityBudget] = useState(2000)
  const [communityError, setCommunityError] = useState<string | null>(null)

  const handleInvest = () => {
    const result = onInvestInCommunity(communityBudget)
    setCommunityError(result.error ?? null)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Star className="size-5 text-amber-300" />Reputation</h1>
        <p className="mt-1 text-sm text-slate-400">Reputation affects demand, advertising effectiveness, staff morale, loan approval, and more. Every change here is explained — nothing moves silently.</p>
      </div>

      <section className="glass-glow rounded-2xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">Current reputation</p>
            <p className="mt-1 text-3xl font-bold text-white">{state.brandReputation}<span className="text-base font-normal text-slate-500">/100</span></p>
          </div>
          <p className={cn('rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold', LEVEL_COLOR[level])}>{level}</p>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[10px] text-slate-500">
          <span className="text-rose-300">0–19 Disastrous</span>
          <span className="text-orange-300">20–39 Poor</span>
          <span className="text-slate-300">40–59 Average</span>
          <span className="text-emerald-300">60–79 Strong</span>
          <span className="text-amber-300">80–100 Excellent</span>
        </div>

        {chartData.length > 1 && (
          <div className="mt-4 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15,15,20,0.92)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 12, color: 'white' }}
                  labelFormatter={(year) => `Year ${year}`}
                  formatter={(value) => [`${value}/100`, 'Reputation']}
                />
                <Line type="monotone" dataKey="value" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><HeartHandshake className="size-4 text-amber-300" />Community &amp; environmental initiative</h2>
        <p className="mt-1 text-xs text-slate-500">A deliberate spend that earns reputation — supporting a community project and committing to more responsible practices, bundled into one action.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs text-slate-400">Budget</span>
            <input type="number" min={0} step={500} value={communityBudget} onChange={(event) => setCommunityBudget(Math.max(0, Number(event.target.value) || 0))} className="glass-input mt-1 w-36 rounded-lg px-3 py-2 text-sm outline-none" />
          </label>
          <button type="button" onClick={handleInvest} className="primary-action">Invest</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Available cash: {formatCurrency(state.cash)}</p>
        {communityError && <p role="alert" className="mt-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{communityError}</p>}
      </section>

      <section>
        <h2 className="flex items-center gap-1 text-sm font-semibold text-white">Reputation history<InfoTip term="Reputation history" definition="Every change to reputation, in order, with the exact reason it happened." /></h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No reputation changes yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="glass rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">Year {entry.year} · {REASON_LABELS[entry.reasonCategory]}</p>
                  <span className={cn('shrink-0 text-xs font-semibold', entry.delta > 0 ? 'text-emerald-300' : entry.delta < 0 ? 'text-rose-300' : 'text-slate-400')}>
                    {entry.delta > 0 ? '+' : ''}{entry.delta} ({entry.valueBefore} → {entry.valueAfter})
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{entry.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
