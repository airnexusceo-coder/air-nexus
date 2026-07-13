'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cloud,
  Download,
  FileInput,
  Gauge,
  LoaderCircle,
  Lock,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  Target,
  Upload,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MotivationPage } from '@/components/motivation-page'
import type { NotificationDTO, NotificationType } from '@/lib/notifications/types'
import { CHAT_HISTORY_STORAGE_KEY } from '@/lib/chat-history'
import { FLASHCARD_DECK_STORAGE_KEY, type Flashcard, type FlashcardDeck } from '@/lib/ai/study-artifacts'
import { motivationStorageKey, parseMotivationState, MOTIVATION_UPDATED_EVENT } from '@/lib/motivation'
import { NEXUS_REWARDS_STORAGE_KEY, parseRewardsState } from '@/lib/nexus-points'

type NoticeTone = 'success' | 'info' | 'warning'

type WorkspacePagesProps = {
  page: string
  onNavigate: (section: string) => void
  notify: (message: string, tone?: NoticeTone) => void
  onEarnNexusPoints: (amount: number, description: string, actionId: string) => void
  motivationUserId: string
  profileName: string
}

type TaskPriority = 'High' | 'Medium' | 'Low'
type TaskStatus = 'Todo' | 'In Progress' | 'Done'

type StudyTask = {
  id: string
  title: string
  subject: string
  priority: TaskPriority
  status: TaskStatus
  dueAt: string | null
}

