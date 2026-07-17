'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Coffee,
  Compass,
  Flame,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { apiUrl } from '@/lib/api-client'
import type { NoticeTone } from '@/components/airnexus-app'
import type { NexusTransaction } from '@/lib/nexus-points'
import { cn } from '@/lib/utils'

type AiStudyCoachPageProps = {
  profileName: string
  transactions: NexusTransaction[]
  onNavigate: (section: string) => void
  notify: (message: string, tone?: NoticeTone) => void
  embedded?: boolean
}

type CoachMessage = { role: 'user' | 'assistant'; content: string }
type CoachThread = { id: string; title: string; messages: CoachMessage[]; updatedAt: string }
type CoachAssignment = { title: string; subject: string; dueDate: string; progress: number; updatedAt: string }
type BurnoutLevel = 'unknown' | 'low' | 'watch' | 'high'
type CoachPriority = 'high' | 'medium' | 'low'

type CoachPlan = {
  headline: string
  progressSummary: string
  recommendedSubjects: Array<{ subject: string; reason: string; priority: CoachPriority }>
  burnout: { level: BurnoutLevel; signals: string[]; recommendation: string }
  breaks: Array<{ afterMinutes: number; durationMinutes: number; reason: string }>
  studySessions: Array<{ subject: string; focus: string; durationMinutes: number; method: string; why: string }>
  revisionAdjustments: Array<{ subject: string; change: string; reason: string }>
  milestones: string[]
  motivation: string
}

type ActivitySnapshot = {
  activeDaysThisWeek: number
  currentStreak: number
  studyActionsThisWeek: number
  completedTasksThisWeek: number
  assignmentsDueSoon: number
  averageAssignmentProgress: number
  wellbeingSignals: string[]
}

type CachedCoachPlan = { date: string; signature: string; plan: CoachPlan }

const CHAT_HISTORY_STORAGE_KEY = 'airgpt-chat-history'
const COACH_CACHE_PREFIX = 'airnexus-study-coach-v1'
const MAX_COACH_CONTEXT = 9_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseChatHistory(value: string | null): CoachThread[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((candidate): CoachThread[] => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.title !== 'string' || !Array.isArray(candidate.messages)) return []
      const messages = candidate.messages.flatMap((message): CoachMessage[] => {
        if (!isRecord(message) || (message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return []
        return [{ role: message.role, content: message.content }]
      })
      const updatedAt = typeof candidate.updatedAt === 'string' && parseDate(candidate.updatedAt) ? candidate.updatedAt : new Date(0).toISOString()
      return [{ id: candidate.id, title: candidate.title, messages, updatedAt }]
    })
  } catch {
    return []
  }
}

function allDone(value: unknown, predicate: (item: Record<string, unknown>) => boolean) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isRecord(item) && predicate(item))
}

function assignmentProgress(value: Record<string, unknown>) {
  const stageDone = isRecord(value.stageDone) ? value.stageDone : {}
  const stages = [
    allDone(value.checklist, (item) => item.done === true),
    allDone(value.timeline, (item) => item.done === true),
    stageDone.research === true,
    stageDone.draft === true,
    stageDone.references === true,
    allDone(value.improvementSuggestions, (item) => item.applied === true),
    allDone(value.finalReview, (item) => item.status === 'pass' || item.resolved === true),
  ]
  return Math.round((stages.filter(Boolean).length / stages.length) * 100)
}

function parseAssignments(value: string | null): CoachAssignment[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((candidate): CoachAssignment[] => {
      if (!isRecord(candidate)) return []
      const title = cleanText(candidate.title, 160)
      const subject = cleanText(candidate.subject, 80)
      if (!title || !subject) return []
      return [{
        title,
        subject,
        dueDate: cleanText(candidate.dueDate, 40),
        progress: assignmentProgress(candidate),
        updatedAt: cleanText(candidate.updatedAt, 60),
      }]
    })
  } catch {
    return []
  }
}

function parsePriority(value: unknown): CoachPriority {
  return value === 'high' || value === 'low' ? value : 'medium'
}

