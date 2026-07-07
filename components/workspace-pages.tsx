'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Cloud,
  Download,
  FileInput,
  Flame,
  Gauge,
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
  id: number
  title: string
  subject: string
  priority: TaskPriority
  status: TaskStatus
  due: string
}

const initialTasks: StudyTask[] = [
  { id: 1, title: 'Finish physics motion worksheet', subject: 'Physics', priority: 'High', status: 'In Progress', due: 'Today, 6:00 PM' },
  { id: 2, title: 'Draft English persuasive essay', subject: 'English', priority: 'High', status: 'Todo', due: 'Tomorrow' },
  { id: 3, title: 'Revise quadratic equations', subject: 'Mathematics', priority: 'Medium', status: 'Todo', due: '24 Jun' },
  { id: 4, title: 'Create biology flashcards', subject: 'Biology', priority: 'Medium', status: 'Done', due: '21 Jun' },
  { id: 5, title: 'Complete history source analysis', subject: 'History', priority: 'High', status: 'Todo', due: '25 Jun' },
  { id: 6, title: 'Practise French speaking prompts', subject: 'French', priority: 'Low', status: 'In Progress', due: '26 Jun' },
  { id: 7, title: 'Review chemistry balancing', subject: 'Chemistry', priority: 'Medium', status: 'Done', due: '20 Jun' },
  { id: 8, title: 'Plan geography field report', subject: 'Geography', priority: 'Low', status: 'Todo', due: '28 Jun' },
  { id: 9, title: 'Study trigonometry identities', subject: 'Mathematics', priority: 'High', status: 'In Progress', due: '29 Jun' },
  { id: 10, title: 'Read chapter six', subject: 'English', priority: 'Low', status: 'Done', due: '19 Jun' },
  { id: 11, title: 'Prepare design portfolio notes', subject: 'Design', priority: 'Medium', status: 'Todo', due: '30 Jun' },
  { id: 12, title: 'Complete weekly reflection', subject: 'Wellbeing', priority: 'Low', status: 'Todo', due: 'Friday' },
]

const priorityStyles: Record<TaskPriority, string> = {
  High: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  Medium: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  Low: 'border-orange-400/20 bg-orange-400/10 text-orange-200',
}

const statusStyles: Record<TaskStatus, string> = {
  Todo: 'bg-white/8 text-slate-300',
  'In Progress': 'bg-orange-400/12 text-orange-200',
  Done: 'bg-emerald-400/12 text-emerald-200',
}

export function WorkspacePages({ page, onNavigate, notify, onEarnNexusPoints, motivationUserId, profileName }: WorkspacePagesProps) {
  if (page === 'Tasks') return <TasksPage notify={notify} onEarnNexusPoints={onEarnNexusPoints} />
  if (page === 'Calendar') return <CalendarPage onNavigate={onNavigate} notify={notify} />
  if (page === 'Analytics') return <AnalyticsPage />
  if (page === 'Leaderboard') return <MotivationPage userId={motivationUserId} profileName={profileName} notify={notify} />
  if (page === 'Notifications') return <NotificationsPage notify={notify} />
  if (page === 'Integrations') return <IntegrationsPage notify={notify} />
  return null
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300/80">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  )
}

