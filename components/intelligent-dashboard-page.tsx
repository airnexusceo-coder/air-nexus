'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Gift,
  GraduationCap,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { apiUrl } from '@/lib/api-client'
import { getMotivationStats, loadMotivationState, MOTIVATION_UPDATED_EVENT, type MotivationStats } from '@/lib/motivation'
import type { NexusTransaction } from '@/lib/nexus-points'
import { cn } from '@/lib/utils'

const CHAT_HISTORY_STORAGE_KEY = 'airgpt-chat-history'
const DASHBOARD_CACHE_PREFIX = 'airnexus-daily-dashboard-v1'
const MAX_CONTEXT_CHARACTERS = 7_000

const SUBJECTS = [
  'Mathematics',
  'English',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Geography',
  'French',
  'Design',
] as const

const MOTIVATION = [
  'A focused twenty minutes today is more powerful than a perfect plan tomorrow.',
  'Small, deliberate practice is how difficult topics become familiar.',
  'You do not need to finish everything today—just move the right thing forward.',
  'Progress gets easier to trust when you can see the next useful step.',
  'Start with the question that feels slightly uncomfortable. That is usually where growth is hiding.',
]

type DashboardMessage = {
  role: 'user' | 'assistant'
  content: string
}

type DashboardThread = {
  id: string
  title: string
  messages: DashboardMessage[]
  updatedAt: string
}

type AcademicItem = {
  title: string
  subject: string
  dueDate: string | null
  evidence: string
}

type AttentionSubject = {
  subject: string
  reason: string
}

type DailyBrief = {
  studyGoal: string
  assignments: AcademicItem[]
  exams: AcademicItem[]
  attentionSubjects: AttentionSubject[]
  recommendations: string[]
  motivationalMessage: string
}

type CachedBrief = {
  date: string
  signature: string
  brief: DailyBrief
}

type IntelligentDashboardPageProps = {
  profileName: string
  motivationUserId: string
  transactions: NexusTransaction[]
  streakRewardClaimed: boolean
  onClaimStreakReward: () => void
  onContinueStudy: () => void
  onNavigate: (section: string) => void
  notify: (message: string, tone?: 'success' | 'info' | 'warning') => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function parseChatHistory(value: string | null): DashboardThread[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((candidate): DashboardThread[] => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.title !== 'string' || !Array.isArray(candidate.messages)) return []
      const messages = candidate.messages.flatMap((message): DashboardMessage[] => {
        if (!isRecord(message) || (message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return []
        return [{ role: message.role, content: message.content }]
      })
      const updatedAt = typeof candidate.updatedAt === 'string' && parseDate(candidate.updatedAt)
        ? candidate.updatedAt
        : new Date(0).toISOString()
      return [{ id: candidate.id, title: candidate.title, messages, updatedAt }]
    })
  } catch {
    return []
  }
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parseAcademicItems(value: unknown): AcademicItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((candidate): AcademicItem[] => {
    if (!isRecord(candidate)) return []
    const title = cleanString(candidate.title, 140)
    const subject = cleanString(candidate.subject, 60) || 'General'
    const evidence = cleanString(candidate.evidence, 220)
    const dueDate = candidate.dueDate === null ? null : cleanString(candidate.dueDate, 40) || null
    if (!title || !evidence) return []
    return [{ title, subject, dueDate, evidence }]
  }).slice(0, 5)
}

function parseAttentionSubjects(value: unknown): AttentionSubject[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((candidate): AttentionSubject[] => {
    if (!isRecord(candidate)) return []
    const subject = cleanString(candidate.subject, 60)
    const reason = cleanString(candidate.reason, 180)
    return subject && reason ? [{ subject, reason }] : []
  }).slice(0, 4)
}

function parseDailyBrief(value: unknown): DailyBrief | null {
  if (!isRecord(value)) return null
  const studyGoal = cleanString(value.studyGoal, 260)
  const motivationalMessage = cleanString(value.motivationalMessage, 260)
  const recommendations = Array.isArray(value.recommendations)
    ? value.recommendations.map((item) => cleanString(item, 220)).filter(Boolean).slice(0, 4)
    : []
  if (!studyGoal || !motivationalMessage || recommendations.length === 0) return null
  return {
    studyGoal,
    assignments: parseAcademicItems(value.assignments),
    exams: parseAcademicItems(value.exams),
    attentionSubjects: parseAttentionSubjects(value.attentionSubjects),
    recommendations,
    motivationalMessage,
  }
}