function parseCoachPlan(value: unknown): CoachPlan | null {
  if (!isRecord(value) || !isRecord(value.burnout)) return null
  const headline = cleanText(value.headline, 180)
  const progressSummary = cleanText(value.progressSummary, 420)
  const motivation = cleanText(value.motivation, 260)
  const recommendation = cleanText(value.burnout.recommendation, 300)
  const level: BurnoutLevel = value.burnout.level === 'low' || value.burnout.level === 'watch' || value.burnout.level === 'high' ? value.burnout.level : 'unknown'

  const recommendedSubjects = Array.isArray(value.recommendedSubjects) ? value.recommendedSubjects.flatMap((item): CoachPlan['recommendedSubjects'] => {
    if (!isRecord(item)) return []
    const subject = cleanText(item.subject, 80)
    const reason = cleanText(item.reason, 260)
    return subject && reason ? [{ subject, reason, priority: parsePriority(item.priority) }] : []
  }).slice(0, 5) : []

  const burnoutSignals = Array.isArray(value.burnout.signals) ? value.burnout.signals.map((item) => cleanText(item, 180)).filter(Boolean).slice(0, 5) : []
  const breaks = Array.isArray(value.breaks) ? value.breaks.flatMap((item): CoachPlan['breaks'] => {
    if (!isRecord(item)) return []
    const reason = cleanText(item.reason, 220)
    const afterMinutes = Math.min(120, Math.max(15, Number(item.afterMinutes) || 45))
    const durationMinutes = Math.min(30, Math.max(3, Number(item.durationMinutes) || 10))
    return reason ? [{ afterMinutes, durationMinutes, reason }] : []
  }).slice(0, 4) : []

  const studySessions = Array.isArray(value.studySessions) ? value.studySessions.flatMap((item): CoachPlan['studySessions'] => {
    if (!isRecord(item)) return []
    const subject = cleanText(item.subject, 80)
    const focus = cleanText(item.focus, 180)
    const method = cleanText(item.method, 180)
    const why = cleanText(item.why, 240)
    const durationMinutes = Math.min(120, Math.max(10, Number(item.durationMinutes) || 25))
    return subject && focus && method && why ? [{ subject, focus, method, why, durationMinutes }] : []
  }).slice(0, 5) : []

  const revisionAdjustments = Array.isArray(value.revisionAdjustments) ? value.revisionAdjustments.flatMap((item): CoachPlan['revisionAdjustments'] => {
    if (!isRecord(item)) return []
    const subject = cleanText(item.subject, 80)
    const change = cleanText(item.change, 240)
    const reason = cleanText(item.reason, 240)
    return subject && change && reason ? [{ subject, change, reason }] : []
  }).slice(0, 5) : []

  const milestones = Array.isArray(value.milestones) ? value.milestones.map((item) => cleanText(item, 220)).filter(Boolean).slice(0, 5) : []
  if (!headline || !progressSummary || !motivation || !recommendation || breaks.length === 0 || studySessions.length === 0) return null
  return { headline, progressSummary, recommendedSubjects, burnout: { level, signals: burnoutSignals, recommendation }, breaks, studySessions, revisionAdjustments, milestones, motivation }
}

function extractCoachPlan(reply: string) {
  const normalized = reply.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = normalized.indexOf('{')
  const end = normalized.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return parseCoachPlan(JSON.parse(normalized.slice(start, end + 1)) as unknown)
  } catch {
    return null
  }
}

