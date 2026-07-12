import type { RoomTaskStatus } from './types'

export type TaskNotifyDecision = { type: 'task_assigned' | 'task_completed'; userId: string } | null

/**
 * Pure decision logic for when a task mutation should dispatch a
 * notification — separated from lib/rooms/tasks.ts (which does the actual
 * DB/fetch work) so the rules themselves are unit-testable without a
 * Supabase connection.
 */

/** Notify the new assignee, unless they assigned it to themselves or nothing changed. */
export function decideAssignmentNotify(previousAssigneeId: string | null, nextAssigneeId: string | null, actorId: string): TaskNotifyDecision {
  if (nextAssigneeId && nextAssigneeId !== previousAssigneeId && nextAssigneeId !== actorId) {
    return { type: 'task_assigned', userId: nextAssigneeId }
  }
  return null
}

/** Notify the assignee when someone else completes their task. */
export function decideCompletionNotify(
  previousStatus: RoomTaskStatus,
  nextStatus: RoomTaskStatus,
  assigneeId: string | null,
  actorId: string,
): TaskNotifyDecision {
  if (nextStatus === 'done' && previousStatus !== 'done' && assigneeId && assigneeId !== actorId) {
    return { type: 'task_completed', userId: assigneeId }
  }
  return null
}
