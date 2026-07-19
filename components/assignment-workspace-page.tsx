'use client'

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  Library,
  ListChecks,
  LoaderCircle,
  Paperclip,
  PenLine,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { apiUrl } from '@/lib/api-client'
import { DOCUMENT_ACCEPT, readDocument } from '@/lib/documents/client'
import { cn } from '@/lib/utils'
import type { NoticeTone } from '@/components/airnexus-app'

type AssignmentWorkspacePageProps = {
  profileName: string
  notify: (message: string, tone?: NoticeTone) => void
}

type AssignmentStage = 'checklist' | 'timeline' | 'research' | 'draft' | 'references' | 'improvements' | 'review'
type Priority = 'high' | 'medium' | 'low'
type ReferenceStatus = 'verified' | 'needs-source'
type ReviewStatus = 'pass' | 'review'

type ChecklistItem = { id: string; title: string; detail: string; done: boolean }
type TimelineItem = { id: string; milestone: string; targetDate: string; detail: string; done: boolean }
type ResearchNote = { id: string; heading: string; content: string }
type ReferenceItem = { id: string; citation: string; note: string; status: ReferenceStatus }
type ImprovementSuggestion = { id: string; title: string; detail: string; priority: Priority; applied: boolean }
type FinalReviewItem = { id: string; criterion: string; detail: string; status: ReviewStatus; resolved: boolean }

type AssignmentWorkspace = {
  id: string
  title: string
  subject: string
  dueDate: string
  targetWordCount: number
  brief: string
  sourceNotes: string
  checklist: ChecklistItem[]
  timeline: TimelineItem[]
  researchNotes: ResearchNote[]
  draft: string
  references: ReferenceItem[]
  improvementSuggestions: ImprovementSuggestion[]
  finalReview: FinalReviewItem[]
  stageDone: Record<AssignmentStage, boolean>
  createdAt: string
  updatedAt: string
  generatedAt: string | null
}

type NewAssignmentForm = {
  title: string
  subject: string
  dueDate: string
  targetWordCount: string
  brief: string
  sourceNotes: string
}

const EMPTY_FORM: NewAssignmentForm = {
  title: '',
  subject: '',
  dueDate: '',
  targetWordCount: '1000',
  brief: '',
  sourceNotes: '',
}

const EMPTY_STAGE_DONE: Record<AssignmentStage, boolean> = {
  checklist: false,
  timeline: false,
  research: false,
  draft: false,
  references: false,
  improvements: false,
  review: false,
}

const STAGES: Array<{ id: AssignmentStage; label: string; icon: LucideIcon }> = [
  { id: 'checklist', label: 'Checklist', icon: ListChecks },
  { id: 'timeline', label: 'Timeline', icon: CalendarClock },
  { id: 'research', label: 'Research', icon: BookOpen },
  { id: 'draft', label: 'Draft', icon: PenLine },
  { id: 'references', label: 'References', icon: Library },
  { id: 'improvements', label: 'Improve', icon: WandSparkles },
  { id: 'review', label: 'Final review', icon: ShieldCheck },
]