function calculateStreak(activeDates: Set<string>, now: Date) {
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  if (!activeDates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (activeDates.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function buildActivitySnapshot(threads: CoachThread[], assignments: CoachAssignment[], transactions: NexusTransaction[], now: Date): ActivitySnapshot {
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 6)
  weekAgo.setHours(0, 0, 0, 0)
  const activeDates = new Set<string>()
  let studyActionsThisWeek = 0
  let completedTasksThisWeek = 0
  const studentText: string[] = []

  threads.forEach((thread) => {
    const updated = parseDate(thread.updatedAt)
    if (updated) activeDates.add(localDateKey(updated))
    if (updated && updated >= weekAgo) studyActionsThisWeek += thread.messages.filter((message) => message.role === 'user').length
    thread.messages.filter((message) => message.role === 'user').slice(-4).forEach((message) => studentText.push(message.content))
  })
  transactions.forEach((transaction) => {
    const created = parseDate(transaction.createdAt)
    if (!created || transaction.kind !== 'earned') return
    activeDates.add(localDateKey(created))
    if (created >= weekAgo) {
      studyActionsThisWeek += 1
      if (transaction.description.startsWith('Completed task:')) completedTasksThisWeek += 1
    }
  })

  const inSevenDays = new Date(now)
  inSevenDays.setDate(now.getDate() + 7)
  const assignmentsDueSoon = assignments.filter((assignment) => {
    const due = parseDate(assignment.dueDate)
    return due && due >= now && due <= inSevenDays && assignment.progress < 100
  }).length
  const averageAssignmentProgress = assignments.length ? Math.round(assignments.reduce((total, assignment) => total + assignment.progress, 0) / assignments.length) : 0
  const wellbeingPattern = /\b(tired|exhausted|overwhelmed|burn(?:ed|t)? out|stressed|no sleep|can(?:not|'t) focus|too much|falling behind)\b/i
  const wellbeingSignals = studentText.filter((text) => wellbeingPattern.test(text)).slice(-4).map((text) => text.replace(/\s+/g, ' ').trim().slice(0, 150))
  const thisWeekDates = [...activeDates].filter((date) => date >= localDateKey(weekAgo) && date <= localDateKey(now))

  return {
    activeDaysThisWeek: thisWeekDates.length,
    currentStreak: calculateStreak(activeDates, now),
    studyActionsThisWeek,
    completedTasksThisWeek,
    assignmentsDueSoon,
    averageAssignmentProgress,
    wellbeingSignals,
  }
}

function readCachedPlan(key: string): CachedCoachPlan | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? '')
    if (!isRecord(value) || typeof value.date !== 'string' || typeof value.signature !== 'string') return null
    const plan = parseCoachPlan(value.plan)
    return plan ? { date: value.date, signature: value.signature, plan } : null
  } catch {
    return null
  }
}

function fallbackCoachPlan(firstName: string, snapshot: ActivitySnapshot, assignments: CoachAssignment[]): CoachPlan {
  const subjectMap = new Map<string, CoachAssignment[]>()
  assignments.forEach((assignment) => subjectMap.set(assignment.subject, [...(subjectMap.get(assignment.subject) ?? []), assignment]))
  const recommendedSubjects = [...subjectMap.entries()].map(([subject, items]) => {
    const lowestProgress = Math.min(...items.map((item) => item.progress))
    return { subject, reason: `${items.length} active assignment${items.length === 1 ? '' : 's'}; lowest progress is ${lowestProgress}%.`, priority: lowestProgress < 40 ? 'high' as const : 'medium' as const }
  }).slice(0, 3)
  const level: BurnoutLevel = snapshot.wellbeingSignals.length > 0 || snapshot.assignmentsDueSoon >= 3 ? 'watch' : snapshot.studyActionsThisWeek > 0 ? 'low' : 'unknown'
  const primarySubject = recommendedSubjects[0]?.subject ?? 'Study planning'
  return {
    headline: snapshot.assignmentsDueSoon > 0 ? 'Protect your energy and move the nearest deadline forward.' : 'Build momentum with one focused, finishable session.',
    progressSummary: snapshot.studyActionsThisWeek > 0 ? `You recorded ${snapshot.studyActionsThisWeek} study actions across ${snapshot.activeDaysThisWeek} active days this week.` : 'There is not enough recorded study activity yet for a detailed trend analysis.',
    recommendedSubjects,
    burnout: { level, signals: snapshot.wellbeingSignals, recommendation: level === 'watch' ? 'Use shorter blocks today, choose one priority, and stop after the planned session.' : 'Keep the workload bounded and take the planned break before starting another subject.' },
    breaks: [{ afterMinutes: level === 'watch' ? 25 : 45, durationMinutes: level === 'watch' ? 10 : 8, reason: 'Step away from the screen, move, drink water, and return only if your focus has reset.' }],
    studySessions: [{ subject: primarySubject, focus: recommendedSubjects[0]?.reason ?? 'Choose the next deadline or weakest topic and define one concrete outcome.', durationMinutes: level === 'watch' ? 25 : 40, method: 'Focused work followed by a two-minute retrieval recap', why: 'A bounded session creates evidence of progress without expanding today’s workload.' }],
    revisionAdjustments: recommendedSubjects.map((item) => ({ subject: item.subject, change: 'Move one short active-recall block earlier in the week.', reason: item.reason })),
    milestones: snapshot.currentStreak >= 3 ? [`You have built a ${snapshot.currentStreak}-day active study streak.`] : snapshot.completedTasksThisWeek > 0 ? [`You completed ${snapshot.completedTasksThisWeek} tracked task${snapshot.completedTasksThisWeek === 1 ? '' : 's'} this week.`] : [],
    motivation: `${firstName}, you do not need a heroic session today—just a clear finish line and the discipline to stop when you reach it.`,
  }
}

function riskClasses(level: BurnoutLevel) {
  if (level === 'high') return 'border-rose-300/25 bg-rose-400/10 text-rose-200'
  if (level === 'watch') return 'border-amber-300/25 bg-amber-400/10 text-amber-200'
  if (level === 'low') return 'border-emerald-300/20 bg-emerald-400/8 text-emerald-200'
  return 'border-white/10 bg-white/[0.035] text-slate-300'
}

function priorityClasses(priority: CoachPriority) {
  if (priority === 'high') return 'bg-rose-400/10 text-rose-200'
  if (priority === 'low') return 'bg-sky-400/10 text-sky-200'
  return 'bg-amber-400/10 text-amber-200'
}

export function AiStudyCoachPage({ profileName, transactions, onNavigate, notify, embedded = false }: AiStudyCoachPageProps) {
  const profileKey = profileName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student'
  const assignmentStorageKey = `airnexus-assignment-workspaces-v1:${profileKey}`
  const cacheKey = `${COACH_CACHE_PREFIX}:${profileKey}`
  const [threads, setThreads] = useState<CoachThread[]>([])
  const [assignments, setAssignments] = useState<CoachAssignment[]>([])
  const [signalsLoaded, setSignalsLoaded] = useState(false)
  const [plan, setPlan] = useState<CoachPlan | null>(null)
  const [source, setSource] = useState<'ai' | 'activity'>('activity')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const now = useMemo(() => new Date(), [])
  const firstName = profileName.trim().split(/\s+/)[0] || 'Student'

  useEffect(() => {
    const loadSignals = () => {
      setThreads(parseChatHistory(window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)))
      setAssignments(parseAssignments(window.localStorage.getItem(assignmentStorageKey)))
      setSignalsLoaded(true)
    }
    loadSignals()
    window.addEventListener('focus', loadSignals)
    window.addEventListener('storage', loadSignals)
    return () => {
      window.removeEventListener('focus', loadSignals)
      window.removeEventListener('storage', loadSignals)
    }
  }, [assignmentStorageKey])

  const snapshot = useMemo(() => buildActivitySnapshot(threads, assignments, transactions, now), [assignments, now, threads, transactions])
  const signature = useMemo(() => JSON.stringify({ threads: threads.map((thread) => [thread.id, thread.updatedAt, thread.messages.length]), assignments, transactions: transactions.slice(0, 20).map((item) => [item.id, item.createdAt]) }), [assignments, threads, transactions])

  const generateCoachPlan = useCallback(async (force: boolean) => {
    if (!signalsLoaded) return
    const date = localDateKey(new Date())
    if (!force) {
      const cached = readCachedPlan(cacheKey)
      if (cached?.date === date && cached.signature === signature) {
        setPlan(cached.plan)
        setSource('ai')
        setError('')
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      const recentStudentMessages = [...threads]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .flatMap((thread) => thread.messages.filter((message) => message.role === 'user').slice(-3).map((message) => ({ conversation: thread.title, message: message.content.replace(/\s+/g, ' ').trim().slice(0, 500) })))
        .slice(0, 14)
      const recentCompletedActions = transactions.filter((item) => item.kind === 'earned').slice(0, 12).map((item) => ({ description: item.description, createdAt: item.createdAt }))
      const context = JSON.stringify({ date, metrics: snapshot, assignments, recentStudentMessages, recentCompletedActions }, null, 2).slice(0, MAX_COACH_CONTEXT)
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Create today's proactive study-coach briefing for ${profileName || 'this student'} using only this AirNexus evidence:\n${context}`, mode: 'auto', action: 'study-coach', history: [], documents: [], isPlus: true }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Daily coach analysis failed')
      const generated = extractCoachPlan(data.reply)
      if (!generated) throw new Error('AirGPT returned an invalid coach briefing')
      setPlan(generated)
      setSource('ai')
      window.localStorage.setItem(cacheKey, JSON.stringify({ date, signature, plan: generated } satisfies CachedCoachPlan))
      if (force) notify('Your study coach refreshed today’s plan', 'success')
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : 'AirGPT could not update the study coach'
      setPlan(fallbackCoachPlan(firstName, snapshot, assignments))
      setSource('activity')
      setError(message)
      if (force) notify(message, 'warning')
    } finally {
      setLoading(false)
    }
  }, [assignments, cacheKey, firstName, notify, profileName, signalsLoaded, signature, snapshot, threads, transactions])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void generateCoachPlan(false), 0)
    return () => window.clearTimeout(timeoutId)
  }, [generateCoachPlan])

  const currentPlan = plan ?? fallbackCoachPlan(firstName, snapshot, assignments)
  const riskLabel = currentPlan.burnout.level === 'unknown' ? 'Not enough evidence' : currentPlan.burnout.level === 'low' ? 'Load looks balanced' : currentPlan.burnout.level === 'watch' ? 'Watch your workload' : 'High overload signal'

  if (embedded) {
    return (
      <section className="space-y-5" aria-labelledby="dashboard-coach-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300"><Compass className="size-3.5" /> Integrated AI coach</span>
            <h3 id="dashboard-coach-title" className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{currentPlan.headline}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">{currentPlan.progressSummary}</p>
          </div>
          <button type="button" onClick={() => void generateCoachPlan(true)} disabled={loading} className="secondary-action self-start">
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{loading ? 'Analysing…' : 'Refresh coach'}
          </button>
        </div>

        {error && <p role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-300/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-100"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}. Showing an activity-based coach view.</p>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active days', value: snapshot.activeDaysThisWeek, detail: 'this week', icon: Activity },
            { label: 'Study actions', value: snapshot.studyActionsThisWeek, detail: 'this week', icon: TrendingUp },
            { label: 'Assignments due', value: snapshot.assignmentsDueSoon, detail: 'next 7 days', icon: Target },
            { label: 'Assignment progress', value: `${snapshot.averageAssignmentProgress}%`, detail: 'average', icon: Award },
          ].map((metric) => { const Icon = metric.icon; return <article key={metric.label} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{metric.label}</span><Icon className="size-4 text-zinc-300" /></div><p className="mt-3 text-2xl font-semibold text-white">{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.detail}</p></article> })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className={cn('rounded-3xl border p-5 sm:p-6', riskClasses(currentPlan.burnout.level))}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">Workload signal</p><h4 className="mt-1 text-lg font-semibold">{riskLabel}</h4></div><AlertTriangle className="size-5" /></div>
            <p className="mt-4 text-sm leading-6 opacity-85">{currentPlan.burnout.recommendation}</p>
            {currentPlan.burnout.signals.length > 0 && <div className="mt-4 space-y-2">{currentPlan.burnout.signals.map((signal, index) => <p key={`${signal}-${index}`} className="rounded-xl bg-black/10 px-3 py-2 text-xs leading-5 opacity-80">{signal}</p>)}</div>}
            <p className="mt-4 text-[10px] leading-4 opacity-60">This is a workload signal, not a medical assessment.</p>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Next best blocks</p><h4 className="mt-1 text-lg font-semibold text-white">Study sessions to start from Dashboard</h4></div><button type="button" onClick={() => onNavigate('AI Tutor')} className="secondary-action text-xs">Open tutor</button></div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {currentPlan.studySessions.slice(0, 4).map((session, index) => <article key={`${session.subject}-${session.focus}-${index}`} className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{session.subject}</p><h5 className="mt-2 font-semibold text-white">{session.focus}</h5></div><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300"><Clock3 className="size-3" />{session.durationMinutes}m</span></div><p className="mt-3 text-sm leading-6 text-slate-400">{session.method}</p><p className="mt-2 text-xs leading-5 text-slate-500">Why now: {session.why}</p></article>)}
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center gap-3"><Coffee className="size-5 text-emerald-300" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Recovery plan</p><h4 className="mt-1 font-semibold text-white">Recommended breaks</h4></div></div>
            <div className="mt-5 space-y-3">{currentPlan.breaks.slice(0, 3).map((item, index) => <article key={`${item.afterMinutes}-${item.durationMinutes}-${index}`} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-black/15 p-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-sm font-semibold text-emerald-200">{item.durationMinutes}m</span><div><p className="text-sm font-medium text-white">Break after {item.afterMinutes} minutes</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p></div></article>)}</div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center gap-3"><BookOpen className="size-5 text-sky-300" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Priority subjects</p><h4 className="mt-1 font-semibold text-white">Where attention will pay off</h4></div></div>
            <div className="mt-5 space-y-3">{currentPlan.recommendedSubjects.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm leading-6 text-slate-500">Add assignments or study conversations and the coach will adapt automatically.</p> : currentPlan.recommendedSubjects.slice(0, 4).map((item) => <article key={item.subject} className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{item.subject}</strong><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase', priorityClasses(item.priority))}>{item.priority}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{item.reason}</p></article>)}</div>
          </section>
        </div>

        {(currentPlan.revisionAdjustments.length > 0 || currentPlan.milestones.length > 0) && (
          <div className="grid gap-5 xl:grid-cols-2">
            {currentPlan.revisionAdjustments.length > 0 && <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"><div className="flex items-center gap-3"><CalendarClock className="size-5 text-zinc-300" /><h4 className="font-semibold text-white">Adaptive revision changes</h4></div><div className="mt-5 grid gap-3">{currentPlan.revisionAdjustments.slice(0, 4).map((item, index) => <article key={`${item.subject}-${index}`} className="rounded-2xl border border-white/8 bg-black/15 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{item.subject}</p><p className="mt-2 text-sm font-medium text-white">{item.change}</p><p className="mt-2 text-xs leading-5 text-slate-500">{item.reason}</p></article>)}</div></section>}
            {currentPlan.milestones.length > 0 && <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"><div className="flex items-center gap-3"><Award className="size-5 text-yellow-300" /><h4 className="font-semibold text-white">Coach milestones</h4></div><div className="mt-4 space-y-2">{currentPlan.milestones.slice(0, 4).map((milestone, index) => <p key={`${milestone}-${index}`} className="flex items-start gap-2 rounded-xl bg-yellow-400/8 px-3 py-2 text-sm leading-6 text-yellow-100"><CheckCircle2 className="mt-1 size-4 shrink-0" />{milestone}</p>)}</div></section>}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.99))] p-6 sm:p-8">
        <div className="absolute right-10 top-8 size-32 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white"><Compass className="size-3.5" />Proactive daily coaching</span><p className="mt-5 text-sm text-slate-400">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {firstName}.</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{currentPlan.headline}</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{currentPlan.motivation}</p></div>
          <div className="flex flex-col items-end gap-2"><button type="button" onClick={() => void generateCoachPlan(true)} disabled={loading} className="secondary-action">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{loading ? 'Analysing…' : 'Refresh coach'}</button><span className="text-[10px] uppercase tracking-wider text-slate-500">{source === 'ai' ? 'AI briefing · updates daily' : 'Activity view · AI unavailable'}</span></div>
        </div>
      </section>

      {error && <p role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-300/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-100"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}. Showing a transparent activity-based plan.</p>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: 'Active days', value: snapshot.activeDaysThisWeek, detail: 'this week', icon: Activity }, { label: 'Study streak', value: snapshot.currentStreak, detail: 'active days', icon: Flame }, { label: 'Study actions', value: snapshot.studyActionsThisWeek, detail: 'this week', icon: TrendingUp }, { label: 'Assignments', value: `${snapshot.averageAssignmentProgress}%`, detail: `${snapshot.assignmentsDueSoon} due soon`, icon: Target }].map((metric) => { const Icon = metric.icon; return <article key={metric.label} className="glass rounded-2xl p-4"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{metric.label}</span><Icon className="size-4 text-zinc-300" /></div><p className="mt-3 text-2xl font-semibold text-white">{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.detail}</p></article> })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-white/12 text-white"><BrainCircuit className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Progress analysis</p><h3 className="mt-1 text-lg font-semibold text-white">What the coach sees</h3></div></div>
          <p className="mt-5 text-sm leading-7 text-slate-300">{currentPlan.progressSummary}</p>
          <button type="button" onClick={() => onNavigate('Dashboard')} className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-white hover:text-zinc-300">Open detailed progress <ArrowRight className="size-3.5" /></button>
        </section>

        <section className={cn('rounded-3xl border p-5 sm:p-6', riskClasses(currentPlan.burnout.level))}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">Burnout safeguard</p><h3 className="mt-1 text-lg font-semibold">{riskLabel}</h3></div><AlertTriangle className="size-5" /></div>
          <p className="mt-4 text-sm leading-6 opacity-85">{currentPlan.burnout.recommendation}</p>
          {currentPlan.burnout.signals.length > 0 && <div className="mt-4 space-y-2">{currentPlan.burnout.signals.map((signal, index) => <p key={`${signal}-${index}`} className="rounded-xl bg-black/10 px-3 py-2 text-xs leading-5 opacity-80">{signal}</p>)}</div>}
          <p className="mt-4 text-[10px] leading-4 opacity-60">This is a workload signal, not a medical assessment.</p>
        </section>
      </div>

      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Suggested sessions</p><h3 className="mt-1 text-xl font-semibold text-white">Your next best study blocks</h3></div><button type="button" onClick={() => onNavigate('Assignment Workspace')} className="secondary-action text-xs">Open assignments</button></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">{currentPlan.studySessions.map((session, index) => <article key={`${session.subject}-${session.focus}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{session.subject}</p><h4 className="mt-2 font-semibold text-white">{session.focus}</h4></div><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300"><Clock3 className="size-3" />{session.durationMinutes}m</span></div><p className="mt-3 text-sm leading-6 text-slate-400">{session.method}</p><p className="mt-2 text-xs leading-5 text-slate-500">Why now: {session.why}</p><button type="button" onClick={() => onNavigate('AI Tutor')} className="primary-action mt-4 text-xs"><Sparkles className="size-3.5" />Start with the tutor</button></article>)}</div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-3"><Coffee className="size-5 text-emerald-300" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Recovery plan</p><h3 className="mt-1 font-semibold text-white">Recommended breaks</h3></div></div>
          <div className="mt-5 space-y-3">{currentPlan.breaks.map((item, index) => <article key={`${item.afterMinutes}-${item.durationMinutes}-${index}`} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-sm font-semibold text-emerald-200">{item.durationMinutes}m</span><div><p className="text-sm font-medium text-white">Break after {item.afterMinutes} minutes</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p></div></article>)}</div>
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-3"><BookOpen className="size-5 text-sky-300" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Priority subjects</p><h3 className="mt-1 font-semibold text-white">Where attention will pay off</h3></div></div>
          <div className="mt-5 space-y-3">{currentPlan.recommendedSubjects.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm leading-6 text-slate-500">No subject recommendation is supported yet. Add an assignment or study conversation and the coach will adapt automatically.</p> : currentPlan.recommendedSubjects.map((item) => <article key={item.subject} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{item.subject}</strong><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase', priorityClasses(item.priority))}>{item.priority}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{item.reason}</p></article>)}</div>
        </section>
      </div>

      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-3"><CalendarClock className="size-5 text-zinc-300" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Adaptive revision</p><h3 className="mt-1 font-semibold text-white">Changes to make today</h3></div></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">{currentPlan.revisionAdjustments.length === 0 ? <p className="text-sm text-slate-500">No existing revision plan was found to adjust.</p> : currentPlan.revisionAdjustments.map((item, index) => <article key={`${item.subject}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{item.subject}</p><p className="mt-2 text-sm font-medium text-white">{item.change}</p><p className="mt-2 text-xs leading-5 text-slate-500">{item.reason}</p></article>)}</div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="glass rounded-3xl p-5 sm:p-6"><div className="flex items-center gap-3"><Award className="size-5 text-yellow-300" /><h3 className="font-semibold text-white">Milestones</h3></div>{currentPlan.milestones.length === 0 ? <p className="mt-4 text-sm leading-6 text-slate-500">Your next genuine milestone will appear here when the activity data supports it.</p> : <div className="mt-4 space-y-2">{currentPlan.milestones.map((milestone, index) => <p key={`${milestone}-${index}`} className="flex items-start gap-2 rounded-xl bg-yellow-400/8 px-3 py-2 text-sm leading-6 text-yellow-100"><CheckCircle2 className="mt-1 size-4 shrink-0" />{milestone}</p>)}</div>}</div>
        <div className="rounded-3xl border border-white/15 bg-white/8 p-5 sm:p-6"><div className="flex items-center gap-3"><Compass className="size-5 text-white" /><h3 className="font-semibold text-white">Coach’s nudge</h3></div><p className="mt-4 text-lg leading-8 text-white">{currentPlan.motivation}</p><button type="button" onClick={() => onNavigate('AI Tutor')} className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-white hover:text-zinc-300">Begin the first session <ArrowRight className="size-3.5" /></button></div>
      </section>
    </div>
  )
}