function TasksPage({ notify, onEarnNexusPoints }: Pick<WorkspacePagesProps, 'notify' | 'onEarnNexusPoints'>) {
  const [tasks, setTasks] = useState(initialTasks)
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<'All' | TaskPriority>('All')
  const [status, setStatus] = useState<'All' | TaskStatus>('All')
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [breakdownId, setBreakdownId] = useState<number | null>(null)

  const filtered = tasks.filter((task) => {
    const matchesQuery = (task.title + ' ' + task.subject).toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (priority === 'All' || task.priority === priority) && (status === 'All' || task.status === status)
  })

  const addTask = () => {
    const title = newTitle.trim()
    if (!title) return
    setTasks((current) => [{ id: Date.now(), title, subject: 'General', priority: 'Medium', status: 'Todo', due: 'No due date' }, ...current])
    setNewTitle('')
    setAdding(false)
    notify('Task added to your study plan', 'success')
  }

  const toggleTask = (id: number) => {
    const task = tasks.find((item) => item.id === id)
    if (task && task.status !== 'Done') {
      onEarnNexusPoints(10, `Completed task: ${task.title}`, `task-complete-${task.id}`)
    }
    setTasks((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'Done' ? 'Todo' : 'Done' } : item))
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Study command centre"
        title="Tasks"
        description="Plan assignments, manage deadlines, and let AirGPT turn intimidating work into clear next steps."
        action={<button type="button" onClick={() => setAdding((open) => !open)} className="primary-action"><Plus className="size-4" />Add task</button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="All tasks" value={String(tasks.length)} detail="Across 8 subjects" icon={CheckCircle2} />
        <MetricCard label="In progress" value={String(tasks.filter((task) => task.status === 'In Progress').length)} detail="Keep the momentum" icon={Clock3} />
        <MetricCard label="Completed" value={String(tasks.filter((task) => task.status === 'Done').length)} detail="This study cycle" icon={Target} />
      </div>

      {adding && (
        <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
          <input
            autoFocus
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && addTask()}
            aria-label="New task title"
            placeholder="What needs to get done?"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-300/40"
          />
          <button type="button" disabled={!newTitle.trim()} onClick={addTask} className="primary-action">Save task</button>
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

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((task) => (
          <article key={task.id} className="glass rounded-2xl p-4 transition hover:border-orange-300/20 hover:bg-white/[0.06]">
            <div className="flex items-start gap-3">
              <button type="button" aria-label={(task.status === 'Done' ? 'Mark incomplete: ' : 'Mark complete: ') + task.title} aria-pressed={task.status === 'Done'} onClick={() => toggleTask(task.id)} className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border transition', task.status === 'Done' ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-200' : 'border-white/15 bg-white/5 text-transparent hover:border-orange-300/40')}>
                <Check className="size-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('font-medium text-white', task.status === 'Done' && 'text-slate-500 line-through')}>{task.title}</p>
                <p className="mt-1 text-xs text-slate-500">{task.subject} · Due {task.due}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', priorityStyles[task.priority])}>{task.priority}</span>
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', statusStyles[task.status])}>{task.status}</span>
              <button type="button" aria-expanded={breakdownId === task.id} onClick={() => setBreakdownId((current) => current === task.id ? null : task.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50">
                <Sparkles className="size-3.5" />AI Breakdown
              </button>
            </div>
            {breakdownId === task.id && (
              <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-400/[0.06] p-3 text-xs leading-5 text-slate-300">
                <p className="font-medium text-amber-200">A simple three-step plan</p>
                <ol className="mt-1 list-inside list-decimal text-slate-400"><li>Gather the required notes and rubric.</li><li>Complete one focused 25-minute draft.</li><li>Review, improve, and submit.</li></ol>
              </div>
            )}
          </article>
        ))}
      </div>
      {filtered.length === 0 && <EmptyState title="No tasks found" detail="Try clearing a filter or searching for another subject." />}
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
  Exam: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  Study: 'border-orange-400/20 bg-orange-400/10 text-orange-200',
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
          <input autoFocus value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addEvent()} aria-label="Event title" placeholder="Study session or deadline" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-orange-300/40" />
          <input type="number" min="1" max="30" value={eventDay} onChange={(event) => setEventDay(event.target.value)} aria-label="Day in June" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-orange-300/40" />
          <button type="button" disabled={!eventTitle.trim()} onClick={addEvent} className="primary-action">Save event</button>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="glass overflow-hidden rounded-2xl p-3 sm:p-5" aria-label="June 2026 calendar">
          <div className="mb-4 flex items-center justify-between px-1"><h3 className="font-semibold">June 2026</h3><span className="rounded-full bg-orange-400/10 px-3 py-1 text-xs text-orange-200">Today: 22 Jun</span></div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:gap-2 sm:text-xs">{weekdays.map((day) => <div key={day} className="py-2">{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((day, index) => {
              const dayEvents = events.filter((event) => event.day === day)
              const inMonth = day >= 1 && day <= 30
              return (
                <div key={index} className={cn('min-h-16 rounded-xl border p-1.5 sm:min-h-24 sm:p-2', day === 22 ? 'border-orange-300/45 bg-orange-400/10 shadow-lg shadow-orange-500/5' : 'border-white/6 bg-white/[0.025]', !inMonth && 'opacity-20')}>
                  {inMonth && <span className={cn('inline-flex size-6 items-center justify-center rounded-lg text-xs', day === 22 && 'bg-orange-300 font-bold text-slate-950')}>{day}</span>}
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
              {event.task && <button type="button" onClick={() => onNavigate('Tasks')} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-300 hover:text-orange-200">Open linked task <ArrowRight className="size-3" /></button>}
            </article>
          ))}
        </aside>
      </div>
    </div>
  )
}

