'use client'

import { useCallback, useEffect, useState } from 'react'
import { Award } from 'lucide-react'
import type { ApexAchievement } from '@/lib/apex/vault/types'
import { cn } from '@/lib/utils'

/** Server-awarded achievements only — see apex_finalize_breach. Nothing here grants one client-side. */
export function AchievementsPanel() {
  const [achievements, setAchievements] = useState<ApexAchievement[] | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/apex/achievements', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setAchievements(((await response.json()) as { achievements: ApexAchievement[] }).achievements)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  if (!achievements) return null
  const earnedCount = achievements.filter((item) => item.earned).length

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Award className="size-4" /> Achievements</h3>
        <span className="text-xs text-muted-foreground">{earnedCount} / {achievements.length}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {achievements.map((item) => (
          <div key={item.slug} title={item.description} className={cn('flex flex-col items-center gap-1 rounded-xl border p-2 text-center', item.earned ? 'border-white/25 bg-white/10' : 'border-white/8 bg-white/[0.02] opacity-40')}>
            <Award className="size-4 text-white/80" />
            <span className="text-[9px] font-medium leading-tight text-white/80">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