function formatDueDate(iso: string | null) {
  if (!iso) return 'No due date'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No due date'
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const priorityStyles: Record<TaskPriority, string> = {
  High: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  Medium: 'border-white/20 bg-white/10 text-white',
  Low: 'border-white/10 bg-white/5 text-zinc-400',
}

const statusStyles: Record<TaskStatus, string> = {
  Todo: 'bg-white/8 text-slate-300',
  'In Progress': 'bg-white/12 text-white',
  Done: 'bg-emerald-400/12 text-emerald-200',
}

export function WorkspacePages({ page, onNavigate, notify, onEarnNexusPoints, motivationUserId, profileName }: WorkspacePagesProps) {
  if (page === 'Tasks') return <TasksPage notify={notify} onEarnNexusPoints={onEarnNexusPoints} />
  if (page === 'Calendar') return <CalendarPage onNavigate={onNavigate} notify={notify} />
  if (page === 'Analytics') return <AnalyticsPage />
  if (page === 'Leaderboard') return <MotivationPage userId={motivationUserId} profileName={profileName} notify={notify} />
  if (page === 'Notifications') return <NotificationsPage notify={notify} />
  if (page === 'Integrations') return <IntegrationsPage notify={notify} motivationUserId={motivationUserId} />
  return null
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300/80">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  )
}

function TasksPage({ notify, onEarnNexusPoints }: Pick<WorkspacePagesProps, 'notify' | 'onEarnNexusPoints'>) {
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<'All' | TaskPriority>('All')
  const [status, setStatus] = useState<'All' | TaskStatus>('All')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [breakdownId, setBreakdownId] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch('/api/tasks', { credentials: 'include', cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load your tasks.')
      const data = await response.json() as { tasks: StudyTask[] }
      setTasks(data.tasks)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your tasks.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadTasks(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadTasks])

  const filtered = tasks.filter((task) => {
    const matchesQuery = (task.title + ' ' + task.subject).toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (priority === 'All' || task.priority === priority) && (status === 'All' || task.status === status)
  })

  const addTask = async () => {
    const title = newTitle.trim()
    if (!title || saving) return
    setSaving(true)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const data = await response.json().catch(() => ({})) as StudyTask & { error?: string }
      if (!response.ok || !('id' in data)) throw new Error((data as { error?: string }).error ?? 'Could not add task.')
      setTasks((current) => [data, ...current])
      setNewTitle('')
      setAdding(false)
      notify('Task added to your study plan', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add task.', 'warning')
    } finally {
      setSaving(false)
    }
  }

  const toggleTask = async (id: string) => {
    const task = tasks.find((item) => item.id === id)
    if (!task) return
    const nextStatus: TaskStatus = task.status === 'Done' ? 'Todo' : 'Done'
    setTasks((current) => current.map((item) => item.id === id ? { ...item, status: nextStatus } : item))
    if (nextStatus === 'Done') onEarnNexusPoints(10, `Completed task: ${task.title}`, `task-complete-${task.id}`)
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (!response.ok) {
      setTasks((current) => current.map((item) => item.id === id ? { ...item, status: task.status } : item))
      notify('Could not save that change.', 'warning')
    }
  }

  const subjectCount = new Set(tasks.map((task) => task.subject)).size

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Study command centre"
        title="Tasks"
        description="Plan assignments, manage deadlines, and let AirGPT turn intimidating work into clear next steps."
        action={<button type="button" onClick={() => setAdding((open) => !open)} className="primary-action"><Plus className="size-4" />Add task</button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="All tasks" value={String(tasks.length)} detail={`Across ${subjectCount} subject${subjectCount === 1 ? '' : 's'}`} icon={CheckCircle2} />
        <MetricCard label="In progress" value={String(tasks.filter((task) => task.status === 'In Progress').length)} detail="Keep the momentum" icon={Clock3} />
        <MetricCard label="Completed" value={String(tasks.filter((task) => task.status === 'Done').length)} detail="This study cycle" icon={Target} />
      </div>

      {adding && (
        <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
          <input
            autoFocus
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void addTask()}
            aria-label="New task title"
            placeholder="What needs to get done?"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/40"
          />
          <button type="button" disabled={!newTitle.trim() || saving} onClick={() => void addTask()} className="primary-action disabled:cursor-wait disabled:opacity-60">Save task</button>
        </div>
      )}

      <div className="glass grid gap-3 rounded-2xl p-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/8 bg-slate-950/20 px-3">
          <Search className="size-4 shrink-0 text-slate-500" />
          <span className="sr-only">Search tasks</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks or subjects" className="w-full bg-transparent py-2.5 text-sm outline-none" />
        </label>
        <FilterSelect label="Priority" value={priority} onChange={(value) => setPriority(value as 'All' | TaskPriority)} options={['All', 'High', 'Medium', 'Low']} />
        <FilterSelect label="Status" value={status} onChange={(value) => setStatus(value as 'All' | TaskStatus)} options={['All', 'Todo', 'In Progress', 'Done']} />
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((key) => <div key={key} className="premium-skeleton h-28 rounded-2xl" />)}
        </div>
      ) : loadError ? (
        <div className="glass rounded-2xl p-8 text-center">
          <LoaderCircle className="mx-auto size-5 text-slate-600" />
          <p className="mt-3 text-sm text-rose-300">{loadError}</p>
          <button type="button" onClick={() => void loadTasks()} className="secondary-action mx-auto mt-4">Try again</button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((task) => (
              <article key={task.id} className="glass rounded-2xl p-4 transition hover:border-white/20 hover:bg-white/[0.06]">
                <div className="flex items-start gap-3">
                  <button type="button" aria-label={(task.status === 'Done' ? 'Mark incomplete: ' : 'Mark complete: ') + task.title} aria-pressed={task.status === 'Done'} onClick={() => void toggleTask(task.id)} className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border transition', task.status === 'Done' ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-200' : 'border-white/15 bg-white/5 text-transparent hover:border-white/40')}>
                    <Check className="size-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn('font-medium text-white', task.status === 'Done' && 'text-slate-500 line-through')}>{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.subject} · Due {formatDueDate(task.dueAt)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', priorityStyles[task.priority])}>{task.priority}</span>
                  <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', statusStyles[task.status])}>{task.status}</span>
                  <button type="button" aria-expanded={breakdownId === task.id} onClick={() => setBreakdownId((current) => current === task.id ? null : task.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                    <Sparkles className="size-3.5" />AI Breakdown
                  </button>
                </div>
                {breakdownId === task.id && (
                  <div className="mt-3 rounded-xl border border-white/15 bg-white/[0.06] p-3 text-xs leading-5 text-slate-300">
                    <p className="font-medium text-white">A simple three-step plan</p>
                    <ol className="mt-1 list-inside list-decimal text-slate-400"><li>Gather the required notes and rubric.</li><li>Complete one focused 25-minute draft.</li><li>Review, improve, and submit.</li></ol>
                  </div>
                )}
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            tasks.length === 0
              ? <EmptyState title="No tasks yet" detail="Add your first task above to start planning your study work." />
              : <EmptyState title="No tasks found" detail="Try clearing a filter or searching for another subject." />
          )}
        </>
      )}
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/8 bg-slate-950/20 px-3 text-xs text-slate-400">
      <span>{label}</span>
      <select aria-label={'Filter by ' + label.toLowerCase()} value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent py-2.5 text-sm text-white outline-none">
        {options.map((option) => <option key={option} className="bg-slate-900">{option}</option>)}
      </select>
    </label>
  )
}

