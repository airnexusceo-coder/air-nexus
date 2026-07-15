'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, FlaskConical } from 'lucide-react'
import { InfoTip } from '@/components/business-empire/info-tip'
import { formatCurrency } from '@/lib/business-empire/format'
import { getIndustryProfile } from '@/lib/business-empire/industries'
import { RESEARCH_LEVELS, computeResearchCost } from '@/lib/business-empire/research'
import type { GameState, ResearchLevel } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type ResearchPageProps = {
  state: GameState
  onPurchase: (level: ResearchLevel, targetGroupId: string) => { error?: string }
}

export function ResearchPage({ state, onPurchase }: ResearchPageProps) {
  const industry = useMemo(() => getIndustryProfile(state.industry), [state.industry])
  const [targetGroupId, setTargetGroupId] = useState(industry.customerGroups[0]?.id ?? '')
  const [level, setLevel] = useState<ResearchLevel>('standard')
  const [error, setError] = useState<string | null>(null)
  const [justPurchasedId, setJustPurchasedId] = useState<string | null>(null)
  const prevReportCountRef = useRef(state.researchReports.length)

  const cost = computeResearchCost(industry, level)
  const reports = [...state.researchReports].reverse()

  // onPurchase mutates state in the parent; the `state` prop here won't reflect the new report
  // until this component re-renders, so the "just purchased" highlight is derived reactively
  // from the report count changing, rather than read synchronously right after the call.
  useEffect(() => {
    if (state.researchReports.length > prevReportCountRef.current) {
      const latest = state.researchReports[state.researchReports.length - 1]
      setJustPurchasedId(latest?.id ?? null)
      const timeout = window.setTimeout(() => setJustPurchasedId(null), 2500)
      prevReportCountRef.current = state.researchReports.length
      return () => window.clearTimeout(timeout)
    }
    prevReportCountRef.current = state.researchReports.length
  }, [state.researchReports])

  const handleBuy = () => {
    const result = onPurchase(level, targetGroupId)
    if (result.error) {
      setError(result.error)
      return
    }
    setError(null)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><FlaskConical className="size-5 text-amber-300" />Research</h1>
        <p className="mt-1 text-sm text-slate-400">Pay to reduce uncertainty before you commit real money to a product. Better research costs more but gives more accurate numbers.</p>
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white">Buy a report</h2>

        <div className="mt-3">
          <p className="text-xs text-slate-400">Customer group to research</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {industry.customerGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setTargetGroupId(group.id)}
                aria-pressed={targetGroupId === group.id}
                className={cn('rounded-full border px-3 py-1 text-xs font-medium transition', targetGroupId === group.id ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10')}
              >
                {group.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {RESEARCH_LEVELS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLevel(option.id)}
              aria-pressed={level === option.id}
              className={cn('rounded-xl border p-3 text-left transition', level === option.id ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5')}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{option.label}</p>
                <span className="text-xs text-slate-400">{formatCurrency(computeResearchCost(industry, option.id))}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          <span className="text-slate-400">Cost for this report</span>
          <span className="font-semibold text-white">{formatCurrency(cost)}</span>
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

        <button type="button" onClick={handleBuy} className="primary-action mt-4">Purchase research</button>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white">Your reports</h2>
        {reports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No research purchased yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {reports.map((report) => {
              const group = industry.customerGroups.find((g) => g.id === report.targetGroupId)
              return (
                <div key={report.id} className={cn('glass rounded-2xl p-4', report.id === justPurchasedId && 'border-emerald-300/30 bg-emerald-400/[0.04]')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white capitalize">{report.level} research · {group?.label ?? 'General'}</p>
                    {report.id === justPurchasedId && <span className="flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="size-3.5" />Just purchased</span>}
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                    <Row label="Estimated demand" value={`~${report.estimatedDemandUnits.toLocaleString()} units/yr`} />
                    <Row label="Recommended price range" value={`${formatCurrency(report.priceRangeLow)} – ${formatCurrency(report.priceRangeHigh)}`} />
                    <Row label="Desired quality" value={report.desiredQuality} className="capitalize" />
                    <Row label="Market size estimate" value={`~${report.marketSizeEstimate.toLocaleString()} customers`} />
                    <Row label="Competition level" value={report.competitionLevel} className="capitalize" />
                    <Row label="Accuracy" value={`${Math.round(report.accuracy * 100)}%`} />
                  </dl>
                  <p className="mt-3 text-xs text-slate-400"><span className="text-slate-500">Trend:</span> {report.trend}</p>
                  <p className="mt-1 text-xs text-slate-400"><span className="text-slate-500">Popular features:</span> {report.popularFeatures.join(', ')}</p>
                  {report.competitorPrices.length > 0 && (
                    <p className="mt-1 text-xs text-slate-400"><span className="text-slate-500">Competitor prices:</span> {report.competitorPrices.map((c) => `${c.competitorName} ${formatCurrency(c.price)}`).join(', ')}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <span className="flex items-center gap-1 text-slate-500">{label}<InfoTip term={label} /></span>
      <span className={cn('font-medium text-white', className)}>{value}</span>
    </div>
  )
}
