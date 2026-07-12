'use client'

import {
  Bot,
  CalendarClock,
  Check,
  CreditCard,
  Crown,
  Gem,
  Sparkles,
  X,
} from 'lucide-react'
import { formatPlanExpiry, PLAN_DETAILS, type NexusPlan } from '@/lib/plans'
import type { NexusTransaction } from '@/lib/nexus-points'
import { avatarGradientFor, COSMETIC_CATALOG, DEFAULT_AVATAR_GRADIENT, type CosmeticCategory } from '@/lib/cosmetics'
import { cn } from '@/lib/utils'

type MarketplacePageProps = {
  currentPlan: NexusPlan
  nexusPoints: number
  planExpiry: string | null
  redeemedRewards: string[]
  equippedAvatar: string | null
  equippedBadge: string | null
  transactions: NexusTransaction[]
  onSelectFree: () => void
  onPayWithCard: (plan: Exclude<NexusPlan, 'Free'>) => void
  onPayWithPoints: (plan: Exclude<NexusPlan, 'Free'>) => void
  onRedeem: (reward: { id: string; name: string; cost: number }) => void
  onEquip: (category: CosmeticCategory, id: string | null) => void
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

export function MarketplacePage({
  currentPlan,
  nexusPoints,
  planExpiry,
  redeemedRewards,
  equippedAvatar,
  equippedBadge,
  transactions,
  onSelectFree,
  onPayWithCard,
  onPayWithPoints,
  onRedeem,
  onEquip,
}: MarketplacePageProps) {
  const avatarCosmetics = COSMETIC_CATALOG.filter((item) => item.category === 'avatar')
  const badgeCosmetics = COSMETIC_CATALOG.filter((item) => item.category === 'badge')
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300/80">AirGPT upgrades</p>
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
              <article key={plan.name} className={cn('glass relative flex min-h-full flex-col overflow-hidden rounded-3xl p-5', plan.featured && 'border-white/30 shadow-xl shadow-white/10')}>
                {plan.featured && <span className="absolute right-4 top-4 rounded-full border border-white/25 bg-gradient-to-r from-white/15 to-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">Most popular</span>}
                <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-white/20 to-white/5 text-white">{plan.name === 'Premium' ? <Crown className="size-5" /> : plan.name === 'Plus' ? <Sparkles className="size-5" /> : <Bot className="size-5" />}</div>
                <div className="mt-5 flex items-center gap-2">
                  <h4 className="text-xl font-semibold">{plan.name.toUpperCase()}</h4>
                  {isCurrent && <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">Current</span>}
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-white">{PLAN_DETAILS[plan.name].price}</p>
                <p className="mt-1 text-xs font-medium text-white">
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

      <section aria-labelledby="cosmetics-heading">
        <div className="glass mb-5 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 id="cosmetics-heading" className="text-lg font-semibold">Cosmetics</h3><p className="mt-1 text-xs text-slate-500">Unlock avatar colors and profile badges earned through focused learning.</p></div>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-white"><Gem className="size-4" /><span className="font-semibold">{nexusPoints.toLocaleString()} Points</span></div>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Avatar colors</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="glass flex flex-col rounded-2xl p-4">
            <span className={cn('flex size-12 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white', DEFAULT_AVATAR_GRADIENT)}>AN</span>
            <h4 className="mt-4 text-sm font-semibold">Default</h4>
            <p className="mt-1 text-xs text-zinc-500">The original avatar color.</p>
            <button type="button" disabled={!equippedAvatar} onClick={() => onEquip('avatar', null)} className="secondary-action mt-4 w-full px-3 text-xs">{!equippedAvatar ? 'Equipped' : 'Equip'}</button>
          </article>
          {avatarCosmetics.map((item) => {
            const owned = redeemedRewards.includes(item.id)
            const equipped = equippedAvatar === item.id
            const affordable = nexusPoints >= item.cost
            return (
              <article key={item.id} className="glass flex flex-col rounded-2xl p-4">
                <span className={cn('flex size-12 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white', avatarGradientFor(item.id))}>AN</span>
                <h4 className="mt-4 text-sm font-semibold">{item.name}</h4>
                <p className="mt-1 text-xs text-zinc-500">{item.description}</p>
                {!owned && <p className="mt-1 text-xs font-medium text-zinc-300">{item.cost.toLocaleString()} Points</p>}
                <button
                  type="button"
                  disabled={equipped || (!owned && !affordable)}
                  onClick={() => owned ? onEquip('avatar', item.id) : onRedeem(item)}
                  className="secondary-action mt-4 w-full px-3 text-xs"
                >
                  {equipped ? 'Equipped' : owned ? 'Equip' : affordable ? 'Redeem' : 'Not enough points'}
                </button>
              </article>
            )
          })}
        </div>

        <p className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Profile badges</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="glass flex flex-col rounded-2xl p-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-white/10 text-slate-500"><X className="size-5" /></span>
            <h4 className="mt-4 text-sm font-semibold">None</h4>
            <p className="mt-1 text-xs text-zinc-500">No badge shown next to your name.</p>
            <button type="button" disabled={!equippedBadge} onClick={() => onEquip('badge', null)} className="secondary-action mt-4 w-full px-3 text-xs">{!equippedBadge ? 'Equipped' : 'Equip'}</button>
          </article>
          {badgeCosmetics.map((item) => {
            const owned = redeemedRewards.includes(item.id)
            const equipped = equippedBadge === item.id
            const affordable = nexusPoints >= item.cost
            return (
              <article key={item.id} className="glass flex flex-col rounded-2xl p-4">
                <span className={cn('inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', item.badgeClassName)}>{item.badgeLabel}</span>
                <h4 className="mt-4 text-sm font-semibold">{item.name}</h4>
                <p className="mt-1 text-xs text-zinc-500">{item.description}</p>
                {!owned && <p className="mt-1 text-xs font-medium text-zinc-300">{item.cost.toLocaleString()} Points</p>}
                <button
                  type="button"
                  disabled={equipped || (!owned && !affordable)}
                  onClick={() => owned ? onEquip('badge', item.id) : onRedeem(item)}
                  className="secondary-action mt-4 w-full px-3 text-xs"
                >
                  {equipped ? 'Equipped' : owned ? 'Equip' : affordable ? 'Redeem' : 'Not enough points'}
                </button>
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
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', transaction.kind === 'earned' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/10 text-white')}><Gem className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{transaction.description}</p><p className="mt-0.5 text-[10px] text-slate-600">{new Date(transaction.createdAt).toLocaleString()}</p></div>
                  <span className={cn('text-sm font-semibold', transaction.kind === 'earned' ? 'text-emerald-300' : 'text-white')}>{transaction.kind === 'earned' ? '+' : '−'}{transaction.amount.toLocaleString()}</span>
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
  return <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"><Icon className="size-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div></div>
}

function Feature({ label, included = false }: { label: string; included?: boolean }) {
  return <div className={cn('flex items-center gap-2 text-xs', included ? 'text-slate-300' : 'text-slate-600')}>{included ? <Check className="size-3.5 shrink-0 text-emerald-300" /> : <X className="size-3.5 shrink-0" />}<span>{label}</span></div>
}