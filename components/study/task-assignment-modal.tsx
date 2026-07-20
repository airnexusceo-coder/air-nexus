'use client'

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Library,
  ListChecks,
  LoaderCircle,
  Paperclip,
  PenLine,
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
import { Modal } from '@/components/ui/modal'
import type { NoticeTone } from '@/components/airnexus-app'
import {
  ASSIGNMENT_MAX,
  EMPTY_STAGE_DONE,
  isStageComplete,
  type AssignmentStage,
  type ChecklistItem,
  type FinalReviewItem,
  type ImprovementSuggestion,
  type AssignmentPriority,
  type ReferenceItem,
  type ResearchNote,
  type TaskAssignmentDTO,
  type TimelineItem,
} from '@/lib/tasks/assignment-types'

type TaskSummary = { id: string; title: string; subject: string; dueAt: string | null }

type TaskAssignmentModalProps = {
  open: boolean
  onClose: () => void
  task: TaskSummary | null
  notify: (message: string, tone?: NoticeTone) => void
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
    const priority: AssignmentPriority = item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium'
    return [{ id: createId('improvement'), title, detail: cleanText(item.detail, 900), priority, applied: false }]
  }).slice(0, 12)

  const finalReview = value.finalReview.flatMap((item): FinalReviewItem[] => {
    if (!isRecord(item)) return []
    const criterion = cleanText(item.criterion, 180)
    if (!criterion) return []
    return [{ id: createId('review'), criterion, detail: cleanText(item.detail, 900), status: item.status === 'pass' ? 'pass' : 'review', resolved: false }]
  }).slice(0, 12)

  const draft = cleanText(value.draft, ASSIGNMENT_MAX.draft)
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

