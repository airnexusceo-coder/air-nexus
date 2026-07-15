'use client'

import { CheckCircle2, Circle, Sparkles, Target } from 'lucide-react'
import type { Mission } from '@/lib/market-masters/types'
import { cn } from '@/lib/utils'

type MissionsPanelProps = {
  missions: Mission[]
  completedMissionIds: string[]
}

export function MissionsPanel({ missions, completedMissionIds }: MissionsPanelProps) {
  const completedCount = missions.filter((mission) => completedMissionIds.includes(mission.id)).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Target className="size-5 text-slate-400" />Missions</h1>
          <p className="mt-1 text-sm text-slate-400">Goals that reward good investing habits, not just returns.</p>
        </div>
        <span className="text-sm font-semibold text-slate-300">{completedCount}/{missions.length}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-200" style={{ width: `${missions.length > 0 ? (completedCount / missions.length) * 100 : 0}%` }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {missions.map((mission) => {
          const completed = completedMissionIds.includes(mission.id)
          return (
            <div key={mission.id} className={cn('glass flex items-start gap-3 rounded-2xl p-4', completed && 'border-emerald-300/25 bg-emerald-400/[0.04]')}>
              {completed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /> : <Circle className="mt-0.5 size-5 shrink-0 text-slate-600" />}
              <div className="min-w-0">
                <p className={cn('text-sm font-semibold', completed ? 'text-emerald-100' : 'text-white')}>{mission.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{mission.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300"><Sparkles className="size-3.5" />{mission.xpReward} XP</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