type CalendarEvent = { id: number; day: number; title: string; type: 'Deadline' | 'Exam' | 'Study'; time: string; task?: boolean }

const eventStyles = {
  Deadline: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  Exam: 'border-white/20 bg-white/10 text-white',
  Study: 'border-white/10 bg-white/5 text-zinc-300',
}

function CalendarPage({ onNavigate, notify }: Pick<WorkspacePagesProps, 'onNavigate' | 'notify'>) {
  const [events, setEvents] = useState<CalendarEvent[]>([
    { id: 1, day: 22, title: 'Physics study sprint', type: 'Study', time: '4:00 PM', task: true },
    { id: 2, day: 24, title: 'Maths chapter test', type: 'Exam', time: '9:10 AM' },
    { id: 3, day: 25, title: 'History analysis due', type: 'Deadline', time: '3:15 PM', task: true },
    { id: 4, day: 27, title: 'Biology revision', type: 'Study', time: '11:00 AM' },
    { id: 5, day: 30, title: 'Design portfolio due', type: 'Deadline', time: '5:00 PM', task: true },
  ])
  const [adding, setAdding] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDay, setEventDay] = useState('23')
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const leading = 0
  const cells = Array.from({ length: 35 }, (_, index) => index - leading + 1)

  const addEvent = () => {
    const title = eventTitle.trim()
    const day = Number(eventDay)
    if (!title || day < 1 || day > 30) return
    setEvents((current) => [...current, { id: Date.now(), day, title, type: 'Study', time: 'Any time' }])
    setEventTitle('')
    setAdding(false)
    notify('Study event added to June', 'success')
  }

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="June 2026" title="Study calendar" description="See deadlines, exam dates, and focused study blocks in one calm view." action={<button type="button" onClick={() => setAdding((open) => !open)} className="primary-action"><Plus className="size-4" />Add event</button>} />
      {adding && (
        <div className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_100px_auto]">
          <input autoFocus value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addEvent()} aria-label="Event title" placeholder="Study session or deadline" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/40" />
          <input type="number" min="1" max="30" value={eventDay} onChange={(event) => setEventDay(event.target.value)} aria-label="Day in June" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/40" />
          <button type="button" disabled={!eventTitle.trim()} onClick={addEvent} className="primary-action">Save event</button>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="glass overflow-hidden rounded-2xl p-3 sm:p-5" aria-label="June 2026 calendar">
          <div className="mb-4 flex items-center justify-between px-1"><h3 className="font-semibold">June 2026</h3><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">Today: 22 Jun</span></div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:gap-2 sm:text-xs">{weekdays.map((day) => <div key={day} className="py-2">{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((day, index) => {
              const dayEvents = events.filter((event) => event.day === day)
              const inMonth = day >= 1 && day <= 30
              return (
                <div key={index} className={cn('min-h-16 rounded-xl border p-1.5 sm:min-h-24 sm:p-2', day === 22 ? 'border-white/45 bg-white/10 shadow-lg shadow-white/5' : 'border-white/6 bg-white/[0.025]', !inMonth && 'opacity-20')}>
                  {inMonth && <span className={cn('inline-flex size-6 items-center justify-center rounded-lg text-xs', day === 22 && 'bg-white font-bold text-slate-950')}>{day}</span>}
                  <div className="mt-1 space-y-1">{dayEvents.slice(0, 2).map((event) => <div key={event.id} title={event.title} className={cn('truncate rounded-md border px-1 py-0.5 text-[8px] sm:text-[10px]', eventStyles[event.type])}>{event.title}</div>)}</div>
                </div>
              )
            })}
          </div>
        </section>
        <aside className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Upcoming</h3>
          {events.filter((event) => event.day >= 22).sort((a, b) => a.day - b.day).map((event) => (
            <article key={event.id} className="glass rounded-2xl p-4">
              <div className="flex items-start gap-3"><div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-white/7"><span className="text-[9px] uppercase text-slate-500">Jun</span><span className="text-sm font-bold">{event.day}</span></div><div className="min-w-0"><p className="text-sm font-medium">{event.title}</p><p className="mt-1 text-xs text-slate-500">{event.type} · {event.time}</p></div></div>
              {event.task && <button type="button" onClick={() => onNavigate('Tasks')} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-white hover:text-zinc-300">Open linked task <ArrowRight className="size-3" /></button>}
            </article>
          ))}
        </aside>
      </div>
    </div>
  )
}

function AnalyticsPage() {
  const subjects = [
    { name: 'Mathematics', value: 84, color: 'bg-white' },
    { name: 'Physics', value: 76, color: 'bg-zinc-300' },
    { name: 'English', value: 68, color: 'bg-zinc-500' },
    { name: 'Biology', value: 91, color: 'bg-emerald-400' },
  ]
  const week = [42, 65, 54, 82, 70, 94, 61]
  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Your learning pulse" title="Study analytics" description="A clear view of where your focus is going and how consistently you are moving forward." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Study hours" value="18.4h" detail="+2.6h this week" icon={Clock3} positive />
        <MetricCard label="Tasks completed" value="27" detail="84% completion rate" icon={CheckCircle2} positive />
        <MetricCard label="AI sessions" value="14" detail="3.2 hours saved" icon={Bot} />
        <MetricCard label="Quiz average" value="86%" detail="Up 4% this month" icon={Target} positive />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold">Weekly progress</h3><p className="mt-1 text-xs text-slate-500">Focused minutes by day</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">+12% vs last week</span></div>
          <div className="mt-8 flex h-48 items-end justify-between gap-3 border-b border-white/8 px-2">
            {week.map((height, index) => <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-zinc-500/60 to-white shadow-lg shadow-black/10 transition hover:brightness-125" style={{ height: height + '%' }} /><span className="text-[10px] text-slate-500">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span></div>)}
          </div>
        </section>
        <section className="glass flex flex-col rounded-2xl p-5">
          <h3 className="font-semibold">Productivity score</h3>
          <div className="my-auto flex items-center justify-center py-6"><div className="relative flex size-40 items-center justify-center rounded-full bg-[conic-gradient(oklch(0.92_0.003_255)_0_87%,oklch(1_0_0_/_8%)_87%_100%)]"><div className="flex size-32 flex-col items-center justify-center rounded-full bg-slate-950/90"><span className="text-4xl font-bold">87</span><span className="text-xs text-white">Excellent</span></div></div></div>
          <p className="text-center text-xs leading-5 text-slate-400">Your strongest focus window is 4–6 PM. Keep protecting that time.</p>
        </section>
      </div>
      <section className="glass rounded-2xl p-5"><h3 className="font-semibold">Subject progress</h3><div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2">{subjects.map((subject) => <div key={subject.name}><div className="mb-2 flex justify-between text-sm"><span>{subject.name}</span><span className="font-medium text-slate-300">{subject.value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/7"><div className={cn('h-full rounded-full', subject.color)} style={{ width: subject.value + '%' }} /></div></div>)}</div></section>
    </div>
  )
}

