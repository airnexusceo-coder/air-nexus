'use client'

import {
  BadgeCheck,
  BookOpenCheck,
  Bot,
  CalendarClock,
  Check,
  CreditCard,
  Crown,
  Gem,
  Palette,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react'
import { formatPlanExpiry, PLAN_DETAILS, type NexusPlan } from '@/lib/plans'
import type { NexusTransaction } from '@/lib/nexus-points'
import { cn } from '@/lib/utils'

type MarketplacePageProps = {
  currentPlan: NexusPlan
  nexusPoints: number
  planExpiry: string | null
  redeemedRewards: string[]
  transactions: NexusTransaction[]
  onSelectFree: () => void
  onPayWithCard: (plan: Exclude<NexusPlan, 'Free'>) => void
  onPayWithPoints: (plan: Exclude<NexusPlan, 'Free'>) => void
  onRedeem: (reward: { id: string; name: string; cost: number }) => void
}

const plans: Array<{
  name: NexusPlan
  featured?: boolean
  features: string[]
  locked: string[]
}> = [
  {
    name: 'Free',
    features: ['Basic AI Chat', '20 AI messages/day', 'Basic Tasks', 'Calendar', 'Standard Notes', 'Community Access'],
    locked: ['Unlimited AI', 'Premium Analytics', 'AI Exam Generator', 'Advanced Integrations', 'Priority Responses', 'Smart Study Plans'],
  },
  {
    name: 'Plus',
    featured: true,
    features: ['Unlimited AI Chat', 'Premium Tasks', 'Full Analytics', 'Smart Study Planner', 'AI Flashcards', 'AI Summaries', 'Faster Responses'],
    locked: ['Premium Tutor', 'AI Mock Interviews', 'Enterprise Integrations'],
  },
  {
    name: 'Premium',
    features: ['Everything in Plus', 'Personal AI Tutor', 'Unlimited AI Generation', 'AI Mock Exams', 'AI Interview Coach', 'Advanced Analytics', 'Premium Integrations', 'Priority Queue', 'Early Feature Access'],
    locked: [],
  },
]

const rewards = [
  { id: 'theme', name: 'AI Theme', cost: 250, icon: Palette, color: 'from-orange-400/20 to-orange-500/20' },
  { id: 'avatar', name: 'Premium Avatar', cost: 400, icon: Star, color: 'from-amber-400/20 to-fuchsia-500/20' },
  { id: 'exam-pack', name: 'Exam Pack', cost: 600, icon: BookOpenCheck, color: 'from-amber-400/20 to-orange-500/20' },
  { id: 'booster', name: 'Study Booster', cost: 1000, icon: Zap, color: 'from-orange-400/20 to-orange-500/20' },
  { id: 'badge', name: 'Exclusive Badge', cost: 1500, icon: BadgeCheck, color: 'from-emerald-400/20 to-teal-500/20' },
]

export function MarketplacePage({
  currentPlan,
  nexusPoints,
  planExpiry,
  redeemedRewards,
  transactions,
  onSelectFree,
  onPayWithCard,
  onPayWithPoints,
  onRedeem,
}: MarketplacePageProps) {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300/80">AirGPT upgrades</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">Marketplace</h2>
        <p className="mt-2 text-sm text-slate-400">Upgrade your learning experience with Nexus Plans.</p>
      </div>

      <section className="glass grid gap-4 rounded-2xl p-5 sm:grid-cols-3" aria-label="Account plan summary">
        <SummaryItem icon={Crown} label="Current plan" value={currentPlan} />
        <SummaryItem icon={Gem} label="Nexus Points" value={nexusPoints.toLocaleString()} />
        <SummaryItem icon={CalendarClock} label="Plan expiry" value={formatPlanExpiry(planExpiry)} />
      </section>

      <section aria-labelledby="plans-heading">
        <div className="mb-5">
          <h3 id="plans-heading" className="text-lg font-semibold">Choose your plan</h3>
          <p className="mt-1 text-xs text-slate-500">Pay by card or use earned Nexus Points for one month of access.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.name
            const paidPlan = plan.name === 'Free' ? null : plan.name
            return (
              <article key={plan.name} className={cn('glass relative flex min-h-full flex-col overflow-hidden rounded-3xl p-5', plan.featured && 'border-orange-300/30 shadow-xl shadow-orange-500/10')}>
                {plan.featured && <span className="absolute right-4 top-4 rounded-full bg-orange-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-200">Most popular</span>}
                <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400/20 to-orange-300/10 text-orange-200">{plan.name === 'Premium' ? <Crown className="size-5" /> : plan.name === 'Plus' ? <Sparkles className="size-5" /> : <Bot className="size-5" />}</div>
                <div className="mt-5 flex items-center gap-2">
                  <h4 className="text-xl font-semibold">{plan.name.toUpperCase()}</h4>
                  {isCurrent && <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">Current</span>}
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-white">{PLAN_DETAILS[plan.name].price}</p>
                <p className="mt-1 text-xs font-medium text-amber-200">
                  {PLAN_DETAILS[plan.name].points.toLocaleString()} Nexus Points{paidPlan ? '/month' : ''}
                </p>
                {paidPlan && <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">Pay either way for 30 days</p>}
                <p className="mt-3 text-xs text-slate-500">{PLAN_DETAILS[plan.name].summary}</p>
                <div className="mt-5 space-y-2.5">
                  {plan.features.map((feature) => <Feature key={feature} label={feature} included />)}
                  {plan.locked.map((feature) => <Feature key={feature} label={feature} />)}
                </div>
                {paidPlan ? (
                  <div className="mt-6 grid gap-2">
                    <button type="button" onClick={() => onPayWithCard(paidPlan)} className="primary-action w-full"><CreditCard className="size-4" />Pay with Card</button>
                    <button type="button" onClick={() => onPayWithPoints(paidPlan)} className="secondary-action w-full"><Gem className="size-4" />Use Nexus Points</button>
                  </div>
                ) : (
                  <button type="button" disabled={isCurrent} onClick={onSelectFree} className="secondary-action mt-6 w-full">
                    {isCurrent ? 'Current Plan' : 'Select Free'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="points-heading">
        <div className="glass mb-5 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 id="points-heading" className="text-lg font-semibold">Spend Nexus Points</h3><p className="mt-1 text-xs text-slate-500">Unlock useful extras earned through focused learning.</p></div>
          <div className="flex items-center gap-2 rounded-xl bg-amber-300/10 px-4 py-2 text-amber-200"><Gem className="size-4" /><span className="font-semibold">{nexusPoints.toLocaleString()} Points</span></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {rewards.map((reward) => {
            const Icon = reward.icon
            const redeemed = redeemedRewards.includes(reward.id)
            const affordable = nexusPoints >= reward.cost
            return (
              <article key={reward.id} className="glass flex flex-col rounded-2xl p-4">
                <span className={cn('flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-orange-100', reward.color)}><Icon className="size-5" /></span>
                <h4 className="mt-4 text-sm font-semibold">{reward.name}</h4>
                <p className="mt-1 text-xs font-medium text-amber-200">{reward.cost.toLocaleString()} Points</p>
                <button type="button" disabled={redeemed || !affordable} onClick={() => onRedeem(reward)} className="secondary-action mt-4 w-full px-3 text-xs">{redeemed ? 'Redeemed' : affordable ? 'Redeem' : 'Not enough points'}</button>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="transactions-heading">
        <div className="mb-4">
          <h3 id="transactions-heading" className="text-lg font-semibold">Nexus Points history</h3>
          <p className="mt-1 text-xs text-slate-500">Earn points from daily logins, completed tasks, streaks, and achievements. Each reward is granted once per eligible action.</p>
        </div>
        <div className="glass overflow-hidden rounded-2xl">
          {transactions.length === 0 ? (
            <div className="p-6 text-center"><Gem className="mx-auto size-6 text-slate-600" /><p className="mt-2 text-sm text-slate-400">No transactions yet</p><p className="mt-1 text-xs text-slate-600">Your earned and redeemed points will appear here.</p></div>
          ) : (
            <div className="divide-y divide-white/5">
              {transactions.slice(0, 20).map((transaction) => (
                <div key={transaction.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', transaction.kind === 'earned' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200')}><Gem className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{transaction.description}</p><p className="mt-0.5 text-[10px] text-slate-600">{new Date(transaction.createdAt).toLocaleString()}</p></div>
                  <span className={cn('text-sm font-semibold', transaction.kind === 'earned' ? 'text-emerald-300' : 'text-amber-200')}>{transaction.kind === 'earned' ? '+' : '−'}{transaction.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function SummaryItem({ icon: Icon, label, value }: { icon: typeof Crown; label: string; value: string }) {
  return <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-400/10 text-orange-200"><Icon className="size-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div></div>
}

function Feature({ label, included = false }: { label: string; included?: boolean }) {
  return <div className={cn('flex items-center gap-2 text-xs', included ? 'text-slate-300' : 'text-slate-600')}>{included ? <Check className="size-3.5 shrink-0 text-emerald-300" /> : <X className="size-3.5 shrink-0" />}<span>{label}</span></div>
}