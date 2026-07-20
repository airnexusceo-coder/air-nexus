import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'
import {
  EMPTY_STAGE_DONE,
  type AssignmentStage,
  type ChecklistItem,
  type FinalReviewItem,
  type ImprovementSuggestion,
  type ReferenceItem,
  type ResearchNote,
  type TaskAssignmentDTO,
  type TimelineItem,
} from './assignment-types'

/**
 * Persists the Assignment Workspace (checklist/timeline/research/draft/
 * references/improvements/review) as a 1:1 extension of a personal task —
 * backed by migration 0023 (task_assignments). Replaces the old
 * localStorage-only assignment storage. All calls use the caller's own
 * token; RLS (owner-only) is the access gate, plus an explicit task
 * ownership check since task_id is a foreign key the caller controls.
 */

function encode(value: string) {
  return encodeURIComponent(value)
}

type AssignmentRow = {
  task_id: string
  brief: string
  source_notes: string
  target_word_count: number
  checklist: unknown
  timeline: unknown
  research_notes: unknown
  draft: string
  references: unknown
  improvement_suggestions: unknown
  final_review: unknown
  stage_done: unknown
  generated_at: string | null
  created_at: string
  updated_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): ChecklistItem[] => {
    if (!isRecord(item)) return []
    const title = cleanText(item.title, 180)
    if (!title) return []
    return [{ id: cleanText(item.id, 60) || createId('check'), title, detail: cleanText(item.detail, 500), done: Boolean(item.done) }]
  }).slice(0, 14)
}

function sanitizeTimeline(value: unknown): TimelineItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): TimelineItem[] => {
    if (!isRecord(item)) return []
    const milestone = cleanText(item.milestone, 180)
    if (!milestone) return []
    return [{ id: cleanText(item.id, 60) || createId('timeline'), milestone, targetDate: cleanText(item.targetDate, 40), detail: cleanText(item.detail, 500), done: Boolean(item.done) }]
  }).slice(0, 10)
}

function sanitizeResearchNotes(value: unknown): ResearchNote[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): ResearchNote[] => {
    if (!isRecord(item)) return []
    const heading = cleanText(item.heading, 180)
    const content = cleanText(item.content, 2_500)
    return heading && content ? [{ id: cleanText(item.id, 60) || createId('research'), heading, content }] : []
  }).slice(0, 10)
}

function sanitizeReferences(value: unknown): ReferenceItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): ReferenceItem[] => {
    if (!isRecord(item)) return []
    const citation = cleanText(item.citation, 700)
    if (!citation) return []
    return [{ id: cleanText(item.id, 60) || createId('reference'), citation, note: cleanText(item.note, 700), status: item.status === 'verified' ? 'verified' : 'needs-source' }]
  }).slice(0, 14)
}

function sanitizeImprovementSuggestions(value: unknown): ImprovementSuggestion[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): ImprovementSuggestion[] => {
    if (!isRecord(item)) return []
    const title = cleanText(item.title, 180)
    if (!title) return []
    const priority = item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium'
    return [{ id: cleanText(item.id, 60) || createId('improvement'), title, detail: cleanText(item.detail, 900), priority, applied: Boolean(item.applied) }]
  }).slice(0, 12)
}

function sanitizeFinalReview(value: unknown): FinalReviewItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): FinalReviewItem[] => {
    if (!isRecord(item)) return []
    const criterion = cleanText(item.criterion, 180)
    if (!criterion) return []
    return [{ id: cleanText(item.id, 60) || createId('review'), criterion, detail: cleanText(item.detail, 900), status: item.status === 'pass' ? 'pass' : 'review', resolved: Boolean(item.resolved) }]
  }).slice(0, 12)
}

function sanitizeStageDone(value: unknown): Record<AssignmentStage, boolean> {
  const result = { ...EMPTY_STAGE_DONE }
  if (!isRecord(value)) return result
  for (const key of Object.keys(EMPTY_STAGE_DONE) as AssignmentStage[]) {
    result[key] = Boolean(value[key])
  }
  return result
}

function toDTO(row: AssignmentRow): TaskAssignmentDTO {
  return {
    taskId: row.task_id,
    brief: row.brief,
    sourceNotes: row.source_notes,
    targetWordCount: row.target_word_count,
    checklist: sanitizeChecklist(row.checklist),
    timeline: sanitizeTimeline(row.timeline),
    researchNotes: sanitizeResearchNotes(row.research_notes),
    draft: row.draft,
    references: sanitizeReferences(row.references),
    improvementSuggestions: sanitizeImprovementSuggestions(row.improvement_suggestions),
    finalReview: sanitizeFinalReview(row.final_review),
    stageDone: sanitizeStageDone(row.stage_done),
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function assertTaskOwnership(auth: ServerAuthSession, taskId: string): Promise<void> {
  const response = await supabaseRestFetch(auth.accessToken, `/tasks?id=eq.${encode(taskId)}&user_id=eq.${encode(auth.user.id)}&select=id`)
  const rows = await readSupabaseRestJson<Array<{ id: string }>>(response, 'Could not verify task')
  if (rows.length === 0) throw new SupabaseRequestError('Task not found.', 404)
}

export async function getTaskAssignment(auth: ServerAuthSession, taskId: string): Promise<TaskAssignmentDTO | null> {
  await assertTaskOwnership(auth, taskId)
  const response = await supabaseRestFetch(auth.accessToken, `/task_assignments?task_id=eq.${encode(taskId)}&user_id=eq.${encode(auth.user.id)}&select=*&limit=1`)
  const rows = await readSupabaseRestJson<AssignmentRow[]>(response, 'Could not load assignment workspace')
  const row = rows[0]
  return row ? toDTO(row) : null
}

export async function upsertTaskAssignment(auth: ServerAuthSession, taskId: string, patch: Record<string, unknown>): Promise<TaskAssignmentDTO> {
  await assertTaskOwnership(auth, taskId)
  const body: Record<string, unknown> = { task_id: taskId, user_id: auth.user.id }
  if (patch.brief !== undefined) body.brief = cleanText(patch.brief, 6_000)
  if (patch.sourceNotes !== undefined) body.source_notes = cleanText(patch.sourceNotes, 12_000)
  if (patch.targetWordCount !== undefined) body.target_word_count = Math.min(5_000, Math.max(100, Number(patch.targetWordCount) || 1_000))
  if (patch.checklist !== undefined) body.checklist = sanitizeChecklist(patch.checklist)
  if (patch.timeline !== undefined) body.timeline = sanitizeTimeline(patch.timeline)
  if (patch.researchNotes !== undefined) body.research_notes = sanitizeResearchNotes(patch.researchNotes)
  if (patch.draft !== undefined) body.draft = cleanText(patch.draft, 24_000)
  if (patch.references !== undefined) body.references = sanitizeReferences(patch.references)
  if (patch.improvementSuggestions !== undefined) body.improvement_suggestions = sanitizeImprovementSuggestions(patch.improvementSuggestions)
  if (patch.finalReview !== undefined) body.final_review = sanitizeFinalReview(patch.finalReview)
  if (patch.stageDone !== undefined) body.stage_done = sanitizeStageDone(patch.stageDone)
  if (patch.generatedAt !== undefined) body.generated_at = typeof patch.generatedAt === 'string' ? patch.generatedAt : null

  const response = await supabaseRestFetch(auth.accessToken, '/task_assignments?on_conflict=task_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  })
  const rows = await readSupabaseRestJson<AssignmentRow[]>(response, 'Could not save assignment workspace')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Could not save assignment workspace.', 502)
  return toDTO(row)
}