function extractDailyBrief(reply: string) {
  const withoutFence = reply.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return parseDailyBrief(JSON.parse(withoutFence.slice(start, end + 1)) as unknown)
  } catch {
    return null
  }
}

function readCachedBrief(key: string): CachedBrief | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '')
    if (!isRecord(parsed) || typeof parsed.date !== 'string' || typeof parsed.signature !== 'string') return null
    const brief = parseDailyBrief(parsed.brief)
    return brief ? { date: parsed.date, signature: parsed.signature, brief } : null
  } catch {
    return null
  }
}

function historySignature(threads: DashboardThread[]) {
  return threads
    .map((thread) => `${thread.id}:${thread.updatedAt}:${thread.messages.length}`)
    .sort()
    .join('|')
}

function buildConversationContext(threads: DashboardThread[]) {
  const ordered = [...threads]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8)
  const context = ordered.map((thread) => {
    const excerpt = thread.messages
      .filter((message) => message.role === 'user')
      .slice(-4)
      .map((message) => message.content.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' | ')
    return `Conversation: ${thread.title}\nStudent said: ${excerpt || 'No student prompt recorded.'}`
  }).join('\n\n')
  return context.slice(0, MAX_CONTEXT_CHARACTERS)
}

function inferAttentionSubjects(threads: DashboardThread[]): AttentionSubject[] {
  const text = threads
    .flatMap((thread) => thread.messages.filter((message) => message.role === 'user').map((message) => message.content))
    .join(' ')
    .toLowerCase()
  return SUBJECTS.flatMap((subject): Array<AttentionSubject & { score: number }> => {
    const aliases = subject === 'Mathematics' ? ['mathematics', 'maths', 'math'] : [subject.toLowerCase()]
    const mentions = aliases.reduce((total, alias) => total + (text.match(new RegExp(`\\b${alias}\\b`, 'g'))?.length ?? 0), 0)
    if (mentions === 0) return []
    const concern = ['struggling', 'weak', 'confused', 'hard', 'exam', 'test', 'help'].some((word) => text.includes(word))
    return [{ subject, reason: concern ? 'Recent questions suggest this deserves another focused pass.' : 'This subject appears often in your recent study conversations.', score: mentions + (concern ? 2 : 0) }]
  }).sort((a, b) => b.score - a.score).slice(0, 3).map(({ subject, reason }) => ({ subject, reason }))
}

function buildActivityBrief(profileName: string, threads: DashboardThread[], now: Date): DailyBrief {
  const recent = [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const attentionSubjects = inferAttentionSubjects(threads)
  const firstName = profileName.trim().split(/\s+/)[0] || 'there'
  const motivationIndex = Number(localDateKey(now).replaceAll('-', '')) % MOTIVATION.length
  return {
    studyGoal: recent ? `Continue “${recent.title}” and finish one concrete practice step.` : 'Choose one subject and complete a focused 25-minute study block.',
    assignments: [],
    exams: [],
    attentionSubjects,
    recommendations: recent
      ? [`Reopen “${recent.title}” and ask AirGPT for three practice questions.`, 'Finish one small task before starting a second subject.', 'End the session with a two-minute recall check.']
      : ['Tell AirGPT which subjects you study so tomorrow’s dashboard can be more specific.', 'Add your next exam or assignment in a study conversation.', 'Start with one focused 25-minute session.'],
    motivationalMessage: `${firstName}, ${MOTIVATION[motivationIndex]}`,
  }
}

function getWeekStart(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  const day = result.getDay()
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1))
  return result
}

