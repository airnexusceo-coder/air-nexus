'use client'

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  BadgeCheck,
  Brain,
  Check,
  Flame,
  GraduationCap,
  ListChecks,
  LockKeyhole,
  Pencil,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import type { RoomDetail, RoomSummary } from '@/lib/rooms/types'
import {
  createMotivationState,
  getMotivationStats,
  loadMotivationState,
  MOTIVATION_ACHIEVEMENTS,
  MOTIVATION_UPDATED_EVENT,
  updateMotivationGoals,
  type MotivationState,
} from '@/lib/motivation'
import { cn } from '@/lib/utils'
import { colorForUser, initialsFor } from '@/lib/rooms/display'

type MotivationPageProps = {
  userId: string
  profileName: string
  notify: (message: string, tone?: 'success' | 'info' | 'warning') => void
}

const achievementIcons: Record<string, ComponentType<{ className?: string }>> = {
  'first-step': Zap,
  'daily-goal': Target,
  'weekly-goal': BadgeCheck,
  'streak-3': Flame,
  'streak-7': Flame,
  'tasks-5': ListChecks,
  'ai-10': Brain,
  'level-5': GraduationCap,
}

export function MotivationPage({ userId, profileName, notify }: MotivationPageProps) {
  const [state, setState] = useState<MotivationState>(createMotivationState)
  const [editingGoals, setEditingGoals] = useState(false)
  const [dailyGoal, setDailyGoal] = useState(state.dailyGoalXp)
  const [weeklyGoal, setWeeklyGoal] = useState(state.weeklyGoalXp)
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [activeRoom, setActiveRoom] = useState<RoomDetail | null>(null)
  const [memberStats, setMemberStats] = useState<Map<string, { lifetimeXp: number; syncedAt: string | null }>>(new Map())

  useEffect(() => {
    const refresh = (event?: Event) => {
      if (event instanceof CustomEvent && event.detail?.userId !== userId) return
      const next = loadMotivationState(userId)
      setState(next)
      setDailyGoal(next.dailyGoalXp)
      setWeeklyGoal(next.weeklyGoalXp)
    }
    refresh()
    window.addEventListener(MOTIVATION_UPDATED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(MOTIVATION_UPDATED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const response = await fetch('/api/rooms', { credentials: 'include', cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as { rooms: RoomSummary[] }
        setRooms(data.rooms)
        setSelectedRoomId((current) => current ?? data.rooms[0]?.id ?? null)
      })()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!selectedRoomId) { setActiveRoom(null); return }
      void (async () => {
        const response = await fetch(`/api/rooms/${selectedRoomId}`, { credentials: 'include', cache: 'no-store' })
        if (!cancelled && response.ok) setActiveRoom((await response.json()) as RoomDetail)
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [selectedRoomId])

  useEffect(() => {
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!activeRoom) { setMemberStats(new Map()); return }
      const otherMembers = activeRoom.members.filter((member) => member.userId !== userId)
      void (async () => {
        const entries = await Promise.all(otherMembers.map(async (member) => {
          const response = await fetch(`/api/social/profile/${member.userId}`, { credentials: 'include', cache: 'no-store' })
          if (!response.ok) return null
          const data = (await response.json()) as { profile: { lifetimeXp: number; statsSyncedAt: string | null } }
          return [member.userId, { lifetimeXp: data.profile.lifetimeXp, syncedAt: data.profile.statsSyncedAt }] as const
        }))
        if (!cancelled) setMemberStats(new Map(entries.filter((entry): entry is readonly [string, { lifetimeXp: number; syncedAt: string | null }] => entry !== null)))
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [activeRoom, userId])

  const stats = useMemo(() => getMotivationStats(state), [state])
  const unlocked = new Set(stats.unlockedAchievementIds)
  const recentEvents = state.events.slice(0, 5)

  const saveGoals = () => {
    const next = updateMotivationGoals(userId, dailyGoal, weeklyGoal)
    setState(next)
    setEditingGoals(false)
    notify('Study goals updated', 'success')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300/80">Calm progress</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Your momentum</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Small, useful study actions build XP. No endless pop-ups, penalties, or pressure.</p>
        </div>
        <button type="button" onClick={() => setEditingGoals((open) => !open)} className="secondary-action self-start sm:self-auto">
          {editingGoals ? <X className="size-4" /> : <Pencil className="size-4" />}
          {editingGoals ? 'Close' : 'Adjust goals'}
        </button>
      </div>

      {editingGoals && (
        <section className="glass grid gap-4 rounded-2xl p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <GoalInput label="Daily XP goal" value={dailyGoal} min={10} max={500} onChange={setDailyGoal} />
          <GoalInput label="Weekly XP goal" value={weeklyGoal} min={50} max={3000} onChange={setWeeklyGoal} />
          <button type="button" onClick={saveGoals} className="primary-action"><Check className="size-4" />Save goals</button>
        </section>
      )}

      <section className="glass overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_auto]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/12 text-white"><Sparkles className="size-5" /></span>
              <div><p className="text-xs text-slate-500">Current level</p><h3 className="text-2xl font-bold">Level {stats.level}</h3></div>
            </div>
            <p className="mt-5 text-sm text-slate-300"><span className="font-semibold text-white">{state.lifetimeXp.toLocaleString()} XP</span> earned through completed study actions.</p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/8" aria-label={`${Math.round(stats.levelProgress)}% to level ${stats.level + 1}`}>
              <div className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-white transition-[width] duration-700" style={{ width: `${stats.levelProgress}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{stats.levelXp} XP into this level</span><span>{stats.nextLevelXp - stats.levelXp} XP to level {stats.level + 1}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ProgressRing label="Today" value={stats.dailyXp} goal={state.dailyGoalXp} progress={stats.dailyProgress} />
            <ProgressRing label="This week" value={stats.weeklyXp} goal={state.weeklyGoalXp} progress={stats.weeklyProgress} />
            <ProgressRing label="Streak" value={stats.currentStreak} goal={Math.max(7, stats.currentStreak)} progress={Math.min(100, (stats.currentStreak / 7) * 100)} suffix="d" />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="glass rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h3 className="font-semibold">Achievements & badges</h3><p className="mt-1 text-xs leading-5 text-slate-500">Visible enough to encourage you, quiet enough to stay out of the way.</p></div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">{unlocked.size}/{MOTIVATION_ACHIEVEMENTS.length}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {MOTIVATION_ACHIEVEMENTS.map((achievement) => {
              const earned = unlocked.has(achievement.id)
              const Icon = achievementIcons[achievement.id] ?? Trophy
              return (
                <div key={achievement.id} className={cn('flex items-center gap-3 rounded-2xl border p-3.5', earned ? 'border-white/15 bg-white/[0.07]' : 'border-white/7 bg-white/[0.025] opacity-65')}>
                  <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', earned ? 'bg-white/15 text-white' : 'bg-white/6 text-slate-500')}>
                    {earned ? <Icon className="size-4" /> : <LockKeyhole className="size-4" />}
                  </span>
                  <div className="min-w-0"><p className="text-sm font-medium">{achievement.title}</p><p className="mt-0.5 text-xs text-slate-500">{earned ? achievement.badge : achievement.description}</p></div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-semibold">Study streak</h3><p className="mt-1 text-xs text-slate-500">A rest day never removes earned XP.</p></div>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/12 text-white"><Flame className="size-5" /></span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <StatTile label="Current" value={`${stats.currentStreak} days`} />
            <StatTile label="Personal best" value={`${stats.longestStreak} days`} />
          </div>
          <div className="mt-5 border-t border-white/7 pt-5">
            <h4 className="text-sm font-medium">Recent XP</h4>
            {recentEvents.length > 0 ? (
              <div className="mt-3 space-y-3">{recentEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 text-sm">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-200"><Zap className="size-3.5" /></span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">{event.description}</span>
                  <span className="font-medium text-emerald-200">+{event.xp}</span>
                </div>
              ))}</div>
            ) : <p className="mt-3 text-xs leading-5 text-slate-500">Complete a task or finish an AI study turn to begin.</p>}
          </div>
        </section>
      </div>

      <section className="glass overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 border-b border-white/7 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/12 text-white"><Users className="size-4" /></span><div><h3 className="font-semibold">Collaboration room leaderboard</h3><p className="mt-1 text-xs leading-5 text-slate-500">Your score is live on this device. Teammate rankings appear when shared progress sync is connected.</p></div></div>
          {rooms.length > 0 && (
            <select value={selectedRoomId ?? ''} onChange={(event) => setSelectedRoomId(event.target.value)} aria-label="Collaboration room" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-white/40">
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          )}
        </div>
        <div className="divide-y divide-white/6">
          <div className="flex items-center gap-3 bg-white/[0.06] px-5 py-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/12 text-sm font-bold text-white">1</span>
            <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-white to-zinc-300 text-sm font-bold text-black">{profileName.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{profileName} <span className="ml-1 text-xs text-zinc-300">You</span></p><p className="text-xs text-slate-500">Local score</p></div>
            <div className="text-right"><p className="font-semibold text-white">{state.lifetimeXp.toLocaleString()}</p><p className="text-[10px] text-slate-500">XP</p></div>
          </div>
          {activeRoom?.members.filter((member) => member.userId !== userId).map((member) => {
            const stats = memberStats.get(member.userId)
            const synced = stats && stats.syncedAt
            return (
              <div key={member.userId} className="flex items-center gap-3 px-5 py-4 text-slate-400">
                <span className="flex size-8 items-center justify-center text-sm text-slate-600">—</span>
                <span className={cn('flex size-10 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white', colorForUser(member.userId))}>{initialsFor(member.displayName)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-300">{member.displayName}</p>
                  <p className="text-xs text-slate-600">{synced ? 'Self-reported score' : 'Awaiting shared progress'}</p>
                </div>
                {synced ? (
                  <div className="text-right"><p className="font-semibold text-white">{stats.lifetimeXp.toLocaleString()}</p><p className="text-[10px] text-slate-500">XP</p></div>
                ) : (
                  <span className="text-xs text-slate-600">Not synced</span>
                )}
              </div>
            )
          })}
          {rooms.length === 0 && (
            <p className="px-5 py-6 text-center text-xs text-slate-500">No rooms yet — create one from Collaboration Rooms to see teammates here.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function ProgressRing({ label, value, goal, progress, suffix = '' }: { label: string; value: number; goal: number; progress: number; suffix?: string }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress / 100)
  return (
    <div className="min-w-[88px] text-center">
      <div className="relative mx-auto size-20">
        <svg viewBox="0 0 88 88" className="size-20 -rotate-90" aria-hidden="true">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-white/7" />
          <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="text-white transition-[stroke-dashoffset] duration-700" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{value}{suffix}</span>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-300">{label}</p>
      <p className="mt-0.5 text-[10px] text-slate-600">{suffix ? `${Math.min(value, goal)}/${goal} days` : `${value}/${goal} XP`}</p>
    </div>
  )
}

function GoalInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="text-xs font-medium text-slate-400">{label}<input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-white/40" /></label>
}

function StatTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/7 bg-white/[0.03] p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
}