function AnalyticsPage() {
  const subjects = [
    { name: 'Mathematics', value: 84, color: 'bg-orange-400' },
    { name: 'Physics', value: 76, color: 'bg-orange-400' },
    { name: 'English', value: 68, color: 'bg-amber-400' },
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
            {week.map((height, index) => <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-orange-500/50 to-orange-300 shadow-lg shadow-orange-500/10 transition hover:brightness-125" style={{ height: height + '%' }} /><span className="text-[10px] text-slate-500">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span></div>)}
          </div>
        </section>
        <section className="glass flex flex-col rounded-2xl p-5">
          <h3 className="font-semibold">Productivity score</h3>
          <div className="my-auto flex items-center justify-center py-6"><div className="relative flex size-40 items-center justify-center rounded-full bg-[conic-gradient(oklch(0.72_0.18_45)_0_87%,oklch(1_0_0_/_8%)_87%_100%)]"><div className="flex size-32 flex-col items-center justify-center rounded-full bg-slate-950/90"><span className="text-4xl font-bold">87</span><span className="text-xs text-orange-200">Excellent</span></div></div></div>
          <p className="text-center text-xs leading-5 text-slate-400">Your strongest focus window is 4–6 PM. Keep protecting that time.</p>
        </section>
      </div>
      <section className="glass rounded-2xl p-5"><h3 className="font-semibold">Subject progress</h3><div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2">{subjects.map((subject) => <div key={subject.name}><div className="mb-2 flex justify-between text-sm"><span>{subject.name}</span><span className="font-medium text-slate-300">{subject.value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/7"><div className={cn('h-full rounded-full', subject.color)} style={{ width: subject.value + '%' }} /></div></div>)}</div></section>
    </div>
  )
}

type NotificationItem = { id: number; type: string; title: string; detail: string; time: string; unread: boolean; icon: typeof Bell; color: string }

function NotificationsPage({ notify }: Pick<WorkspacePagesProps, 'notify'>) {
  const [items, setItems] = useState<NotificationItem[]>([
    { id: 1, type: 'Task reminder', title: 'Physics worksheet is due today', detail: 'You have one section left. A 25-minute sprint should finish it.', time: '10 min ago', unread: true, icon: CheckCircle2, color: 'bg-orange-400/12 text-orange-200' },
    { id: 2, type: 'Exam reminder', title: 'Maths chapter test in 2 days', detail: 'Your revision plan has two sessions remaining.', time: '1 hour ago', unread: true, icon: CalendarDays, color: 'bg-amber-400/12 text-amber-200' },
    { id: 3, type: 'AI feedback', title: 'Your essay feedback is ready', detail: 'AirGPT found three ways to strengthen your evidence.', time: '3 hours ago', unread: true, icon: Sparkles, color: 'bg-amber-400/12 text-amber-200' },
    { id: 4, type: 'Collaboration update', title: 'Elena shared Biology notes', detail: 'New flashcards were added to your study room.', time: 'Yesterday', unread: false, icon: Users, color: 'bg-orange-400/12 text-orange-200' },
    { id: 5, type: 'Task reminder', title: 'Weekly reflection completed', detail: 'Nice work — your study streak is now 27 days.', time: '2 days ago', unread: false, icon: Flame, color: 'bg-orange-400/12 text-orange-200' },
  ])
  const unread = items.filter((item) => item.unread).length
  const markAll = () => { setItems((current) => current.map((item) => ({ ...item, unread: false }))); notify('All notifications marked as read', 'success') }
  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Stay in the loop" title="Notifications" description={`${unread} unread updates across your tasks, exams, AI feedback, and study rooms.`} action={<button type="button" onClick={markAll} disabled={unread === 0} className="secondary-action"><CheckCheckIcon />Mark all as read</button>} />
      <section className="glass overflow-hidden rounded-2xl"><div className="divide-y divide-white/6">{items.map((item) => { const Icon = item.icon; return (
        <button key={item.id} type="button" aria-label={(item.unread ? 'Mark as read: ' : 'Mark as unread: ') + item.title} onClick={() => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, unread: !candidate.unread } : candidate))} className={cn('flex w-full items-start gap-4 p-4 text-left transition hover:bg-white/5 sm:p-5', item.unread && 'bg-orange-400/[0.07]')}>
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', item.color)}><Icon className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.type}</span>{item.unread && <span className="size-2 rounded-full bg-orange-300 shadow shadow-orange-300" />}</span><span className={cn('mt-1 block text-sm', item.unread ? 'font-semibold text-white' : 'font-medium text-slate-300')}>{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span></span>
          <span className="shrink-0 text-[10px] text-slate-600">{item.time}</span>
        </button>
      )})}</div></section>
    </div>
  )
}

function CheckCheckIcon() { return <span className="relative size-4"><Check className="absolute left-0 top-0 size-3.5" /><Check className="absolute left-1 top-0 size-3.5" /></span> }

