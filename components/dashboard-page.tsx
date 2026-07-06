'use client'

import {
  BarChart3, BookOpenCheck, Bot, Calculator, CalendarDays, CheckCircle2, ClipboardList, Clock3, Compass,
  Flame, GraduationCap, Headphones, Layers3, ListChecks, LockKeyhole,
  MessageSquareText, Mic2, Plug, Sparkles, Store, Trophy, Volume2, WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import type { NexusPlan } from '@/lib/plans'
import { cn } from '@/lib/utils'

type DashboardPageProps = {
  plan: NexusPlan
  streakRewardClaimed: boolean
  onClaimStreakReward: () => void
  onNavigate: (section: string) => void
  onRequestUpgrade: (feature: string, requiredPlan: Exclude<NexusPlan, 'Free'>) => void
}

type Feature = {
  name: string
  description: string
  icon: LucideIcon
  requiredPlan: NexusPlan
  destination: string
}

const planRank: Record<NexusPlan, number> = { Free: 0, Plus: 1, Premium: 2 }

const dailyUsage = [
  { day: 'Mon', minutes: 45 }, { day: 'Tue', minutes: 80 }, { day: 'Wed', minutes: 35 },
  { day: 'Thu', minutes: 120 }, { day: 'Fri', minutes: 70 }, { day: 'Sat', minutes: 95 },
  { day: 'Sun', minutes: 60 },
]

const features: Feature[] = [
  { name: 'AI Chat', description: 'Ask questions and build study plans.', icon: MessageSquareText, requiredPlan: 'Free', destination: 'AI Chat' },
  { name: 'AI Study Coach', description: 'Get a proactive daily plan from your real progress.', icon: Compass, requiredPlan: 'Free', destination: 'Study Coach' },
  { name: 'Voice Chat', description: 'Turn spoken questions into prompts.', icon: Mic2, requiredPlan: 'Plus', destination: 'AI Chat' },
  { name: 'Text-to-Speech', description: 'Listen to AI answers with Orpheus.', icon: Volume2, requiredPlan: 'Plus', destination: 'AI Chat' },
  { name: 'Tasks', description: 'Plan assignments and daily actions.', icon: ListChecks, requiredPlan: 'Free', destination: 'Tasks' },
  { name: 'Assignment Workspace', description: 'Plan, draft, improve, and review one assignment.', icon: ClipboardList, requiredPlan: 'Free', destination: 'Assignment Workspace' },
  { name: 'Calendar', description: 'Track study sessions and deadlines.', icon: CalendarDays, requiredPlan: 'Free', destination: 'Calendar' },
  { name: 'Analytics', description: 'Understand weekly study performance.', icon: BarChart3, requiredPlan: 'Plus', destination: 'Analytics' },
  { name: 'Leaderboard', description: 'Compare school-safe Nexus rankings.', icon: Trophy, requiredPlan: 'Free', destination: 'Leaderboard' },
  { name: 'Marketplace', description: 'Unlock plans, themes, and rewards.', icon: Store, requiredPlan: 'Free', destination: 'Marketplace' },
  { name: 'Integrations', description: 'Connect premium study services.', icon: Plug, requiredPlan: 'Premium', destination: 'Integrations' },
  { name: 'AI Flashcards', description: 'Create revision cards from notes.', icon: Layers3, requiredPlan: 'Plus', destination: 'Flashcards' },
  { name: 'AI Summaries', description: 'Condense notes into key ideas.', icon: Sparkles, requiredPlan: 'Plus', destination: 'AI Chat' },
  { name: 'AI Exam Generator', description: 'Generate targeted practice exams.', icon: BookOpenCheck, requiredPlan: 'Premium', destination: 'AI Chat' },
  { name: 'Smart Study Planner', description: 'Build an adaptive study schedule.', icon: WandSparkles, requiredPlan: 'Plus', destination: 'AI Chat' },
  { name: 'Premium Tutor', description: 'Get guided, personalised tutoring.', icon: GraduationCap, requiredPlan: 'Premium', destination: 'AI Tutor' },
  { name: 'Mock Interviews', description: 'Practise interviews with feedback.', icon: Headphones, requiredPlan: 'Premium', destination: 'AI Chat' },
  { name: 'Advanced Analytics', description: 'Explore deeper learning patterns.', icon: BarChart3, requiredPlan: 'Premium', destination: 'Analytics' },
  { name: 'Premium Integrations', description: 'Unlock the full integration suite.', icon: Plug, requiredPlan: 'Premium', destination: 'Integrations' },
  { name: 'Priority AI', description: 'Use the priority response queue.', icon: Bot, requiredPlan: 'Premium', destination: 'AI Chat' },
  { name: 'Grade Calculator', description: 'Calculate weighted assessment grades.', icon: Calculator, requiredPlan: 'Free', destination: 'Calculators' },
  { name: 'ATAR Calculator', description: 'Estimate a VCE-style ATAR range.', icon: Calculator, requiredPlan: 'Plus', destination: 'Calculators' },
  { name: 'Graphing Calculator', description: 'Plot multiple mathematical functions.', icon: Calculator, requiredPlan: 'Premium', destination: 'Calculators' },
]

const streakRewards = [
  { days: 3, points: 50 }, { days: 7, points: 150 },
  { days: 14, points: 400 }, { days: 30, points: 1000 },
]

export function DashboardPage({ plan, streakRewardClaimed, onClaimStreakReward, onNavigate, onRequestUpgrade }: DashboardPageProps) {
  const totalMinutes = dailyUsage.reduce((total, day) => total + day.minutes, 0)
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Good afternoon, Parth. Here is your learning momentum.</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Dashboard overview</h2>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="usage-time-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Activity</p><h3 id="usage-time-title" className="mt-1 text-xl font-semibold">Usage Time</h3></div>
            <div className="rounded-2xl border border-orange-300/15 bg-orange-400/[0.06] px-4 py-2 text-right"><p className="text-[10px] uppercase tracking-wider text-slate-500">This week</p><p className="text-lg font-semibold text-orange-100">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</p></div>
          </div>
          <div className="mt-6 flex h-48 items-end gap-2 sm:gap-4" role="img" aria-label="Daily usage from Monday to Sunday">
            {dailyUsage.map((day) => (
              <div key={day.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-medium text-orange-200">{day.minutes}m</span>
                <div className="relative flex h-[132px] w-full max-w-12 items-end overflow-hidden rounded-xl bg-white/[0.045]"><div className="w-full rounded-xl bg-gradient-to-t from-orange-600 to-orange-300 shadow-[0_0_24px_rgba(34,211,238,0.18)]" style={{ height: Math.max(12, day.minutes / 1.2) + '%' }} /></div>
                <span className="text-[10px] text-slate-500">{day.day}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UsageMetric icon={Clock3} label="Today’s AI usage" value="60 min" />
            <UsageMetric icon={MessageSquareText} label="AI messages sent" value="86" />
            <UsageMetric icon={Mic2} label="Voice minutes" value="42 min" />
            <UsageMetric icon={CheckCircle2} label="Tasks completed" value="18" />
          </div>
          <p className="mt-4 text-xs text-slate-500">Total study minutes: <span className="font-semibold text-slate-300">{totalMinutes}</span></p>
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="streak-title">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Learning streak</p><h3 id="streak-title" className="mt-1 text-xl font-semibold">Keep going</h3></div><span className="flex size-12 items-center justify-center rounded-2xl bg-orange-400/12 text-orange-300"><Flame className="size-6" /></span></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/[0.045] p-4"><p className="text-3xl font-bold text-white">7</p><p className="mt-1 text-xs text-slate-500">Current streak</p></div><div className="rounded-2xl bg-white/[0.045] p-4"><p className="text-3xl font-bold text-white">21</p><p className="mt-1 text-xs text-slate-500">Longest streak</p></div></div>
          <div className="mt-5 flex justify-between" aria-label="Seven active study days this week">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={day + index} className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 text-[10px] font-bold text-slate-950 shadow-lg shadow-orange-500/15">{day}</span>)}</div>
          <p className="mt-5 text-sm leading-relaxed text-slate-300">You showed up every day this week. One focused session today keeps the streak alive.</p>
          <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-3"><p className="text-xs font-semibold text-amber-100">7-day reward · +150 Nexus Points</p><button type="button" onClick={onClaimStreakReward} disabled={streakRewardClaimed} className="secondary-action mt-3 w-full text-xs">{streakRewardClaimed ? 'Reward claimed' : 'Claim reward'}</button></div>
          <div className="mt-4 grid grid-cols-2 gap-2">{streakRewards.map((reward) => <div key={reward.days} className={cn('rounded-xl border px-3 py-2 text-[10px]', reward.days <= 7 ? 'border-orange-300/15 bg-orange-400/[0.06] text-orange-100' : 'border-white/8 bg-white/[0.025] text-slate-500')}><span className="font-semibold">{reward.days} days</span><span className="float-right">+{reward.points}</span></div>)}</div>
        </section>
      </div>

      <section aria-labelledby="your-features-title">
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Plan access</p><h3 id="your-features-title" className="mt-1 text-xl font-semibold">Your Features</h3></div><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{plan} plan</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const available = planRank[plan] >= planRank[feature.requiredPlan]
            const Icon = feature.icon
            return (
              <article key={feature.name} className={cn('glass flex min-h-44 flex-col rounded-2xl p-4 transition', available ? 'hover:border-orange-300/20 hover:bg-white/[0.065]' : 'opacity-85')}>
                <div className="flex items-start justify-between gap-3"><span className={cn('flex size-10 items-center justify-center rounded-xl', available ? 'bg-orange-400/10 text-orange-200' : 'bg-white/5 text-slate-500')}>{available ? <Icon className="size-5" /> : <LockKeyhole className="size-5" />}</span><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider', available ? 'bg-emerald-400/10 text-emerald-200' : feature.requiredPlan === 'Plus' ? 'bg-orange-400/10 text-orange-200' : 'bg-amber-400/10 text-amber-200')}>{available ? 'Available' : feature.requiredPlan}</span></div>
                <h4 className="mt-4 text-sm font-semibold text-white">{feature.name}</h4><p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{feature.description}</p>
                <button type="button" onClick={() => available ? onNavigate(feature.destination) : onRequestUpgrade(feature.name, feature.requiredPlan as Exclude<NexusPlan, 'Free'>)} className={cn('mt-4 w-full rounded-xl px-3 py-2 text-xs font-semibold transition', available ? 'bg-white/7 text-white hover:bg-white/12' : 'border border-white/10 text-slate-400 hover:border-orange-300/25 hover:text-orange-100')}>{available ? 'Open' : 'Upgrade'}</button>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function UsageMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3"><Icon className="size-4 text-orange-300" /><p className="mt-3 text-lg font-semibold text-white">{value}</p><p className="mt-1 text-[10px] text-slate-500">{label}</p></div>
}