const MAX_BRIEF_LENGTH = 6_000
const MAX_SOURCE_LENGTH = 12_000
const MAX_DRAFT_LENGTH = 24_000

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parseJsonObject(reply: string) {
  const normalized = reply.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = normalized.indexOf('{')
  const end = normalized.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const value: unknown = JSON.parse(normalized.slice(start, end + 1))
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

function parseGeneratedWorkspace(reply: string) {
  const value = parseJsonObject(reply)
  if (!value || !Array.isArray(value.checklist) || !Array.isArray(value.timeline) || !Array.isArray(value.researchNotes) || !Array.isArray(value.references) || !Array.isArray(value.improvementSuggestions) || !Array.isArray(value.finalReview)) return null

  const checklist = value.checklist.flatMap((item): ChecklistItem[] => {
    if (!isRecord(item)) return []
    const title = cleanText(item.title, 180)
    if (!title) return []
    return [{ id: createId('check'), title, detail: cleanText(item.detail, 500), done: false }]
  }).slice(0, 14)

  const timeline = value.timeline.flatMap((item): TimelineItem[] => {
    if (!isRecord(item)) return []
    const milestone = cleanText(item.milestone, 180)
    if (!milestone) return []
    return [{ id: createId('timeline'), milestone, targetDate: cleanText(item.targetDate, 40), detail: cleanText(item.detail, 500), done: false }]
  }).slice(0, 10)

  const researchNotes = value.researchNotes.flatMap((item): ResearchNote[] => {
    if (!isRecord(item)) return []
    const heading = cleanText(item.heading, 180)
    const content = cleanText(item.content, 2_500)
    return heading && content ? [{ id: createId('research'), heading, content }] : []
  }).slice(0, 10)

  const references = value.references.flatMap((item): ReferenceItem[] => {
    if (!isRecord(item)) return []
    const citation = cleanText(item.citation, 700)
    if (!citation) return []
    return [{ id: createId('reference'), citation, note: cleanText(item.note, 700), status: item.status === 'verified' ? 'verified' : 'needs-source' }]
  }).slice(0, 14)

  const improvementSuggestions = value.improvementSuggestions.flatMap((item): ImprovementSuggestion[] => {
    if (!isRecord(item)) return []
    const title = cleanText(item.title, 180)
    if (!title) return []
    const priority: Priority = item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium'
    return [{ id: createId('improvement'), title, detail: cleanText(item.detail, 900), priority, applied: false }]
  }).slice(0, 12)

  const finalReview = value.finalReview.flatMap((item): FinalReviewItem[] => {
    if (!isRecord(item)) return []
    const criterion = cleanText(item.criterion, 180)
    if (!criterion) return []
    return [{ id: createId('review'), criterion, detail: cleanText(item.detail, 900), status: item.status === 'pass' ? 'pass' : 'review', resolved: false }]
  }).slice(0, 12)

  const draft = cleanText(value.draft, MAX_DRAFT_LENGTH)
  if (checklist.length < 3 || timeline.length < 2 || researchNotes.length < 2 || !draft || finalReview.length < 2) return null
  return { checklist, timeline, researchNotes, draft, references, improvementSuggestions, finalReview }
}

function parseGeneratedReview(reply: string) {
  const value = parseJsonObject(reply)
  if (!value || !Array.isArray(value.improvementSuggestions) || !Array.isArray(value.finalReview)) return null
  const parsed = parseGeneratedWorkspace(JSON.stringify({
    checklist: [{ title: 'placeholder' }, { title: 'placeholder' }, { title: 'placeholder' }],
    timeline: [{ milestone: 'placeholder' }, { milestone: 'placeholder' }],
    researchNotes: [{ heading: 'placeholder', content: 'placeholder' }, { heading: 'placeholder', content: 'placeholder' }],
    draft: 'placeholder',
    references: [],
    improvementSuggestions: value.improvementSuggestions,
    finalReview: value.finalReview,
  }))
  return parsed ? { improvementSuggestions: parsed.improvementSuggestions, finalReview: parsed.finalReview } : null
}

function isStoredAssignment(value: unknown): value is AssignmentWorkspace {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.subject === 'string' && typeof value.brief === 'string' && typeof value.draft === 'string' && isRecord(value.stageDone) && Array.isArray(value.checklist) && Array.isArray(value.timeline) && Array.isArray(value.researchNotes) && Array.isArray(value.references) && Array.isArray(value.improvementSuggestions) && Array.isArray(value.finalReview)
}

function loadAssignments(storageKey: string) {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(value) ? value.filter(isStoredAssignment) : []
  } catch {
    return []
  }
}

function isStageComplete(assignment: AssignmentWorkspace, stage: AssignmentStage) {
  if (stage === 'checklist') return assignment.checklist.length > 0 && assignment.checklist.every((item) => item.done)
  if (stage === 'timeline') return assignment.timeline.length > 0 && assignment.timeline.every((item) => item.done)
  if (stage === 'improvements') return assignment.improvementSuggestions.length > 0 && assignment.improvementSuggestions.every((item) => item.applied)
  if (stage === 'review') return assignment.finalReview.length > 0 && assignment.finalReview.every((item) => item.status === 'pass' || item.resolved)
  return assignment.stageDone[stage]
}

