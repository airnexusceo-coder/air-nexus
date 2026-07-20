'use client'

import { Newspaper, Swords } from 'lucide-react'
import { formatCurrency } from '@/lib/business-empire/format'
import { COMPETITOR_STRATEGY_PROFILES, type CompetitorActivityEvent, type CompetitorStrategyType, type GameState } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type CompetitorsPageProps = {
  state: GameState
}

const COUNTER_STRATEGY_TIPS: Record<CompetitorStrategyType, string> = {
  'price-cutter': 'Compete on quality or loyalty rather than trying to match their price.',
  'luxury-leader': 'Compete on value, or target a different customer segment entirely.',
  'innovation-leader': 'Invest in your own R&D, or lean on reliability over novelty.',
  'marketing-giant': 'Build loyalty through product quality rather than out-advertising them.',
  'efficient-operator': 'Differentiate on features or service rather than price alone.',
  'aggressive-expander': 'Strengthen customer loyalty before they can enter your segment.',
  'ethical-brand': 'Match their fair-treatment story, or lean on your own strengths.',
  'corporate-predator': 'Build reputation and market share — a strong position discourages acquisition attempts.',
}

function ActivityRow({ event }: { event: CompetitorActivityEvent }) {
  const positive = event.demandImpactPercent > 0
  const negative = event.demandImpactPercent < 0
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{event.headline}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{event.detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">Year {event.year}</span>
          {event.demandImpactPercent !== 0 && (
            <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', negative ? 'bg-rose-400/10 text-rose-300' : positive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/8 text-slate-400')}>
              {negative ? '' : '+'}{event.demandImpactPercent}% demand
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function CompetitorsPage({ state }: CompetitorsPageProps) {
  const sorted = [...state.competitors].sort((a, b) => b.marketShare - a.marketShare)
  const yourShare = state.marketShare
  const activity = state.annualReports
    .flatMap((report) => report.competitorActions)
    .sort((a, b) => b.year - a.year)
    .slice(0, 20)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Swords className="size-5 text-amber-300" />Competitors</h1>
        <p className="mt-1 text-sm text-slate-400">Fictional companies in your industry — each follows a strategy archetype, takes one deliberate action a year, and reacts to your price, quality and market share.</p>
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
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Competitor comparison: name, strategy, price, quality, market share, reputation, advertising intensity, and a suggested counter-strategy.</caption>
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-2.5 font-medium">Company</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Strategy</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Price</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Quality</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Market share</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Reputation</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Advertising</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Counter-strategy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((competitor) => {
              const profile = COMPETITOR_STRATEGY_PROFILES[competitor.strategyType]
              return (
                <tr key={competitor.id}>
                  <td className="px-4 py-2.5 font-medium text-white">{competitor.name}</td>
                  <td className="px-4 py-2.5 text-slate-300">
                    <span className="rounded-full bg-white/8 px-2 py-1 text-[11px]" title={profile.description}>{profile.label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">{formatCurrency(competitor.price)}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-300">{competitor.quality}</td>
                  <td className="px-4 py-2.5 text-slate-300">{competitor.marketShare}%</td>
                  <td className={cn('px-4 py-2.5 font-medium', competitor.reputation >= 60 ? 'text-emerald-300' : competitor.reputation < 40 ? 'text-rose-300' : 'text-slate-300')}>{competitor.reputation}/100</td>
                  <td className="px-4 py-2.5 text-slate-300">{competitor.advertisingIntensity >= 0.5 ? 'Heavy' : competitor.advertisingIntensity >= 0.3 ? 'Moderate' : 'Light'}</td>
                  <td className="px-4 py-2.5 text-xs leading-5 text-slate-400">{COUNTER_STRATEGY_TIPS[competitor.strategyType]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="glass rounded-2xl p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Newspaper className="size-4 text-amber-300" />Competitor activity feed</h2>
        <p className="mt-1 text-xs text-slate-500">What competitors actually did, and the estimated effect on your demand — most recent first.</p>
        <div className="mt-3 space-y-2">
          {activity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">No competitor activity yet — complete a financial year to see what they did.</p>
          ) : (
            activity.map((event) => <ActivityRow key={event.id} event={event} />)
          )}
        </div>
      </div>
    </div>
  )
}