function formatDueDate(iso: string | null) {
  if (!iso) return 'No due date'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'No due date' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function priorityClasses(priority: AssignmentPriority) {
  if (priority === 'high') return 'bg-rose-400/12 text-rose-200'
  if (priority === 'low') return 'bg-sky-400/12 text-sky-200'
  return 'bg-amber-400/12 text-amber-200'
}

function toPatchBody(assignment: TaskAssignmentDTO): Record<string, unknown> {
  const { brief, sourceNotes, targetWordCount, checklist, timeline, researchNotes, draft, references, improvementSuggestions, finalReview, stageDone, generatedAt } = assignment
  return { brief, sourceNotes, targetWordCount, checklist, timeline, researchNotes, draft, references, improvementSuggestions, finalReview, stageDone, generatedAt }
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

export function TaskAssignmentModal({ open, onClose, task, notify }: TaskAssignmentModalProps) {
  const [assignment, setAssignment] = useState<TaskAssignmentDTO | null>(null)
  const [hydrating, setHydrating] = useState(true)
  const [briefForm, setBriefForm] = useState({ brief: '', sourceNotes: '', targetWordCount: '1000' })
  const [formError, setFormError] = useState('')
  const [starting, setStarting] = useState(false)
  const [loading, setLoading] = useState<'generate' | 'review' | null>(null)
  const [aiError, setAiError] = useState('')
  const [sourceName, setSourceName] = useState('')
  const sourceInputRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const pendingPatchRef = useRef<Record<string, unknown> | null>(null)
  const taskId = task?.id ?? null

  useEffect(() => {
    if (!open || !taskId) return
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return
      setHydrating(true)
      setAiError('')
      fetch(apiUrl(`/api/tasks/${taskId}/assignment`), { credentials: 'include', cache: 'no-store' })
        .then((response) => response.json() as Promise<{ assignment: TaskAssignmentDTO | null }>)
        .then((data) => {
          if (cancelled) return
          setAssignment(data.assignment)
          setBriefForm(data.assignment
            ? { brief: data.assignment.brief, sourceNotes: data.assignment.sourceNotes, targetWordCount: String(data.assignment.targetWordCount) }
            : { brief: '', sourceNotes: '', targetWordCount: '1000' })
        })
        .catch(() => { if (!cancelled) notify('Could not load the assignment workspace.', 'warning') })
        .finally(() => { if (!cancelled) setHydrating(false) })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timeoutId) }
  }, [open, taskId, notify])

  const savePatch = async (patch: Record<string, unknown>) => {
    if (!taskId) return
    try {
      const response = await fetch(apiUrl(`/api/tasks/${taskId}/assignment`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) throw new Error('save failed')
    } catch {
      notify('Could not save your assignment changes.', 'warning')
    }
  }

  const flushSave = () => {
    if (saveTimeoutRef.current) { window.clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null }
    if (pendingPatchRef.current) { void savePatch(pendingPatchRef.current); pendingPatchRef.current = null }
  }

  const scheduleSave = (patch: Record<string, unknown>, delay: number) => {
    pendingPatchRef.current = patch
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)
    if (delay <= 0) { flushSave(); return }
    saveTimeoutRef.current = window.setTimeout(flushSave, delay)
  }

  const flushSaveRef = useRef(flushSave)
  useEffect(() => { flushSaveRef.current = flushSave })
  useEffect(() => () => flushSaveRef.current(), [])

  const updateAssignment = (updater: (current: TaskAssignmentDTO) => TaskAssignmentDTO, debounceMs = 0) => {
    setAssignment((current) => {
      if (!current) return current
      const next = { ...updater(current), updatedAt: new Date().toISOString() }
      scheduleSave(toPatchBody(next), debounceMs)
      return next
    })
  }

  const handleClose = () => {
    flushSave()
    setAssignment(null)
    setAiError('')
    setSourceName('')
    onClose()
  }

  const completedStages = assignment ? STAGES.filter((stage) => isStageComplete(assignment, stage.id)).length : 0
  const progress = Math.round((completedStages / STAGES.length) * 100)

  const buildGenerationPrompt = (current: TaskAssignmentDTO) => `Build a complete assignment workspace for this student.
Today: ${new Date().toISOString().slice(0, 10)}
Title: ${task?.title ?? ''}
Subject: ${task?.subject ?? ''}
Due date: ${formatDueDate(task?.dueAt ?? null)}
Target word count: ${current.targetWordCount}

Assignment brief:
${current.brief.slice(0, 2_500)}

Student source notes and source details:
${current.sourceNotes.slice(0, 3_500) || 'No source material supplied. Do not invent references; create clearly labelled source-needed entries.'}`

  const buildReviewPrompt = (current: TaskAssignmentDTO) => `Review this assignment draft against its brief. Return only improvement suggestions and the final-review checklist requested by the assignment review schema.
Title: ${task?.title ?? ''}
Subject: ${task?.subject ?? ''}
Due date: ${formatDueDate(task?.dueAt ?? null)}
Target word count: ${current.targetWordCount}

Brief:
${current.brief.slice(0, 2_000)}

Available source notes:
${current.sourceNotes.slice(0, 2_000) || 'No source material supplied.'}

Current draft:
${current.draft.slice(0, 6_000)}`

  const generateWorkspace = async (current: TaskAssignmentDTO) => {
    if (loading) return
    setLoading('generate')
    setAiError('')
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: buildGenerationPrompt(current), mode: 'auto', action: 'assignment-plan', history: [], documents: [], isPlus: true }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Assignment generation failed')
      const generated = parseGeneratedWorkspace(data.reply)
      if (!generated) throw new Error('AirGPT returned an invalid assignment workspace')
      updateAssignment((existing) => ({ ...existing, ...generated, stageDone: { ...EMPTY_STAGE_DONE }, generatedAt: new Date().toISOString() }))
      notify('Assignment workspace generated', 'success')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Assignment generation failed')
    } finally {
      setLoading(null)
    }
  }

  const reviewDraft = async (current: TaskAssignmentDTO) => {
    if (loading || current.draft.trim().length < 80) return
    setLoading('review')
    setAiError('')
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: buildReviewPrompt(current), mode: 'auto', action: 'assignment-review', history: [], documents: [], isPlus: true }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Final review failed')
      const generated = parseGeneratedReview(data.reply)
      if (!generated) throw new Error('AirGPT returned an invalid final review')
      updateAssignment((existing) => ({ ...existing, ...generated, stageDone: { ...existing.stageDone, improvements: false, review: false } }))
      notify('Draft review updated', 'success')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Final review failed')
    } finally {
      setLoading(null)
    }
  }

  const startWorkspace = async () => {
    const brief = briefForm.brief.trim()
    if (!taskId || brief.length < 40) {
      setFormError('Add at least a short paragraph describing the assignment.')
      return
    }
    setStarting(true)
    setFormError('')
    try {
      const response = await fetch(apiUrl(`/api/tasks/${taskId}/assignment`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: brief.slice(0, ASSIGNMENT_MAX.brief),
          sourceNotes: briefForm.sourceNotes.trim().slice(0, ASSIGNMENT_MAX.sourceNotes),
          targetWordCount: Math.min(5_000, Math.max(100, Number(briefForm.targetWordCount) || 1_000)),
        }),
      })
      if (!response.ok) throw new Error('Could not start the assignment workspace.')
      const created = await response.json() as TaskAssignmentDTO
      setAssignment(created)
      void generateWorkspace(created)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not start the assignment workspace.')
    } finally {
      setStarting(false)
    }
  }

  const attachSource = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !assignment) return
    setSourceName(file.name)
    setAiError('')
    try {
      const document = await readDocument(file, createId('assignment-source'))
      updateAssignment((current) => ({ ...current, sourceNotes: `${current.sourceNotes}${current.sourceNotes ? '\n\n' : ''}${document.text}`.slice(0, ASSIGNMENT_MAX.sourceNotes) }))
      notify(`${file.name} added to the assignment sources`, 'success')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AirNexus could not read this source file')
    }
  }

  const toggleStageDone = (stage: AssignmentStage) => {
    if (!assignment) return
    updateAssignment((current) => ({ ...current, stageDone: { ...current.stageDone, [stage]: !current.stageDone[stage] } }))
  }

  if (!task) return null

  return (
    <Modal open={open} title="Assignment workspace" description={`${task.title} · ${task.subject}`} onClose={handleClose} className="max-w-5xl">
      {hydrating ? (
        <div className="grid gap-3 py-6">
          {[0, 1, 2].map((key) => <div key={key} className="premium-skeleton h-16 rounded-2xl" />)}
        </div>
      ) : !assignment ? (
        <div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full bg-white/5 px-3 py-1.5">{task.subject}</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5">Due {formatDueDate(task.dueAt)}</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-300 sm:col-span-2">Assignment brief<textarea value={briefForm.brief} onChange={(event) => setBriefForm((current) => ({ ...current, brief: event.target.value.slice(0, ASSIGNMENT_MAX.brief) }))} placeholder="Paste the task sheet, rubric, question, required structure, and anything your teacher expects…" className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm leading-6 text-white outline-none focus:border-white/40" /></label>
            <label className="text-sm text-slate-300">Target word count<input type="number" min="100" max="5000" value={briefForm.targetWordCount} onChange={(event) => setBriefForm((current) => ({ ...current, targetWordCount: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-white outline-none focus:border-white/40" /></label>
          </div>
          <label className="mt-4 block text-sm text-slate-300">Source notes <span className="text-slate-500">(optional)</span><textarea value={briefForm.sourceNotes} onChange={(event) => setBriefForm((current) => ({ ...current, sourceNotes: event.target.value.slice(0, ASSIGNMENT_MAX.sourceNotes) }))} placeholder="Paste class notes, source details, quotations, or links you have already collected. AirGPT will not invent references." className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm leading-6 text-white outline-none focus:border-white/40" /></label>
          {formError && <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{formError}</p>}
          <button type="button" onClick={() => void startWorkspace()} disabled={starting} className="primary-action mt-5 disabled:cursor-wait disabled:opacity-60">{starting ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Create and generate workspace</button>
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full bg-white/5 px-3 py-1.5">{task.subject}</span>
                <span className="rounded-full bg-white/5 px-3 py-1.5">Due {formatDueDate(task.dueAt)}</span>
                <span className="rounded-full bg-white/5 px-3 py-1.5">{assignment.targetWordCount.toLocaleString()} words</span>
              </div>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void reviewDraft(assignment)} disabled={Boolean(loading) || assignment.draft.trim().length < 80} className="secondary-action">{loading === 'review' ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Review draft</button><button type="button" onClick={() => void generateWorkspace(assignment)} disabled={Boolean(loading)} className="primary-action">{loading === 'generate' ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{assignment.generatedAt ? 'Regenerate' : 'Generate workspace'}</button></div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4"><div className="flex items-end justify-between"><span className="text-xs text-slate-400">Overall progress</span><strong className="text-2xl text-white">{progress}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-white transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-slate-500">{completedStages} of {STAGES.length} stages complete</p></div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{STAGES.map((stage) => { const Icon = stage.icon; const complete = isStageComplete(assignment, stage.id); return <a key={stage.id} href={`#assignment-${stage.id}`} className={cn('rounded-2xl border p-3 text-center transition hover:-translate-y-0.5', complete ? 'border-emerald-300/20 bg-emerald-400/8 text-emerald-200' : 'border-white/8 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-white')}><Icon className="mx-auto size-4" /><span className="mt-2 block text-[11px] font-medium">{stage.label}</span></a> })}</div>
            {aiError && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{aiError}</p>}
          </section>

          <section className="glass rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Assignment context</p><h3 className="mt-1 font-semibold text-white">Brief and source material</h3></div><><input ref={sourceInputRef} type="file" accept={DOCUMENT_ACCEPT} onChange={(event) => void attachSource(event)} className="hidden" /><button type="button" onClick={() => sourceInputRef.current?.click()} className="secondary-action"><Paperclip className="size-4" />Attach source</button></></div>
            {sourceName && <p className="mt-3 text-xs text-emerald-300">Added {sourceName}</p>}
            <div className="mt-4 grid gap-4 xl:grid-cols-2"><label className="text-xs font-medium uppercase tracking-wider text-slate-500">Assignment brief<textarea value={assignment.brief} onChange={(event) => { const value = event.target.value.slice(0, ASSIGNMENT_MAX.brief); updateAssignment((current) => ({ ...current, brief: value }), 1200) }} className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-white/8 bg-slate-950/45 p-4 text-sm normal-case leading-6 tracking-normal text-slate-200 outline-none focus:border-white/35" /></label><label className="text-xs font-medium uppercase tracking-wider text-slate-500">Source notes<textarea value={assignment.sourceNotes} onChange={(event) => { const value = event.target.value.slice(0, ASSIGNMENT_MAX.sourceNotes); updateAssignment((current) => ({ ...current, sourceNotes: value }), 1200) }} placeholder="Add verified source details before regenerating references." className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-white/8 bg-slate-950/45 p-4 text-sm normal-case leading-6 tracking-normal text-slate-200 outline-none focus:border-white/35" /></label></div>
          </section>

          <AssignmentSection id="assignment-checklist" title="Action checklist" eyebrow="Stage 1" icon={ListChecks} complete={isStageComplete(assignment, 'checklist')}>
            {assignment.checklist.length === 0 ? <p className="text-sm text-slate-500">Generate the workspace to create a checklist.</p> : <div className="space-y-2">{assignment.checklist.map((item) => <button key={item.id} type="button" onClick={() => updateAssignment((current) => ({ ...current, checklist: current.checklist.map((candidate) => candidate.id === item.id ? { ...candidate, done: !candidate.done } : candidate) }))} className={cn('flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition', item.done ? 'border-emerald-300/15 bg-emerald-400/7' : 'border-white/8 bg-white/[0.025] hover:border-white/20')}>{item.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /> : <Circle className="mt-0.5 size-5 shrink-0 text-slate-600" />}<span><span className={cn('block text-sm font-medium', item.done ? 'text-slate-500 line-through' : 'text-white')}>{item.title}</span>{item.detail && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>}</span></button>)}</div>}
          </AssignmentSection>

          <AssignmentSection id="assignment-timeline" title="Working timeline" eyebrow="Stage 2" icon={CalendarClock} complete={isStageComplete(assignment, 'timeline')}>
            {assignment.timeline.length === 0 ? <p className="text-sm text-slate-500">Your milestone timeline will appear after generation.</p> : <div className="relative space-y-3 before:absolute before:bottom-5 before:left-[18px] before:top-5 before:w-px before:bg-white/10">{assignment.timeline.map((item) => <button key={item.id} type="button" onClick={() => updateAssignment((current) => ({ ...current, timeline: current.timeline.map((candidate) => candidate.id === item.id ? { ...candidate, done: !candidate.done } : candidate) }))} className="relative flex w-full items-start gap-4 rounded-2xl border border-white/8 bg-slate-950/25 p-4 text-left hover:border-white/20"><span className={cn('relative z-10 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border', item.done ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-slate-900 text-slate-500')}>{item.done ? <Check className="size-4" /> : <Target className="size-4" />}</span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className={cn('text-sm', item.done ? 'text-slate-500 line-through' : 'text-white')}>{item.milestone}</strong>{item.targetDate && <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-white">{item.targetDate}</span>}</span>{item.detail && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>}</span></button>)}</div>}
          </AssignmentSection>

          <AssignmentSection id="assignment-research" title="Research notes" eyebrow="Stage 3" icon={BookOpen} complete={isStageComplete(assignment, 'research')} action={assignment.researchNotes.length > 0 && <button type="button" onClick={() => toggleStageDone('research')} className="secondary-action text-xs">{assignment.stageDone.research ? 'Reopen' : 'Mark complete'}</button>}>
            {assignment.researchNotes.length === 0 ? <p className="text-sm text-slate-500">Research themes and evidence notes will appear here.</p> : <div className="grid gap-3 xl:grid-cols-2">{assignment.researchNotes.map((note) => <label key={note.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><input aria-label="Research note heading" value={note.heading} onChange={(event) => { const value = event.target.value; updateAssignment((current) => ({ ...current, researchNotes: current.researchNotes.map((candidate) => candidate.id === note.id ? { ...candidate, heading: value } : candidate) }), 1200) }} className="w-full bg-transparent text-sm font-semibold text-white outline-none" /><textarea aria-label={`${note.heading} research note`} value={note.content} onChange={(event) => { const value = event.target.value; updateAssignment((current) => ({ ...current, researchNotes: current.researchNotes.map((candidate) => candidate.id === note.id ? { ...candidate, content: value } : candidate) }), 1200) }} className="mt-3 min-h-28 w-full resize-y bg-transparent text-sm leading-6 text-slate-400 outline-none" /></label>)}</div>}
          </AssignmentSection>

          <AssignmentSection id="assignment-draft" title="Working draft" eyebrow="Stage 4" icon={PenLine} complete={isStageComplete(assignment, 'draft')} action={assignment.draft && <button type="button" onClick={() => toggleStageDone('draft')} className="secondary-action text-xs">{assignment.stageDone.draft ? 'Reopen' : 'Mark complete'}</button>}>
            <textarea aria-label="Assignment draft" value={assignment.draft} onChange={(event) => { const value = event.target.value.slice(0, ASSIGNMENT_MAX.draft); updateAssignment((current) => ({ ...current, draft: value, stageDone: { ...current.stageDone, draft: false } }), 1200) }} placeholder="The AI-generated draft will appear here. Edit it in your own voice before final review." className="min-h-[420px] w-full resize-y rounded-2xl border border-white/8 bg-slate-950/45 p-5 text-sm leading-7 text-slate-200 outline-none focus:border-white/35" />
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{assignment.draft.trim() ? assignment.draft.trim().split(/\s+/).length.toLocaleString() : 0} words</span><span>Target: {assignment.targetWordCount.toLocaleString()} words</span></div>
          </AssignmentSection>

          <AssignmentSection id="assignment-references" title="References" eyebrow="Stage 5" icon={Library} complete={isStageComplete(assignment, 'references')} action={assignment.references.length > 0 && <button type="button" onClick={() => toggleStageDone('references')} className="secondary-action text-xs">{assignment.stageDone.references ? 'Reopen' : 'Mark checked'}</button>}>
            {assignment.references.length === 0 ? <p className="text-sm text-slate-500">No references yet. Add source details above, then regenerate. AirGPT will not fabricate citations.</p> : <div className="space-y-3">{assignment.references.map((reference) => <div key={reference.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider', reference.status === 'verified' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200')}>{reference.status === 'verified' ? 'From supplied source' : 'Source needed'}</span></div><textarea aria-label="Reference citation" value={reference.citation} onChange={(event) => { const value = event.target.value; updateAssignment((current) => ({ ...current, references: current.references.map((candidate) => candidate.id === reference.id ? { ...candidate, citation: value } : candidate), stageDone: { ...current.stageDone, references: false } }), 1200) }} className="mt-3 min-h-16 w-full resize-y bg-transparent text-sm leading-6 text-slate-200 outline-none" />{reference.note && <p className="mt-2 text-xs leading-5 text-slate-500">{reference.note}</p>}</div>)}</div>}
          </AssignmentSection>

          <AssignmentSection id="assignment-improvements" title="Improvement suggestions" eyebrow="Stage 6" icon={WandSparkles} complete={isStageComplete(assignment, 'improvements')} action={<button type="button" onClick={() => void reviewDraft(assignment)} disabled={Boolean(loading) || assignment.draft.trim().length < 80} className="secondary-action text-xs"><Sparkles className="size-3.5" />Refresh review</button>}>
            {assignment.improvementSuggestions.length === 0 ? <p className="text-sm text-slate-500">Review the draft to receive focused improvement suggestions.</p> : <div className="space-y-3">{assignment.improvementSuggestions.map((suggestion) => <button key={suggestion.id} type="button" onClick={() => updateAssignment((current) => ({ ...current, improvementSuggestions: current.improvementSuggestions.map((candidate) => candidate.id === suggestion.id ? { ...candidate, applied: !candidate.applied } : candidate) }))} className={cn('flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition', suggestion.applied ? 'border-emerald-300/15 bg-emerald-400/7' : 'border-white/8 bg-white/[0.025] hover:border-white/20')}>{suggestion.applied ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /> : <Sparkles className="mt-0.5 size-5 shrink-0 text-zinc-300" />}<span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className={cn('text-sm', suggestion.applied ? 'text-slate-500 line-through' : 'text-white')}>{suggestion.title}</strong><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', priorityClasses(suggestion.priority))}>{suggestion.priority}</span></span><span className="mt-1 block text-xs leading-5 text-slate-500">{suggestion.detail}</span></span></button>)}</div>}
          </AssignmentSection>

          <AssignmentSection id="assignment-review" title="Final review" eyebrow="Stage 7" icon={ShieldCheck} complete={isStageComplete(assignment, 'review')}>
            {assignment.finalReview.length === 0 ? <p className="text-sm text-slate-500">Run the final review after editing your draft.</p> : <div className="grid gap-3 xl:grid-cols-2">{assignment.finalReview.map((review) => { const complete = review.status === 'pass' || review.resolved; return <button key={review.id} type="button" onClick={() => updateAssignment((current) => ({ ...current, finalReview: current.finalReview.map((candidate) => candidate.id === review.id ? { ...candidate, resolved: !candidate.resolved } : candidate) }))} className={cn('rounded-2xl border p-4 text-left transition', complete ? 'border-emerald-300/15 bg-emerald-400/7' : 'border-amber-300/15 bg-amber-400/7')}><div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{review.criterion}</strong>{complete ? <CheckCircle2 className="size-5 shrink-0 text-emerald-300" /> : <AlertTriangle className="size-5 shrink-0 text-amber-300" />}</div><p className="mt-2 text-xs leading-5 text-slate-500">{review.detail}</p><span className="mt-3 inline-flex text-[10px] font-semibold uppercase tracking-wider text-slate-400">{complete ? 'Ready' : 'Needs attention'}</span></button> })}</div>}
          </AssignmentSection>
        </div>
      )}
    </Modal>
  )
}
