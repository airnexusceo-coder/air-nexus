'use client'

import { Award, BookOpenCheck, ShieldAlert, TrendingUp } from 'lucide-react'
import { ACHIEVEMENT_DEFINITIONS, type AchievementCategory } from '@/lib/market-masters/achievements'
import { cn } from '@/lib/utils'

const CATEGORY_ICON: Record<AchievementCategory, typeof Award> = {
  trading: TrendingUp,
  learning: BookOpenCheck,
  risk: ShieldAlert,
  progress: Award,
}

type AchievementsPageProps = {
  unlockedAchievementIds: string[]
}

export function AchievementsPage({ unlockedAchievementIds }: AchievementsPageProps) {
  const unlockedCount = unlockedAchievementIds.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Award className="size-5 text-slate-400" />Achievements</h1>
          <p className="mt-1 text-sm text-slate-400">Badges for good habits and milestones, separate from your day-to-day missions.</p>
        </div>
        <span className="text-sm font-semibold text-slate-300">{unlockedCount}/{ACHIEVEMENT_DEFINITIONS.length}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ACHIEVEMENT_DEFINITIONS.map((achievement) => {
          const unlocked = unlockedAchievementIds.includes(achievement.id)
          const Icon = CATEGORY_ICON[achievement.category]
          return (
            <div
              key={achievement.id}
              className={cn(
                'glass flex items-start gap-3 rounded-2xl p-4 transition',
                unlocked ? 'border-amber-300/25 bg-amber-400/[0.04]' : 'opacity-55 grayscale',
              )}
            >
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', unlocked ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-slate-400')}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className={cn('text-sm font-semibold', unlocked ? 'text-amber-100' : 'text-white')}>{achievement.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{achievement.description}</p>
                <span className="mt-2 inline-block text-[10px] uppercase tracking-wide text-slate-500">{unlocked ? 'Unlocked' : 'Locked'} · {achievement.xpReward} XP</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
