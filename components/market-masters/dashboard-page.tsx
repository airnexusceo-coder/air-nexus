'use client'

import { BookOpen, CheckCircle2, Circle, FileBarChart, GraduationCap, Newspaper, Sparkles, Store, Target, Trophy } from 'lucide-react'
import { MarketStatusIndicator } from '@/components/market-masters/market-status-indicator'
import { TermTooltip } from '@/components/market-masters/term-tooltip'
import { getDailyChallengeTask } from '@/lib/market-masters/daily-challenge'
import { formatCurrency, formatPercent, formatSignedCurrency } from '@/lib/market-masters/format'
import { LESSONS } from '@/lib/market-masters/lessons'
import {
  computeDividendsReceived,
  computeEducationalRewardsEarned,
  computeHoldingsValue,
  computePortfolioValue,
  computeProfitLoss,
  computeRealizedProfitLoss,
  computeTotalInvested,
  computeUnrealizedProfitLoss,
} from '@/lib/market-masters/market-engine'
import { MISSION_DEFINITIONS } from '@/lib/market-masters/missions'
import type { GameState, MarketStatus } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

type ViewId = 'dashboard' | 'market' | 'portfolio' | 'watchlist' | 'news' | 'learn' | 'missions' | 'achievements' | 'settings'

type DashboardPageProps = {
  state: GameState
  day: number
  simulatedDate: string
  secondsRemaining: number
  marketStatus: MarketStatus
  onNavigate: (view: ViewId) => void
  onContinueLearning: (lessonId: string | null) => void
  onOpenReport: () => void
}