type Integration = { id: string; name: string; detail: string; icon: typeof Cloud; color: string; connected: boolean }

function IntegrationsPage({ notify }: Pick<WorkspacePagesProps, 'notify'>) {
  const [integrations, setIntegrations] = useState<Integration[]>([
    { id: 'drive', name: 'Google Drive', detail: 'Sync notes, documents, and assignments.', icon: Cloud, color: 'bg-orange-400/12 text-orange-200', connected: true },
    { id: 'calendar', name: 'Google Calendar', detail: 'Keep exams and study blocks in sync.', icon: CalendarDays, color: 'bg-emerald-400/12 text-emerald-200', connected: true },
    { id: 'notion', name: 'Notion', detail: 'Bring study databases into AirGPT.', icon: BookOpen, color: 'bg-slate-300/10 text-slate-200', connected: false },
    { id: 'discord', name: 'Discord', detail: 'Share safe study-room updates.', icon: MessageSquareText, color: 'bg-amber-400/12 text-amber-200', connected: false },
    { id: 'teams', name: 'Microsoft Teams', detail: 'Connect class files and meetings.', icon: Users, color: 'bg-amber-400/12 text-amber-200', connected: false },
  ])
  const importRef = useRef<HTMLInputElement>(null)
  const toggle = (id: string) => setIntegrations((current) => current.map((item) => item.id === id ? { ...item, connected: !item.connected } : item))
  const exportData = () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), tasks: initialTasks, connectedIntegrations: integrations.filter((item) => item.connected).map((item) => item.name) }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'airgpt-study-data.json'; anchor.click(); URL.revokeObjectURL(url)
    notify('AirGPT data export created', 'success')
  }
  const importNotes = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    notify(`${file.name} is ready to import`, 'success')
    event.target.value = ''
  }
  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Connected workspace" title="Integrations" description="Bring your study tools together. Connections are simulated locally and ready for backend providers later." />
      <div className="grid gap-3 md:grid-cols-2">{integrations.map((item) => { const Icon = item.icon; return (
        <article key={item.id} className="glass flex items-center gap-4 rounded-2xl p-4 sm:p-5"><span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', item.color)}><Icon className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-semibold">{item.name}</h3>{item.connected && <span className="flex items-center gap-1 text-[10px] text-emerald-300"><Circle className="size-1.5 fill-current" />Connected</span>}</div><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></div><button type="button" aria-pressed={item.connected} onClick={() => { toggle(item.id); notify(`${item.name} ${item.connected ? 'disconnected' : 'connected'}`, item.connected ? 'info' : 'success') }} className={cn('shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/50', item.connected ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-rose-400/10 hover:text-rose-200' : 'border-orange-300/20 bg-orange-400/10 text-orange-200 hover:bg-orange-400/20')}>{item.connected ? 'Disconnect' : 'Connect'}</button></article>
      )})}</div>
      <section className="glass rounded-2xl p-5"><h3 className="font-semibold">Data tools</h3><p className="mt-1 text-xs text-slate-500">Keep a portable copy of your workspace or bring existing notes in.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={exportData} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-4 text-left transition hover:bg-white/8"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-400/10 text-orange-200"><Download className="size-5" /></span><span className="flex-1"><span className="block text-sm font-medium">Export data</span><span className="mt-0.5 block text-xs text-slate-500">Download a JSON backup</span></span><ChevronRight className="size-4 text-slate-600" /></button><button type="button" onClick={() => importRef.current?.click()} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-4 text-left transition hover:bg-white/8"><span className="flex size-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-200"><FileInput className="size-5" /></span><span className="flex-1"><span className="block text-sm font-medium">Import notes</span><span className="mt-0.5 block text-xs text-slate-500">Choose TXT, Markdown, or JSON</span></span><Upload className="size-4 text-slate-600" /></button><input ref={importRef} type="file" accept=".txt,.md,.json,text/plain,application/json" onChange={importNotes} className="hidden" /></div></section>
    </div>
  )
}

function MetricCard({ label, value, detail, icon: Icon, positive = false }: { label: string; value: string; detail: string; icon: typeof Gauge; positive?: boolean }) {
  return <article className="glass rounded-2xl p-4"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-orange-400/10 text-orange-200"><Icon className="size-5" /></span></div><p className={cn('mt-3 text-xs', positive ? 'text-emerald-300' : 'text-slate-500')}>{detail}</p></article>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="glass rounded-2xl p-10 text-center"><Search className="mx-auto size-6 text-slate-600" /><p className="mt-3 font-medium">{title}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>
}
