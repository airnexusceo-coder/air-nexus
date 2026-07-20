'use client'

import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { AlertTriangle, ArrowRight, Award, Boxes, BrainCircuit, CalendarCheck2, CheckCircle2, Clock3, GraduationCap, Heart, PiggyBank, ShieldCheck, Star, TrendingUp } from 'lucide-react'
import { InfoTip } from '@/components/business-empire/info-tip'
import type { BusinessEmpireView } from '@/components/business-empire/nav-items'
import { STRATEGIC_INITIATIVES, computeStrategicInitiativeCost, estimateCurrentYearOutcome, getActiveStrategicInitiatives } from '@/lib/business-empire/game-state'
import { formatCurrency, formatSignedCurrency } from '@/lib/business-empire/format'
import { LESSONS } from '@/lib/business-empire/lessons'
import { getReputationLevel } from '@/lib/business-empire/simulation'
import type { GameState, StrategicInitiativeId } from '@/lib/business-empire/types'
import { cn } from '@/lib/utils'

type DashboardPageProps = {
  state: GameState
  onNavigate: (view: BusinessEmpireView) => void
  onOpenCompleteYear: () => void
  onLaunchInitiative: (initiativeId: StrategicInitiativeId) => { error?: string }
}

export function DashboardPage({ state, onNavigate, onOpenCompleteYear, onLaunchInitiative }: DashboardPageProps) {
  const estimate = useMemo(() => estimateCurrentYearOutcome(state), [state])
  const activeProducts = state.products.filter((p) => !p.discontinued)
  const unsoldInventoryUnits = state.products.reduce((sum, p) => sum + p.inventory, 0)
  const unsoldInventoryValue = state.products.reduce((sum, p) => sum + p.inventory * p.costPerUnit, 0)

  const warnings: string[] = []
  if (state.cash < 2000 || (estimate.committedExpensesSoFar > 0 && state.cash < estimate.committedExpensesSoFar * 0.2)) warnings.push('Cash is running low — review your spending before making more commitments this year.')
  if (activeProducts.length === 0) warnings.push('You have no active products yet — create one to start earning revenue.')
  if (unsoldInventoryUnits > 0) warnings.push(`You are carrying ${unsoldInventoryUnits.toLocaleString()} unsold units — decide what to do with them in Products.`)
  if (state.customerSatisfaction < 45) warnings.push('Customer satisfaction is low — check whether your prices match your product quality.')
  if (state.brandReputation < 40) warnings.push('Reputation is weak — this is hurting demand, advertising effectiveness, and loan approval. Check the Reputation page to see exactly why.')
  if (state.loans.length > 0) warnings.push(`You have ${state.loans.length} active loan(s) — repayments are deducted automatically each year.`)

  const nextAction = activeProducts.length === 0
    ? { label: 'Create your first product', view: 'products' as const }
    : state.researchReports.length === 0
      ? { label: 'Buy market research before pricing decisions', view: 'research' as const }
      : { label: 'Review pricing and demand', view: 'pricing' as const }

  const nextLesson = LESSONS.find((lesson) => !state.completedLessonIds.includes(lesson.id)) ?? null
  const reputationChartData = state.reputationHistory.map((entry, index) => ({ index, value: entry.valueAfter }))
  const reputationLevel = getReputationLevel(state.brandReputation)
  const activeInitiatives = getActiveStrategicInitiatives(state)
  const initiativeCards = STRATEGIC_INITIATIVES.map((option) => {
    const cost = computeStrategicInitiativeCost(state, option.id)
    const active = activeInitiatives.some((initiative) => initiative.initiativeId === option.id)
    return { option, cost, active, insufficientCash: cost > state.cash }
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Business Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">Financial Year {state.year} in progress. Numbers below marked &ldquo;estimate&rdquo; are projections — actual results are calculated when you complete the year.</p>
        </div>
        <button type="button" onClick={onOpenCompleteYear} className="primary-action shrink-0">
          <CalendarCheck2 className="size-4" />
          Complete Financial Year
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning) => (
            <div key={warning} role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2.5 text-xs leading-5 text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {warning}
            </div>
          ))}
        </div>
      )}


      <section className="glass-glow rounded-2xl p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><BrainCircuit className="size-4 text-amber-300" />Boardroom Decisions</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300">Choose management actions that behave like real business tradeoffs. They cost cash now, stay active for multiple financial years, and feed into demand, reliability, delays, morale, recall risk, or future production cost.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
            <span className="text-slate-500">Active:</span> {activeInitiatives.length}/3
          </div>
        </div>

        {activeInitiatives.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeInitiatives.map((initiative) => {
              const option = STRATEGIC_INITIATIVES.find((entry) => entry.id === initiative.initiativeId)
              if (!option) return null
              return (
                <span key={initiative.id} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                  <Clock3 className="size-3.5" />{option.shortLabel}: {initiative.yearsRemaining} yr left
                </span>
              )
            })}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {initiativeCards.map(({ option, cost, active, insufficientCash }) => (
            <article key={option.id} className={cn('flex flex-col rounded-2xl border p-4 transition', active ? 'border-emerald-300/35 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.03] hover:border-amber-300/35 hover:bg-amber-400/[0.06]')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
                </div>
                {active && <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-hidden="true" />}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">{option.realWorldReason}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {option.effectsSummary.map((effect) => (
                  <span key={effect} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-slate-300">{effect}</span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-400">{formatCurrency(cost)} ? {option.durationYears} yrs</span>
                <button type="button" disabled={active || insufficientCash} onClick={() => onLaunchInitiative(option.id)} className="secondary-action min-h-8 px-3 py-1.5 text-xs disabled:opacity-45">
                  {active ? 'Active' : insufficientCash ? 'Need cash' : 'Launch'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={PiggyBank} label="Available cash" value={formatCurrency(state.cash)} tooltip="Virtual money you can spend right now on research, production, and advertising." />
        <StatCard icon={TrendingUp} label="Projected revenue (estimate)" value={formatCurrency(estimate.projectedRevenue)} tooltip="An estimate of this year's revenue based on today's prices and decisions. The real figure is set when you complete the year." />
        <StatCard icon={Boxes} label="Committed expenses so far" value={formatCurrency(estimate.committedExpensesSoFar)} tooltip="Research, advertising, and production spending already paid this year." />
        <StatCard
          icon={ShieldCheck}
          label="Estimated profit or loss"
          value={formatSignedCurrency(estimate.estimatedProfitOrLoss)}
          tone={estimate.estimatedProfitOrLoss >= 0 ? 'positive' : 'negative'}
          tooltip="Projected revenue minus committed expenses, projected wages, and projected rent — an estimate, not a guarantee."
        />
        <StatCard icon={Award} label="Company value" value={formatCurrency(state.companyValue)} tooltip="An overall estimate of what the business is worth: cash, unsold inventory, market share, and reputation." />
        <StatCard icon={TrendingUp} label="Market share" value={`${state.marketShare.toFixed(1)}%`} tooltip="Your percentage of the total customers in your industry." />
        <StatCard icon={Heart} label="Customer satisfaction" value={`${state.customerSatisfaction}/100`} tone={state.customerSatisfaction >= 60 ? 'positive' : state.customerSatisfaction < 45 ? 'negative' : undefined} tooltip="How happy customers are with what they got for the price they paid." />
        <StatCard icon={ShieldCheck} label="Brand reputation" value={`${state.brandReputation}/100`} tone={state.brandReputation >= 60 ? 'positive' : state.brandReputation < 40 ? 'negative' : undefined} tooltip="How well-regarded your company is overall, built up over time." />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Star className="size-4 text-amber-300" />Reputation</h2>
            <span className="text-xs font-semibold text-amber-200">{reputationLevel}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">{state.brandReputation}/100 — affects demand, advertising, staff morale, and loan approval.</p>
          {reputationChartData.length > 1 && (
            <div className="mt-2 h-12 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reputationChartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <Line type="monotone" dataKey="value" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <button type="button" onClick={() => onNavigate('reputation')} className="secondary-action mt-3 w-full text-xs">
            View reputation history <ArrowRight className="size-3.5" />
          </button>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white">Products</h2>
          <p className="mt-1 text-xs text-slate-400">{activeProducts.length} active · {state.products.length - activeProducts.length} discontinued</p>
          {unsoldInventoryUnits > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-200">
              <Boxes className="size-3.5" />
              {unsoldInventoryUnits.toLocaleString()} unsold units on hand (worth about {formatCurrency(unsoldInventoryValue)} at cost)
            </p>
          )}
          <button type="button" onClick={() => onNavigate('products')} className="secondary-action mt-3 w-full text-xs">
            Manage products <ArrowRight className="size-3.5" />
          </button>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><GraduationCap className="size-4 text-amber-300" />Learning</h2>
          <p className="mt-2 text-xs text-slate-400">{state.completedLessonIds.length}/{LESSONS.length} lessons complete</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-100" style={{ width: `${LESSONS.length > 0 ? (state.completedLessonIds.length / LESSONS.length) * 100 : 0}%` }} />
          </div>
          {nextLesson ? (
            <>
              <p className="mt-3 text-sm text-white">Next recommended lesson: <span className="font-semibold">{nextLesson.title}</span></p>
              <button type="button" onClick={() => onNavigate('learn')} className="primary-action mt-3 w-full">Continue Learning</button>
            </>
          ) : (
            <p className="mt-3 text-sm text-emerald-200">All lessons complete — revisit any of them anytime.</p>
          )}
        </div>
      </div>

      <div className={cn('flex items-center gap-3 rounded-2xl border p-4', 'border-amber-300/20 bg-amber-400/[0.06]')}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200"><ArrowRight className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-amber-200/80">Next recommended action</p>
          <p className="text-sm font-medium text-white">{nextAction.label}</p>
        </div>
        <button type="button" onClick={() => onNavigate(nextAction.view)} className="secondary-action shrink-0 text-xs">Go</button>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone, tooltip }: { icon: typeof PiggyBank; label: string; value: string; tone?: 'positive' | 'negative'; tooltip: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-amber-300/80" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <InfoTip term={label} definition={tooltip} />
      </div>
      <p className={cn('mt-2 text-lg font-bold', tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : 'text-white')}>{value}</p>
    </div>
  )
}