export function DashboardPage({ state, day, simulatedDate, secondsRemaining, marketStatus, onNavigate, onContinueLearning, onOpenReport }: DashboardPageProps) {
  const cash = state.cash
  const holdingsValue = computeHoldingsValue(state)
  const portfolioValue = computePortfolioValue(state)
  const totalInvested = computeTotalInvested(state)
  const realized = computeRealizedProfitLoss(state)
  const unrealized = computeUnrealizedProfitLoss(state)
  const dividends = computeDividendsReceived(state)
  const rewards = computeEducationalRewardsEarned(state)
  const profitLoss = computeProfitLoss(state)

  const nextLesson = LESSONS.find((lesson) => !state.completedLessonIds.includes(lesson.id)) ?? null
  const lessonsDone = state.completedLessonIds.length
  const latestQuizScore = state.quizScores.length > 0 ? state.quizScores[state.quizScores.length - 1] : null
  const missionsDone = state.completedMissionIds.length
  const dailyTask = state.dailyChallenge ? getDailyChallengeTask(state.dailyChallenge.taskId) : null
  const recentNews = [...state.news].reverse().slice(0, 2)

  return (
    <div className="space-y-5">
      <MarketStatusIndicator day={day} simulatedDate={simulatedDate} secondsRemaining={secondsRemaining} status={marketStatus} />

      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Your full financial picture — cash and share value are always tracked separately.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available cash" value={formatCurrency(cash)} tooltip="Virtual money you have not invested. Only changes when you buy, sell, receive a dividend, or claim a reward." />
        <StatCard label="Value of owned shares" value={formatCurrency(holdingsValue)} tooltip="What your current holdings are worth at today's prices. Rises and falls with the market — this is not cash you can spend until you sell." />
        <StatCard label="Total portfolio value" value={formatCurrency(portfolioValue)} tone="strong" tooltip="Available cash plus the current value of your shares." />
        <StatCard label="Total invested" value={formatCurrency(totalInvested)} tooltip="The cost you originally paid for the shares you currently own." />
        <StatCard
          label="Realised profit/loss"
          value={formatSignedCurrency(realized)}
          tone={realized >= 0 ? 'positive' : 'negative'}
          tooltip="Profit or loss that is already locked in from shares you have sold."
        />
        <StatCard
          label="Unrealised profit/loss"
          value={`${formatSignedCurrency(unrealized.value)} (${formatPercent(unrealized.percent)})`}
          tone={unrealized.value >= 0 ? 'positive' : 'negative'}
          tooltip="Paper profit or loss on shares you still own. It only becomes real money once you sell — the price can still move before then."
        />
        <StatCard label="Dividends received" value={formatCurrency(dividends)} tooltip="Total cash paid to you by companies you hold, separate from any change in share price." />
        <StatCard label="Educational rewards earned" value={formatCurrency(rewards)} tooltip="Cash earned from completing lessons, missions, and daily challenges — never from prices moving or time passing." />
      </div>

      <div className="glass rounded-2xl p-4 text-sm text-slate-300">
        Total return since you started: <span className={cn('font-semibold', profitLoss.value >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{formatSignedCurrency(profitLoss.value)} ({formatPercent(profitLoss.percent)})</span>
        <TermTooltip term="Return" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><GraduationCap className="size-4 text-cyan-300" />Learning</h2>
          <p className="mt-2 text-xs text-slate-400">{lessonsDone}/{LESSONS.length} lessons complete</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-cyan-100" style={{ width: `${LESSONS.length > 0 ? (lessonsDone / LESSONS.length) * 100 : 0}%` }} />
          </div>
          {latestQuizScore && (
            <p className="mt-3 text-xs text-slate-400">Last quiz score: <span className="font-medium text-white">{latestQuizScore.correct}/{latestQuizScore.total}</span> on &ldquo;{latestQuizScore.lessonTitle}&rdquo;</p>
          )}
          {nextLesson ? (
            <>
              <p className="mt-3 text-sm text-white">Next recommended lesson: <span className="font-semibold">{nextLesson.title}</span></p>
              <button type="button" onClick={() => onContinueLearning(nextLesson.id)} className="primary-action mt-3 w-full">
                <BookOpen className="size-4" />Continue Learning
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-emerald-200">All lessons complete — revisit any of them anytime from the Learn tab.</p>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Today&apos;s challenge</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{dailyTask?.title ?? 'Daily challenge'}</h2>
              <p className="mt-1 text-xs text-slate-400">{dailyTask?.description}</p>
            </div>
            {state.dailyChallenge?.completed ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200"><CheckCircle2 className="size-3.5" />Done</span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-300"><Circle className="size-3.5" />+{dailyTask?.xpReward ?? 0} XP</span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => onNavigate('market')} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center transition hover:bg-white/5">
              <Store className="size-4 text-emerald-300" />
              <span className="text-[10px] text-slate-300">Market</span>
            </button>
            <button type="button" onClick={() => onNavigate('missions')} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center transition hover:bg-white/5">
              <Target className="size-4 text-amber-300" />
              <span className="text-[10px] text-slate-300">{missionsDone}/{MISSION_DEFINITIONS.length} missions</span>
            </button>
            <button type="button" onClick={() => onNavigate('achievements')} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center transition hover:bg-white/5">
              <Trophy className="size-4 text-amber-200" />
              <span className="text-[10px] text-slate-300">{state.unlockedAchievementIds.length} badges</span>
            </button>
            <button type="button" onClick={onOpenReport} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center transition hover:bg-white/5">
              <FileBarChart className="size-4 text-cyan-300" />
              <span className="text-[10px] text-slate-300">Full report</span>
            </button>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Newspaper className="size-4 text-slate-400" />Latest news</h2>
        {recentNews.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No news yet — the market updates automatically, so check back shortly.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {recentNews.map((item) => <p key={item.id} className="text-xs leading-5 text-slate-300">{item.headline}</p>)}
          </div>
        )}
        <button type="button" onClick={() => onNavigate('news')} className="secondary-action mt-3 w-full text-xs">
          <Sparkles className="size-3.5" />View all news
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, tone, tooltip }: { label: string; value: string; tone?: 'positive' | 'negative' | 'strong'; tooltip: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <TermTooltip term={label} definition={tooltip} />
      </div>
      <p className={cn(
        'mt-2 text-lg font-bold',
        tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : tone === 'strong' ? 'text-white' : 'text-white',
      )}>
        {value}
      </p>
    </div>
  )
}