const NOTIFICATION_ICONS: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  room_invite: { icon: Users, color: 'bg-white/12 text-white' },
  task_assigned: { icon: CheckCircle2, color: 'bg-white/12 text-white' },
  task_completed: { icon: Check, color: 'bg-emerald-400/12 text-emerald-200' },
}
const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  room_invite: 'Room invite',
  task_assigned: 'Task assigned',
  task_completed: 'Task completed',
}

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function NotificationsPage({ notify }: Pick<WorkspacePagesProps, 'notify'>) {
  const [items, setItems] = useState<NotificationDTO[] | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/notifications', { credentials: 'include', cache: 'no-store' })
    if (response.ok) setItems(((await response.json()) as { notifications: NotificationDTO[] }).notifications)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const unread = items?.filter((item) => !item.read).length ?? 0

  const markAll = async () => {
    const response = await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' })
    if (!response.ok) { notify('Could not update notifications.', 'warning'); return }
    setItems((current) => current?.map((item) => ({ ...item, read: true })) ?? current)
    notify('All notifications marked as read', 'success')
  }

  const toggleRead = async (item: NotificationDTO) => {
    const nextRead = !item.read
    setItems((current) => current?.map((candidate) => candidate.id === item.id ? { ...candidate, read: nextRead } : candidate) ?? current)
    const response = await fetch(`/api/notifications/${item.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: nextRead }),
    })
    if (!response.ok) {
      setItems((current) => current?.map((candidate) => candidate.id === item.id ? item : candidate) ?? current)
      notify('Could not update notification.', 'warning')
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Stay in the loop" title="Notifications" description={`${unread} unread update${unread === 1 ? '' : 's'} across your rooms and tasks.`} action={<button type="button" onClick={() => void markAll()} disabled={unread === 0} className="secondary-action"><CheckCheckIcon />Mark all as read</button>} />
      {items == null ? (
        <p className="text-sm text-slate-500">Loading notifications…</p>
      ) : items.length === 0 ? (
        <EmptyState title="No notifications yet" detail="You'll see updates here when you're added to a room or assigned a task." />
      ) : (
        <section className="glass overflow-hidden rounded-2xl"><div className="divide-y divide-white/6">{items.map((item) => {
          const { icon: Icon, color } = NOTIFICATION_ICONS[item.type] ?? { icon: Bell, color: 'bg-white/8 text-zinc-300' }
          return (
            <button key={item.id} type="button" aria-label={(item.read ? 'Mark as unread: ' : 'Mark as read: ') + item.title} onClick={() => void toggleRead(item)} className={cn('flex w-full items-start gap-4 p-4 text-left transition hover:bg-white/5 sm:p-5', !item.read && 'bg-white/[0.05]')}>
              <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', color)}><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{NOTIFICATION_LABELS[item.type] ?? item.type}</span>
                  {!item.read && <span className="size-2 rounded-full bg-white shadow shadow-white" />}
                </span>
                <span className={cn('mt-1 block text-sm', !item.read ? 'font-semibold text-white' : 'font-medium text-slate-300')}>{item.title}</span>
                {item.body && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.body}</span>}
              </span>
              <span className="shrink-0 text-[10px] text-slate-600">{timeAgo(item.createdAt)}</span>
            </button>
          )
        })}</div></section>
      )}
    </div>
  )
}

function CheckCheckIcon() { return <span className="relative size-4"><Check className="absolute left-0 top-0 size-3.5" /><Check className="absolute left-1 top-0 size-3.5" /></span> }

type IntegrationPreview = { id: string; name: string; detail: string; icon: typeof Cloud }

const comingSoonIntegrations: IntegrationPreview[] = [
  { id: 'drive', name: 'Google Drive', detail: 'Sync notes, documents, and assignments.', icon: Cloud },
  { id: 'calendar', name: 'Google Calendar', detail: 'Keep exams and study blocks in sync.', icon: CalendarDays },
  { id: 'notion', name: 'Notion', detail: 'Bring study databases into AirGPT.', icon: BookOpen },
  { id: 'discord', name: 'Discord', detail: 'Share safe study-room updates.', icon: MessageSquareText },
  { id: 'teams', name: 'Microsoft Teams', detail: 'Connect class files and meetings.', icon: Users },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

/** Mirrors ai-tutor-page.tsx's loadSavedDeck validation so an imported deck can never overwrite a good local deck with malformed data. */
function parseImportedFlashcardDeck(value: unknown): FlashcardDeck | null {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.createdAt !== 'string' || !Array.isArray(value.cards)) return null
  const cards = value.cards.flatMap((candidate): Flashcard[] => {
    if (!isRecord(candidate)) return []
    const front = cleanText(candidate.front, 240)
    const back = cleanText(candidate.back, 500)
    if (!front || !back || typeof candidate.id !== 'string') return []
    return [{
      id: candidate.id,
      front,
      back,
      hint: cleanText(candidate.hint, 220),
      difficulty: candidate.difficulty === 'intermediate' || candidate.difficulty === 'advanced' ? candidate.difficulty : 'beginner',
    }]
  })
  return cards.length ? { title: value.title, createdAt: value.createdAt, cards } : null
}

function IntegrationsPage({ notify, motivationUserId }: Pick<WorkspacePagesProps, 'notify' | 'motivationUserId'>) {
  const importRef = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const rewardsKey = `${NEXUS_REWARDS_STORAGE_KEY}:${motivationUserId}`
    const motivation = parseMotivationState(window.localStorage.getItem(motivationStorageKey(motivationUserId)))
    const rewards = parseRewardsState(window.localStorage.getItem(rewardsKey))
    let chatHistory: unknown = []
    try {
      const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
      chatHistory = raw ? JSON.parse(raw) : []
    } catch {
      chatHistory = []
    }
    let flashcardDeck: unknown = null
    try {
      const raw = window.localStorage.getItem(FLASHCARD_DECK_STORAGE_KEY)
      flashcardDeck = raw ? JSON.parse(raw) : null
    } catch {
      flashcardDeck = null
    }

    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: 1,
      motivation,
      rewards,
      chatHistory,
      flashcardDeck,
    }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'airnexus-data-export.json'
    anchor.click()
    URL.revokeObjectURL(url)
    notify('AirNexus data export created', 'success')
  }

  const importData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const restored: string[] = []
      try {
        const parsed = JSON.parse(typeof reader.result === 'string' ? reader.result : '')
        if (!isRecord(parsed)) throw new Error('invalid export')

        if (isRecord(parsed.motivation)) {
          const state = parseMotivationState(JSON.stringify(parsed.motivation))
          window.localStorage.setItem(motivationStorageKey(motivationUserId), JSON.stringify(state))
          window.dispatchEvent(new CustomEvent(MOTIVATION_UPDATED_EVENT, { detail: { userId: motivationUserId } }))
          restored.push('study progress')
        }
        if (isRecord(parsed.rewards)) {
          const rewards = parseRewardsState(JSON.stringify(parsed.rewards))
          if (rewards) {
            window.localStorage.setItem(`${NEXUS_REWARDS_STORAGE_KEY}:${motivationUserId}`, JSON.stringify(rewards))
            restored.push('Nexus Points')
          }
        }
        if (Array.isArray(parsed.chatHistory) && parsed.chatHistory.length > 0) {
          window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(parsed.chatHistory))
          restored.push('chat history')
        }
        const deck = parseImportedFlashcardDeck(parsed.flashcardDeck)
        if (deck) {
          window.localStorage.setItem(FLASHCARD_DECK_STORAGE_KEY, JSON.stringify(deck))
          restored.push('flashcards')
        }
      } catch {
        notify(`${file.name} isn't a valid AirNexus export`, 'warning')
        event.target.value = ''
        return
      }
      notify(restored.length > 0 ? `Restored ${restored.join(', ')} from ${file.name}` : `${file.name} didn't contain any recognizable AirNexus data`, restored.length > 0 ? 'success' : 'warning')
      event.target.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Connected workspace" title="Integrations" description="Third-party connections aren't live yet. In the meantime, keep a real, portable backup of your AirNexus data below." />
      <div className="grid gap-3 md:grid-cols-2">{comingSoonIntegrations.map((item) => { const Icon = item.icon; return (
        <article key={item.id} className="flex items-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-4 sm:p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-white/35"><Icon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white/60">{item.name}</h3>
            <p className="mt-1 text-xs leading-5 text-white/30">{item.detail}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/35"><Lock className="size-3" /> Coming soon</span>
        </article>
      )})}</div>
      <section className="glass rounded-2xl p-5"><h3 className="font-semibold">Data tools</h3><p className="mt-1 text-xs text-slate-500">Download a real backup of your study progress, Nexus Points, chat history, and flashcards — or restore one on this device.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={exportData} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-4 text-left transition hover:bg-white/8"><span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"><Download className="size-5" /></span><span className="flex-1"><span className="block text-sm font-medium">Export data</span><span className="mt-0.5 block text-xs text-slate-500">Download a JSON backup</span></span><ChevronRight className="size-4 text-slate-600" /></button><button type="button" onClick={() => importRef.current?.click()} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-4 text-left transition hover:bg-white/8"><span className="flex size-10 items-center justify-center rounded-xl bg-white/8 text-zinc-300"><FileInput className="size-5" /></span><span className="flex-1"><span className="block text-sm font-medium">Restore backup</span><span className="mt-0.5 block text-xs text-slate-500">Choose a previously exported JSON file</span></span><Upload className="size-4 text-slate-600" /></button><input ref={importRef} type="file" accept=".json,application/json" onChange={importData} className="hidden" /></div></section>
    </div>
  )
}

function MetricCard({ label, value, detail, icon: Icon, positive = false }: { label: string; value: string; detail: string; icon: typeof Gauge; positive?: boolean }) {
  return <article className="glass rounded-2xl p-4"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"><Icon className="size-5" /></span></div><p className={cn('mt-3 text-xs', positive ? 'text-emerald-300' : 'text-slate-500')}>{detail}</p></article>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="glass rounded-2xl p-10 text-center"><Search className="mx-auto size-6 text-slate-600" /><p className="mt-3 font-medium">{title}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>
}