function weeklyActivity(threads: DashboardThread[], transactions: NexusTransaction[], now: Date) {
  const start = getWeekStart(now)
  const values = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { label: date.toLocaleDateString([], { weekday: 'short' }).slice(0, 1), date: localDateKey(date), value: 0 }
  })
  for (const thread of threads) {
    const updated = parseDate(thread.updatedAt)
    if (!updated) continue
    const target = values.find((item) => item.date === localDateKey(updated))
    if (target) target.value += Math.max(1, thread.messages.filter((message) => message.role === 'user').length)
  }
  for (const transaction of transactions) {
    if (transaction.kind !== 'earned' || !transaction.description.startsWith('Completed task:')) continue
    const created = parseDate(transaction.createdAt)
    if (!created) continue
    const target = values.find((item) => item.date === localDateKey(created))
    if (target) target.value += 2
  }
  return values
}

function calculateStudyStreak(threads: DashboardThread[], transactions: NexusTransaction[], now: Date) {
  const activeDates = new Set<string>()
  threads.forEach((thread) => {
    const date = parseDate(thread.updatedAt)
    if (date) activeDates.add(localDateKey(date))
  })
  transactions.forEach((transaction) => {
    const date = parseDate(transaction.createdAt)
    if (date && transaction.kind === 'earned') activeDates.add(localDateKey(date))
  })
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

function formatDueDate(value: string | null) {
  if (!value) return 'Date not recorded'
  const date = parseDate(value)
  if (!date) return value
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

function greetingFor(date: Date) {
  if (date.getHours() < 12) return 'Good morning'
  if (date.getHours() < 18) return 'Good afternoon'
  return 'Good evening'
}

function AcademicList({ items, empty, onAdd }: { items: AcademicItem[]; empty: string; onAdd: () => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">
        <p>{empty}</p>
        <button type="button" onClick={onAdd} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white hover:text-zinc-300">
          Add study context <ArrowRight className="size-3" />
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <article key={`${item.title}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-sm font-medium text-white">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject}</p></div>
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-zinc-200">{formatDueDate(item.dueDate)}</span>
          </div>
        </article>
      ))}
    </div>
  )
}

export function IntelligentDashboardPage({ profileName, motivationUserId, transactions, streakRewardClaimed, onClaimStreakReward, onContinueStudy, onNavigate, notify }: IntelligentDashboardPageProps) {
  const [now, setNow] = useState(() => new Date())
  const [threads, setThreads] = useState<DashboardThread[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'ai' | 'activity'>('activity')
  const [error, setError] = useState('')
  const [motivationStats, setMotivationStats] = useState<MotivationStats | null>(null)

  useEffect(() => {
    const updateClock = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(updateClock)
  }, [])

  useEffect(() => {
    const refresh = (event?: Event) => {
      if (event instanceof CustomEvent && event.detail?.userId !== motivationUserId) return
      setMotivationStats(getMotivationStats(loadMotivationState(motivationUserId)))
    }
    refresh()
    window.addEventListener(MOTIVATION_UPDATED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(MOTIVATION_UPDATED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [motivationUserId])

  useEffect(() => {
    const loadHistory = () => {
      setThreads(parseChatHistory(window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)))
      setHistoryLoaded(true)
    }
    loadHistory()
    window.addEventListener('focus', loadHistory)
    window.addEventListener('storage', loadHistory)
    return () => {
      window.removeEventListener('focus', loadHistory)
      window.removeEventListener('storage', loadHistory)
    }
  }, [])

  const signature = useMemo(() => historySignature(threads), [threads])
  const cacheKey = `${DASHBOARD_CACHE_PREFIX}:${profileName.trim().toLowerCase() || 'student'}`

  const generateDashboard = useCallback(async (force: boolean) => {
    if (!historyLoaded) return
    const requestedAt = new Date()
    const date = localDateKey(requestedAt)
    if (!force) {
      const cached = readCachedBrief(cacheKey)
      if (cached?.date === date && cached.signature === signature) {
        setBrief(cached.brief)
        setSource('ai')
        setError('')
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      const conversationContext = buildConversationContext(threads)
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Create today's personalised student dashboard for ${profileName || 'this student'}.
Current local date: ${requestedAt.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

Recent conversation evidence:
${conversationContext || 'There are no previous student conversations yet.'}

Return JSON only, with this exact shape:
{
  "studyGoal": "one specific achievable goal for today",
  "assignments": [{ "title": "", "subject": "", "dueDate": "ISO date or null", "evidence": "short phrase from the conversation" }],
  "exams": [{ "title": "", "subject": "", "dueDate": "ISO date or null", "evidence": "short phrase from the conversation" }],
  "attentionSubjects": [{ "subject": "", "reason": "" }],
  "recommendations": ["three or four concise actions"],
  "motivationalMessage": "one grounded, non-cheesy sentence"
}

Important: never invent an assignment, exam, due date, subject, or weakness. Include assignments and exams only when explicitly supported by the conversation evidence. Use empty arrays when information is missing. Recommendations may suggest adding missing study context.`,
          isPlus: true,
          documents: [],
        }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Daily dashboard generation failed')
      const generated = extractDailyBrief(data.reply)
      if (!generated) throw new Error('AirGPT returned an invalid dashboard format')
      setBrief(generated)
      setSource('ai')
      window.localStorage.setItem(cacheKey, JSON.stringify({ date, signature, brief: generated } satisfies CachedBrief))
      if (force) notify('Today’s dashboard was refreshed', 'success')
    } catch (generationError) {
      setBrief(buildActivityBrief(profileName, threads, requestedAt))
      setSource('activity')
      const message = generationError instanceof Error ? generationError.message : 'AirGPT could not refresh the dashboard'
      setError(message)
      if (force) notify(message, 'warning')
    } finally {
      setLoading(false)
    }
  }, [cacheKey, historyLoaded, notify, profileName, signature, threads])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void generateDashboard(false), 0)
    return () => window.clearTimeout(timeoutId)
  }, [generateDashboard])

  const recentThreads = useMemo(() => [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4), [threads])
  const activity = useMemo(() => weeklyActivity(threads, transactions, now), [now, threads, transactions])
  const maxActivity = Math.max(1, ...activity.map((item) => item.value))
  const weeklyActions = activity.reduce((total, item) => total + item.value, 0)
  const streak = useMemo(() => calculateStudyStreak(threads, transactions, now), [now, threads, transactions])
  const firstName = profileName.trim().split(/\s+/)[0] || 'Student'
  const currentBrief = brief ?? buildActivityBrief(profileName, threads, now)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">{greetingFor(now)}, {firstName}. Your plan adapts as you study.</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">Today’s learning dashboard</h2>
          <p className="mt-2 text-sm text-slate-500">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · Built from your recent AirGPT activity</p>
        </div>
        <button type="button" onClick={() => void generateDashboard(true)} disabled={loading} className="secondary-action self-start sm:self-auto">
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh plan
        </button>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,.1),transparent_42%),rgba(255,255,255,.045)] p-6 sm:p-8" aria-labelledby="daily-goal-title">
        <div className="absolute right-6 top-6 flex size-12 items-center justify-center rounded-2xl bg-white/12 text-white"><Target className="size-6" /></div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">Today’s study goal</p>
        <h3 id="daily-goal-title" className="mt-3 max-w-3xl pr-14 text-2xl font-semibold leading-tight text-white sm:text-3xl">{currentBrief.studyGoal}</h3>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onContinueStudy} className="primary-action">Continue studying <ArrowRight className="size-4" /></button>
          <span className={cn('rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider', source === 'ai' ? 'bg-white/10 text-white' : 'bg-white/7 text-slate-400')}>
            {loading ? 'Updating…' : source === 'ai' ? 'Personalised by AirGPT' : 'Activity-based plan'}
          </span>
        </div>
        {error && <p className="mt-4 text-xs text-amber-200">{error}. Showing an activity-based plan for now.</p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="exams-title">
          <div className="mb-4 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"><GraduationCap className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">Plan ahead</p><h3 id="exams-title" className="font-semibold">Upcoming exams</h3></div></div>
          <AcademicList items={currentBrief.exams} empty="No upcoming exam has been mentioned in your AirGPT conversations." onAdd={onContinueStudy} />
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="assignments-title">
          <div className="mb-4 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-rose-400/10 text-rose-200"><BookOpenCheck className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">Due soon</p><h3 id="assignments-title" className="font-semibold">Assignments due</h3></div></div>
          <AcademicList items={currentBrief.assignments} empty="No assignment deadline has been mentioned in your AirGPT conversations." onAdd={onContinueStudy} />
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="attention-title">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"><BrainCircuit className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">Focus signal</p><h3 id="attention-title" className="font-semibold">Subjects needing attention</h3></div></div>
          <div className="mt-4 space-y-2">
            {currentBrief.attentionSubjects.length > 0 ? currentBrief.attentionSubjects.map((item) => (
              <article key={item.subject} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><p className="text-sm font-medium text-white">{item.subject}</p><p className="mt-1 text-xs leading-5 text-slate-400">{item.reason}</p></article>
            )) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">Ask AirGPT about a subject and this area will adapt automatically.</div>}
          </div>
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="recommendations-title">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"><Sparkles className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">Next best actions</p><h3 id="recommendations-title" className="font-semibold">AI recommendations</h3></div></div>
          <ol className="mt-4 space-y-3">
            {currentBrief.recommendations.map((recommendation, index) => (
              <li key={recommendation} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">{index + 1}</span>{recommendation}</li>
            ))}
          </ol>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="streak-title">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">Study streak</p><h3 id="streak-title" className="mt-1 text-xl font-semibold">{streak} active {streak === 1 ? 'day' : 'days'}</h3></div><span className="flex size-12 items-center justify-center rounded-2xl bg-white/12 text-white"><Flame className="size-6" /></span></div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Your streak is calculated from completed tasks and AirGPT study conversations—not a decorative counter.</p>
          <button type="button" onClick={onContinueStudy} className="secondary-action mt-5 w-full">Keep the streak alive</button>
          {motivationStats && (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/[0.06] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white"><Gift className="size-3.5" />7-day reward · +150 Nexus Points</p>
              <p className="mt-1 text-[11px] text-slate-500">Based on your {motivationStats.currentStreak}-day Nexus Points streak.</p>
              <button
                type="button"
                onClick={onClaimStreakReward}
                disabled={streakRewardClaimed || motivationStats.currentStreak < 7}
                className="secondary-action mt-3 w-full text-xs"
              >
                {streakRewardClaimed ? 'Reward claimed' : motivationStats.currentStreak < 7 ? `${7 - motivationStats.currentStreak} days to unlock` : 'Claim reward'}
              </button>
            </div>
          )}
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="weekly-title">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">Weekly progress</p><h3 id="weekly-title" className="mt-1 font-semibold">{weeklyActions} focused actions</h3></div><TrendingUp className="size-5 text-emerald-300" /></div>
          <div className="mt-6 flex h-36 items-end gap-3">
            {activity.map((item) => (
              <div key={item.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-medium text-zinc-300">{item.value || ''}</span><div className="w-full rounded-t-xl bg-gradient-to-t from-zinc-500/70 to-white transition-all" style={{ height: `${Math.max(8, (item.value / maxActivity) * 100)}%` }} /><span className="text-[10px] text-slate-500">{item.label}</span></div>
            ))}
          </div>
        </section>
      </div>

      <section className="glass flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:p-6" aria-label="Daily motivation">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-200"><CheckCircle2 className="size-6" /></span>
        <div className="flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">A note for today</p><p className="mt-1 text-base leading-7 text-slate-200">{currentBrief.motivationalMessage}</p></div>
      </section>

      <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="recent-title">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">Pick up where you left off</p><h3 id="recent-title" className="mt-1 font-semibold">Recent conversations</h3></div><MessageSquareText className="size-5 text-zinc-300" /></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recentThreads.length > 0 ? recentThreads.map((thread) => {
            const preview = thread.messages.find((message) => message.role === 'user')?.content ?? 'Continue this AirGPT conversation.'
            return <button key={thread.id} type="button" onClick={onContinueStudy} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.065]"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white"><MessageSquareText className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{thread.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{preview}</p><p className="mt-2 flex items-center gap-1 text-[10px] text-slate-600"><Clock3 className="size-3" />{parseDate(thread.updatedAt)?.toLocaleDateString([], { day: 'numeric', month: 'short' }) ?? 'Recently'}</p></div></div></button>
          }) : <div className="md:col-span-2 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">Your recent AirGPT conversations will appear here automatically.</div>}
        </div>
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={onContinueStudy} className="primary-action">Continue studying <ArrowRight className="size-4" /></button><button type="button" onClick={() => onNavigate('Calendar')} className="secondary-action"><CalendarDays className="size-4" />Open calendar</button></div>
      </section>
    </div>
  )
}