function formatDueDate(value: string) {
  if (!value) return 'No due date'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function priorityClasses(priority: Priority) {
  if (priority === 'high') return 'bg-rose-400/12 text-rose-200'
  if (priority === 'low') return 'bg-sky-400/12 text-sky-200'
  return 'bg-amber-400/12 text-amber-200'
}

function AssignmentSection({ id, title, eyebrow, icon: Icon, complete, action, children }: { id: string; title: string; eyebrow: string; icon: LucideIcon; complete: boolean; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="glass scroll-mt-24 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('flex size-11 items-center justify-center rounded-2xl', complete ? 'bg-emerald-400/12 text-emerald-200' : 'bg-white/12 text-white')}><Icon className="size-5" /></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p><h3 className="mt-1 text-lg font-semibold text-white">{title}</h3></div>
        </div>
        <div className="flex items-center gap-2">{complete && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200"><CheckCircle2 className="size-3.5" />Complete</span>}{action}</div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function AssignmentWorkspacePage({ profileName, notify }: AssignmentWorkspacePageProps) {
  const profileKey = profileName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student'
  const storageKey = `airnexus-assignment-workspaces-v1:${profileKey}`
  const [assignments, setAssignments] = useState<AssignmentWorkspace[]>([])
  const [activeId, setActiveId] = useState('')
  const [creating, setCreating] = useState(true)
  const [form, setForm] = useState<NewAssignmentForm>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState<{ id: string; action: 'generate' | 'review' } | null>(null)
  const [aiError, setAiError] = useState('')
  const [sourceName, setSourceName] = useState('')
  const sourceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadSavedAssignments = () => {
      const saved = loadAssignments(storageKey)
      setAssignments(saved)
      setActiveId(saved[0]?.id ?? '')
      setCreating(saved.length === 0)
      setHydrated(true)
    }
    loadSavedAssignments()
  }, [storageKey])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(storageKey, JSON.stringify(assignments))
  }, [assignments, hydrated, storageKey])

  const active = assignments.find((assignment) => assignment.id === activeId) ?? null
  const completedStages = active ? STAGES.filter((stage) => isStageComplete(active, stage.id)).length : 0
  const progress = Math.round((completedStages / STAGES.length) * 100)

  const updateAssignment = (id: string, updater: (assignment: AssignmentWorkspace) => AssignmentWorkspace) => {
    setAssignments((current) => current.map((assignment) => assignment.id === id ? { ...updater(assignment), updatedAt: new Date().toISOString() } : assignment))
  }

  const buildGenerationPrompt = (assignment: AssignmentWorkspace) => `Build a complete assignment workspace for this student.
Today: ${new Date().toISOString().slice(0, 10)}
Title: ${assignment.title}
Subject: ${assignment.subject}
Due date: ${assignment.dueDate || 'not provided'}
Target word count: ${assignment.targetWordCount}

Assignment brief:
${assignment.brief.slice(0, 2_500)}

Student source notes and source details:
${assignment.sourceNotes.slice(0, 3_500) || 'No source material supplied. Do not invent references; create clearly labelled source-needed entries.'}`

  const buildReviewPrompt = (assignment: AssignmentWorkspace) => `Review this assignment draft against its brief. Return only improvement suggestions and the final-review checklist requested by the assignment review schema.
Title: ${assignment.title}
Subject: ${assignment.subject}
Due date: ${assignment.dueDate || 'not provided'}
Target word count: ${assignment.targetWordCount}

Brief:
${assignment.brief.slice(0, 2_000)}

Available source notes:
${assignment.sourceNotes.slice(0, 2_000) || 'No source material supplied.'}

Current draft:
${assignment.draft.slice(0, 6_000)}`

  const generateWorkspace = async (assignment: AssignmentWorkspace) => {
    if (loading) return
    setLoading({ id: assignment.id, action: 'generate' })
    setAiError('')
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: buildGenerationPrompt(assignment), mode: 'auto', action: 'assignment-plan', history: [], documents: [], isPlus: true }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Assignment generation failed')
      const generated = parseGeneratedWorkspace(data.reply)
      if (!generated) throw new Error('AirGPT returned an invalid assignment workspace')
      updateAssignment(assignment.id, (current) => ({ ...current, ...generated, stageDone: { ...EMPTY_STAGE_DONE }, generatedAt: new Date().toISOString() }))
      notify('Assignment workspace generated', 'success')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Assignment generation failed')
    } finally {
      setLoading(null)
    }
  }

  const reviewDraft = async (assignment: AssignmentWorkspace) => {
    if (loading || assignment.draft.trim().length < 80) return
    setLoading({ id: assignment.id, action: 'review' })
    setAiError('')
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: buildReviewPrompt(assignment), mode: 'auto', action: 'assignment-review', history: [], documents: [], isPlus: true }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Final review failed')
      const generated = parseGeneratedReview(data.reply)
      if (!generated) throw new Error('AirGPT returned an invalid final review')
      updateAssignment(assignment.id, (current) => ({ ...current, ...generated, stageDone: { ...current.stageDone, improvements: false, review: false } }))
      notify('Draft review updated', 'success')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Final review failed')
    } finally {
      setLoading(null)
    }
  }

  const createAssignment = () => {
    const title = form.title.trim()
    const subject = form.subject.trim()
    const brief = form.brief.trim()
    if (!title || !subject || brief.length < 40) {
      setFormError('Add a title, subject, and at least a short paragraph describing the assignment.')
      return
    }
    const now = new Date().toISOString()
    const assignment: AssignmentWorkspace = {
      id: createId('assignment'),
      title,
      subject,
      dueDate: form.dueDate,
      targetWordCount: Math.min(5_000, Math.max(100, Number(form.targetWordCount) || 1_000)),
      brief: brief.slice(0, MAX_BRIEF_LENGTH),
      sourceNotes: form.sourceNotes.trim().slice(0, MAX_SOURCE_LENGTH),
      checklist: [],
      timeline: [],
      researchNotes: [],
      draft: '',
      references: [],
      improvementSuggestions: [],
      finalReview: [],
      stageDone: { ...EMPTY_STAGE_DONE },
      createdAt: now,
      updatedAt: now,
      generatedAt: null,
    }
    setAssignments((current) => [assignment, ...current])
    setActiveId(assignment.id)
    setCreating(false)
    setForm(EMPTY_FORM)
    setFormError('')
    void generateWorkspace(assignment)
  }

  const attachSource = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !active) return
    setSourceName(file.name)
    setAiError('')
    try {
      const document = await readDocument(file, createId('assignment-source'))
      updateAssignment(active.id, (current) => ({ ...current, sourceNotes: `${current.sourceNotes}${current.sourceNotes ? '\n\n' : ''}${document.text}`.slice(0, MAX_SOURCE_LENGTH) }))
      notify(`${file.name} added to the assignment sources`, 'success')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AirNexus could not read this source file')
    }
  }

  const toggleStageDone = (stage: AssignmentStage) => {
    if (!active) return
    updateAssignment(active.id, (current) => ({ ...current, stageDone: { ...current.stageDone, [stage]: !current.stageDone[stage] } }))
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] p-6 sm:p-8">
        <div className="absolute right-8 top-7 size-28 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white"><ClipboardList className="size-3.5" />One assignment, one workspace</span><h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Assignment Workspace</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Turn a brief into a practical checklist, timeline, research notes, draft, references, improvements, and final review—without losing the thread.</p></div>
          {active && <div className="min-w-52 rounded-2xl border border-white/10 bg-white/[0.045] p-4"><div className="flex items-end justify-between"><span className="text-xs text-slate-400">Overall progress</span><strong className="text-2xl text-white">{progress}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-white transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-slate-500">{completedStages} of {STAGES.length} stages complete</p></div>}
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="glass rounded-3xl p-4 lg:sticky lg:top-24">
          <button type="button" onClick={() => { setCreating(true); setFormError('') }} className="primary-action w-full"><Plus className="size-4" />New assignment</button>
          <p className="mt-5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Your assignments</p>
          <div className="mt-2 space-y-2">
            {assignments.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-xs leading-5 text-slate-500">Create your first assignment to begin.</p>}
            {assignments.map((assignment) => {
              const done = STAGES.filter((stage) => isStageComplete(assignment, stage.id)).length
              return <button key={assignment.id} type="button" onClick={() => { setActiveId(assignment.id); setCreating(false); setAiError('') }} className={cn('w-full rounded-2xl border p-3 text-left transition', activeId === assignment.id && !creating ? 'border-white/30 bg-white/10' : 'border-transparent bg-white/[0.035] hover:border-white/10 hover:bg-white/[0.055]')}><p className="truncate text-sm font-medium text-white">{assignment.title}</p><p className="mt-1 truncate text-xs text-slate-500">{assignment.subject} · {formatDueDate(assignment.dueDate)}</p><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/8"><div className="h-full bg-white" style={{ width: `${Math.round((done / STAGES.length) * 100)}%` }} /></div></button>
            })}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          {creating && (
            <section className="glass rounded-3xl p-5 sm:p-7">
              <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-white/12 text-white"><Plus className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">New workspace</p><h3 className="mt-1 text-xl font-semibold text-white">Create an assignment</h3></div></div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-300">Assignment title<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Biology investigation report" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-white outline-none focus:border-white/40" /></label>
                <label className="text-sm text-slate-300">Subject<input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="e.g. Biology" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-white outline-none focus:border-white/40" /></label>
                <label className="text-sm text-slate-300">Due date<input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-white outline-none focus:border-white/40" /></label>
                <label className="text-sm text-slate-300">Target word count<input type="number" min="100" max="5000" value={form.targetWordCount} onChange={(event) => setForm((current) => ({ ...current, targetWordCount: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-white outline-none focus:border-white/40" /></label>
              </div>
              <label className="mt-4 block text-sm text-slate-300">Assignment brief<textarea value={form.brief} onChange={(event) => setForm((current) => ({ ...current, brief: event.target.value.slice(0, MAX_BRIEF_LENGTH) }))} placeholder="Paste the task sheet, rubric, question, required structure, and anything your teacher expects…" className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm leading-6 text-white outline-none focus:border-white/40" /></label>
              <label className="mt-4 block text-sm text-slate-300">Source notes <span className="text-slate-500">(optional)</span><textarea value={form.sourceNotes} onChange={(event) => setForm((current) => ({ ...current, sourceNotes: event.target.value.slice(0, MAX_SOURCE_LENGTH) }))} placeholder="Paste class notes, source details, quotations, or links you have already collected. AirGPT will not invent references." className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm leading-6 text-white outline-none focus:border-white/40" /></label>
              {formError && <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{formError}</p>}
              <button type="button" onClick={createAssignment} className="primary-action mt-5"><Sparkles className="size-4" />Create and generate workspace</button>
            </section>
          )}

          {!creating && active && (
            <>
              <section className="glass rounded-3xl p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1"><input aria-label="Assignment title" value={active.title} onChange={(event) => updateAssignment(active.id, (current) => ({ ...current, title: event.target.value }))} className="w-full bg-transparent text-2xl font-semibold tracking-tight text-white outline-none" /><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400"><span className="rounded-full bg-white/5 px-3 py-1.5">{active.subject}</span><span className="rounded-full bg-white/5 px-3 py-1.5">Due {formatDueDate(active.dueDate)}</span><span className="rounded-full bg-white/5 px-3 py-1.5">{active.targetWordCount.toLocaleString()} words</span><span className="rounded-full bg-white/5 px-3 py-1.5">Auto-saved</span></div></div>
                  <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void reviewDraft(active)} disabled={Boolean(loading) || active.draft.trim().length < 80} className="secondary-action">{loading?.id === active.id && loading.action === 'review' ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Review draft</button><button type="button" onClick={() => void generateWorkspace(active)} disabled={Boolean(loading)} className="primary-action">{loading?.id === active.id && loading.action === 'generate' ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{active.generatedAt ? 'Regenerate' : 'Generate workspace'}</button></div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{STAGES.map((stage) => { const Icon = stage.icon; const complete = isStageComplete(active, stage.id); return <a key={stage.id} href={`#assignment-${stage.id}`} className={cn('rounded-2xl border p-3 text-center transition hover:-translate-y-0.5', complete ? 'border-emerald-300/20 bg-emerald-400/8 text-emerald-200' : 'border-white/8 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-white')}><Icon className="mx-auto size-4" /><span className="mt-2 block text-[11px] font-medium">{stage.label}</span></a> })}</div>
                {aiError && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{aiError}</p>}
              </section>

              <section className="glass rounded-3xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Assignment context</p><h3 className="mt-1 font-semibold text-white">Brief and source material</h3></div><><input ref={sourceInputRef} type="file" accept={DOCUMENT_ACCEPT} onChange={(event) => void attachSource(event)} className="hidden" /><button type="button" onClick={() => sourceInputRef.current?.click()} className="secondary-action"><Paperclip className="size-4" />Attach source</button></></div>
                {sourceName && <p className="mt-3 text-xs text-emerald-300">Added {sourceName}</p>}
                <div className="mt-4 grid gap-4 xl:grid-cols-2"><label className="text-xs font-medium uppercase tracking-wider text-slate-500">Assignment brief<textarea value={active.brief} onChange={(event) => updateAssignment(active.id, (current) => ({ ...current, brief: event.target.value.slice(0, MAX_BRIEF_LENGTH) }))} className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-white/8 bg-slate-950/45 p-4 text-sm normal-case leading-6 tracking-normal text-slate-200 outline-none focus:border-white/35" /></label><label className="text-xs font-medium uppercase tracking-wider text-slate-500">Source notes<textarea value={active.sourceNotes} onChange={(event) => updateAssignment(active.id, (current) => ({ ...current, sourceNotes: event.target.value.slice(0, MAX_SOURCE_LENGTH) }))} placeholder="Add verified source details before regenerating references." className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-white/8 bg-slate-950/45 p-4 text-sm normal-case leading-6 tracking-normal text-slate-200 outline-none focus:border-white/35" /></label></div>
              </section>

              <AssignmentSection id="assignment-checklist" title="Action checklist" eyebrow="Stage 1" icon={ListChecks} complete={isStageComplete(active, 'checklist')}>
                {active.checklist.length === 0 ? <p className="text-sm text-slate-500">Generate the workspace to create a checklist.</p> : <div className="space-y-2">{active.checklist.map((item) => <button key={item.id} type="button" onClick={() => updateAssignment(active.id, (current) => ({ ...current, checklist: current.checklist.map((candidate) => candidate.id === item.id ? { ...candidate, done: !candidate.done } : candidate) }))} className={cn('flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition', item.done ? 'border-emerald-300/15 bg-emerald-400/7' : 'border-white/8 bg-white/[0.025] hover:border-white/20')}>{item.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /> : <Circle className="mt-0.5 size-5 shrink-0 text-slate-600" />}<span><span className={cn('block text-sm font-medium', item.done ? 'text-slate-500 line-through' : 'text-white')}>{item.title}</span>{item.detail && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>}</span></button>)}</div>}
              </AssignmentSection>

              <AssignmentSection id="assignment-timeline" title="Working timeline" eyebrow="Stage 2" icon={CalendarClock} complete={isStageComplete(active, 'timeline')}>
                {active.timeline.length === 0 ? <p className="text-sm text-slate-500">Your milestone timeline will appear after generation.</p> : <div className="relative space-y-3 before:absolute before:bottom-5 before:left-[18px] before:top-5 before:w-px before:bg-white/10">{active.timeline.map((item) => <button key={item.id} type="button" onClick={() => updateAssignment(active.id, (current) => ({ ...current, timeline: current.timeline.map((candidate) => candidate.id === item.id ? { ...candidate, done: !candidate.done } : candidate) }))} className="relative flex w-full items-start gap-4 rounded-2xl border border-white/8 bg-slate-950/25 p-4 text-left hover:border-white/20"><span className={cn('relative z-10 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border', item.done ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-slate-900 text-slate-500')}>{item.done ? <Check className="size-4" /> : <Target className="size-4" />}</span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className={cn('text-sm', item.done ? 'text-slate-500 line-through' : 'text-white')}>{item.milestone}</strong>{item.targetDate && <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-white">{item.targetDate}</span>}</span>{item.detail && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>}</span></button>)}</div>}
              </AssignmentSection>

              <AssignmentSection id="assignment-research" title="Research notes" eyebrow="Stage 3" icon={BookOpen} complete={isStageComplete(active, 'research')} action={active.researchNotes.length > 0 && <button type="button" onClick={() => toggleStageDone('research')} className="secondary-action text-xs">{active.stageDone.research ? 'Reopen' : 'Mark complete'}</button>}>
                {active.researchNotes.length === 0 ? <p className="text-sm text-slate-500">Research themes and evidence notes will appear here.</p> : <div className="grid gap-3 xl:grid-cols-2">{active.researchNotes.map((note) => <label key={note.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><input aria-label="Research note heading" value={note.heading} onChange={(event) => updateAssignment(active.id, (current) => ({ ...current, researchNotes: current.researchNotes.map((candidate) => candidate.id === note.id ? { ...candidate, heading: event.target.value } : candidate) }))} className="w-full bg-transparent text-sm font-semibold text-white outline-none" /><textarea aria-label={`${note.heading} research note`} value={note.content} onChange={(event) => updateAssignment(active.id, (current) => ({ ...current, researchNotes: current.researchNotes.map((candidate) => candidate.id === note.id ? { ...candidate, content: event.target.value } : candidate) }))} className="mt-3 min-h-28 w-full resize-y bg-transparent text-sm leading-6 text-slate-400 outline-none" /></label>)}</div>}
              </AssignmentSection>

              <AssignmentSection id="assignment-draft" title="Working draft" eyebrow="Stage 4" icon={PenLine} complete={isStageComplete(active, 'draft')} action={active.draft && <button type="button" onClick={() => toggleStageDone('draft')} className="secondary-action text-xs">{active.stageDone.draft ? 'Reopen' : 'Mark complete'}</button>}>
                <textarea aria-label="Assignment draft" value={active.draft} onChange={(event) => updateAssignment(active.id, (current) => ({ ...current, draft: event.target.value.slice(0, MAX_DRAFT_LENGTH), stageDone: { ...current.stageDone, draft: false } }))} placeholder="The AI-generated draft will appear here. Edit it in your own voice before final review." className="min-h-[420px] w-full resize-y rounded-2xl border border-white/8 bg-slate-950/45 p-5 text-sm leading-7 text-slate-200 outline-none focus:border-white/35" />
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{active.draft.trim() ? active.draft.trim().split(/\s+/).length.toLocaleString() : 0} words</span><span>Target: {active.targetWordCount.toLocaleString()} words</span></div>
              </AssignmentSection>

              <AssignmentSection id="assignment-references" title="References" eyebrow="Stage 5" icon={Library} complete={isStageComplete(active, 'references')} action={active.references.length > 0 && <button type="button" onClick={() => toggleStageDone('references')} className="secondary-action text-xs">{active.stageDone.references ? 'Reopen' : 'Mark checked'}</button>}>
                {active.references.length === 0 ? <p className="text-sm text-slate-500">No references yet. Add source details above, then regenerate. AirGPT will not fabricate citations.</p> : <div className="space-y-3">{active.references.map((reference) => <div key={reference.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider', reference.status === 'verified' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200')}>{reference.status === 'verified' ? 'From supplied source' : 'Source needed'}</span></div><textarea aria-label="Reference citation" value={reference.citation} onChange={(event) => updateAssignment(active.id, (current) => ({ ...current, references: current.references.map((candidate) => candidate.id === reference.id ? { ...candidate, citation: event.target.value } : candidate), stageDone: { ...current.stageDone, references: false } }))} className="mt-3 min-h-16 w-full resize-y bg-transparent text-sm leading-6 text-slate-200 outline-none" />{reference.note && <p className="mt-2 text-xs leading-5 text-slate-500">{reference.note}</p>}</div>)}</div>}
              </AssignmentSection>

              <AssignmentSection id="assignment-improvements" title="Improvement suggestions" eyebrow="Stage 6" icon={WandSparkles} complete={isStageComplete(active, 'improvements')} action={<button type="button" onClick={() => void reviewDraft(active)} disabled={Boolean(loading) || active.draft.trim().length < 80} className="secondary-action text-xs"><Sparkles className="size-3.5" />Refresh review</button>}>
                {active.improvementSuggestions.length === 0 ? <p className="text-sm text-slate-500">Review the draft to receive focused improvement suggestions.</p> : <div className="space-y-3">{active.improvementSuggestions.map((suggestion) => <button key={suggestion.id} type="button" onClick={() => updateAssignment(active.id, (current) => ({ ...current, improvementSuggestions: current.improvementSuggestions.map((candidate) => candidate.id === suggestion.id ? { ...candidate, applied: !candidate.applied } : candidate) }))} className={cn('flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition', suggestion.applied ? 'border-emerald-300/15 bg-emerald-400/7' : 'border-white/8 bg-white/[0.025] hover:border-white/20')}>{suggestion.applied ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /> : <Sparkles className="mt-0.5 size-5 shrink-0 text-zinc-300" />}<span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className={cn('text-sm', suggestion.applied ? 'text-slate-500 line-through' : 'text-white')}>{suggestion.title}</strong><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', priorityClasses(suggestion.priority))}>{suggestion.priority}</span></span><span className="mt-1 block text-xs leading-5 text-slate-500">{suggestion.detail}</span></span></button>)}</div>}
              </AssignmentSection>

              <AssignmentSection id="assignment-review" title="Final review" eyebrow="Stage 7" icon={ShieldCheck} complete={isStageComplete(active, 'review')}>
                {active.finalReview.length === 0 ? <p className="text-sm text-slate-500">Run the final review after editing your draft.</p> : <div className="grid gap-3 xl:grid-cols-2">{active.finalReview.map((review) => { const complete = review.status === 'pass' || review.resolved; return <button key={review.id} type="button" onClick={() => updateAssignment(active.id, (current) => ({ ...current, finalReview: current.finalReview.map((candidate) => candidate.id === review.id ? { ...candidate, resolved: !candidate.resolved } : candidate) }))} className={cn('rounded-2xl border p-4 text-left transition', complete ? 'border-emerald-300/15 bg-emerald-400/7' : 'border-amber-300/15 bg-amber-400/7')}><div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{review.criterion}</strong>{complete ? <CheckCircle2 className="size-5 shrink-0 text-emerald-300" /> : <AlertTriangle className="size-5 shrink-0 text-amber-300" />}</div><p className="mt-2 text-xs leading-5 text-slate-500">{review.detail}</p><span className="mt-3 inline-flex text-[10px] font-semibold uppercase tracking-wider text-slate-400">{complete ? 'Ready' : 'Needs attention'}</span></button> })}</div>}
              </AssignmentSection>
            </>
          )}

          {!creating && !active && <section className="glass rounded-3xl p-8 text-center"><FileText className="mx-auto size-8 text-slate-600" /><h3 className="mt-4 font-semibold text-white">Select an assignment</h3><p className="mt-2 text-sm text-slate-500">Choose one from the list or create a new workspace.</p></section>}
        </div>
      </div>
    </div>
  )
}
