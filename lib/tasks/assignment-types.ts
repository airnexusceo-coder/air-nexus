export type AssignmentStage = 'checklist' | 'timeline' | 'research' | 'draft' | 'references' | 'improvements' | 'review'
export type AssignmentPriority = 'high' | 'medium' | 'low'
export type ReferenceStatus = 'verified' | 'needs-source'
export type ReviewStatus = 'pass' | 'review'

export type ChecklistItem = { id: string; title: string; detail: string; done: boolean }
export type TimelineItem = { id: string; milestone: string; targetDate: string; detail: string; done: boolean }
export type ResearchNote = { id: string; heading: string; content: string }
export type ReferenceItem = { id: string; citation: string; note: string; status: ReferenceStatus }
export type ImprovementSuggestion = { id: string; title: string; detail: string; priority: AssignmentPriority; applied: boolean }
export type FinalReviewItem = { id: string; criterion: string; detail: string; status: ReviewStatus; resolved: boolean }

export type TaskAssignmentDTO = {
  taskId: string
  brief: string
  sourceNotes: string
  targetWordCount: number
  checklist: ChecklistItem[]
  timeline: TimelineItem[]
  researchNotes: ResearchNote[]
  draft: string
  references: ReferenceItem[]
  improvementSuggestions: ImprovementSuggestion[]
  finalReview: FinalReviewItem[]
  stageDone: Record<AssignmentStage, boolean>
  generatedAt: string | null
  createdAt: string
  updatedAt: string
}

export const ASSIGNMENT_STAGES: AssignmentStage[] = ['checklist', 'timeline', 'research', 'draft', 'references', 'improvements', 'review']

export const EMPTY_STAGE_DONE: Record<AssignmentStage, boolean> = {
  checklist: false,
  timeline: false,
  research: false,
  draft: false,
  references: false,
  improvements: false,
  review: false,
}

export const ASSIGNMENT_MAX = {
  brief: 6_000,
  sourceNotes: 12_000,
  draft: 24_000,
}

export function isStageComplete(assignment: Pick<TaskAssignmentDTO, 'checklist' | 'timeline' | 'improvementSuggestions' | 'finalReview' | 'stageDone'>, stage: AssignmentStage): boolean {
  if (stage === 'checklist') return assignment.checklist.length > 0 && assignment.checklist.every((item) => item.done)
  if (stage === 'timeline') return assignment.timeline.length > 0 && assignment.timeline.every((item) => item.done)
  if (stage === 'improvements') return assignment.improvementSuggestions.length > 0 && assignment.improvementSuggestions.every((item) => item.applied)
  if (stage === 'review') return assignment.finalReview.length > 0 && assignment.finalReview.every((item) => item.status === 'pass' || item.resolved)
  return assignment.stageDone[stage]
}
