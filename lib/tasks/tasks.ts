import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'
import { createPersonalTaskNotification, hasNotificationForTask } from '@/lib/notifications/notifications'

/**
 * Real, persisted personal study tasks — backed by migration 0010. Replaces
 * the old hardcoded in-memory seed array. All calls use the caller's own
 * token; RLS (owner-only) is the only access gate.
 */

export type TaskPriority = 'High' | 'Medium' | 'Low'
export type TaskStatus = 'Todo' | 'In Progress' | 'Done'

export type TaskDTO = {
  id: string
  title: string
  subject: string
  priority: TaskPriority
  status: TaskStatus
  dueAt: string | null
  createdAt: string
  updatedAt: string
}

function encode(value: string) {
  return encodeURIComponent(value)
}

type TaskRow = {
  id: string
  title: string
  subject: string
  priority: string
  status: string
  due_at: string | null
  created_at: string
  updated_at: string
}

function toPriority(value: string): TaskPriority {
  return value === 'High' || value === 'Low' ? value : 'Medium'
}

function toStatus(value: string): TaskStatus {
  return value === 'In Progress' || value === 'Done' ? value : 'Todo'
}

function toDTO(row: TaskRow): TaskDTO {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    priority: toPriority(row.priority),
    status: toStatus(row.status),
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function sanitizeTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim().slice(0, 200) : ''
  if (!title) throw new SupabaseRequestError('A task title is required.', 400)
  return title
}

function sanitizeSubject(value: unknown): string {
  const subject = typeof value === 'string' ? value.trim().slice(0, 80) : ''
  return subject || 'General'
}

function sanitizePriority(value: unknown): TaskPriority {
  return value === 'High' || value === 'Low' ? value : 'Medium'
}

function sanitizeStatus(value: unknown): TaskStatus {
  return value === 'In Progress' || value === 'Done' ? value : 'Todo'
}

function sanitizeDueAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function listTasks(auth: ServerAuthSession): Promise<TaskDTO[]> {
  const response = await supabaseRestFetch(auth.accessToken, `/tasks?user_id=eq.${encode(auth.user.id)}&select=*&order=created_at.desc`)
  const rows = await readSupabaseRestJson<TaskRow[]>(response, 'Could not load tasks')
  return rows.map(toDTO)
}

export async function createTask(
  auth: ServerAuthSession,
  input: { title?: unknown; subject?: unknown; priority?: unknown; dueAt?: unknown },
): Promise<TaskDTO> {
  const response = await supabaseRestFetch(auth.accessToken, '/tasks', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: auth.user.id,
      title: sanitizeTitle(input.title),
      subject: sanitizeSubject(input.subject),
      priority: sanitizePriority(input.priority),
      due_at: sanitizeDueAt(input.dueAt),
    }),
  })
  const rows = await readSupabaseRestJson<TaskRow[]>(response, 'Could not create task')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Could not create task.', 502)
  const task = toDTO(row)
  if (task.priority === 'High') {
    void createPersonalTaskNotification(auth, 'task_high_priority', 'High priority task', `"${task.title}" was marked high priority.`, task.id)
  }
  return task
}

export async function updateTask(
  auth: ServerAuthSession,
  taskId: string,
  patch: { title?: unknown; subject?: unknown; priority?: unknown; status?: unknown; dueAt?: unknown },
): Promise<TaskDTO> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = sanitizeTitle(patch.title)
  if (patch.subject !== undefined) body.subject = sanitizeSubject(patch.subject)
  if (patch.priority !== undefined) body.priority = sanitizePriority(patch.priority)
  if (patch.status !== undefined) body.status = sanitizeStatus(patch.status)
  if (patch.dueAt !== undefined) body.due_at = sanitizeDueAt(patch.dueAt)
  if (Object.keys(body).length === 0) throw new SupabaseRequestError('Nothing to update.', 400)

  const response = await supabaseRestFetch(auth.accessToken, `/tasks?id=eq.${encode(taskId)}&user_id=eq.${encode(auth.user.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  const rows = await readSupabaseRestJson<TaskRow[]>(response, 'Could not update task')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Task not found.', 404)
  const task = toDTO(row)
  if (patch.priority !== undefined && task.priority === 'High') {
    void createPersonalTaskNotification(auth, 'task_high_priority', 'High priority task', `"${task.title}" was marked high priority.`, task.id)
  }
  return task
}

/**
 * Best-effort reminder pass for High-priority, not-yet-Done tasks due within
 * 24 hours — called when the Tasks page loads (see /api/tasks GET) rather
 * than on a cron, since that is the only real "check-in" moment this app
 * has. Skips tasks that already have a due-soon notification so reopening
 * the page repeatedly does not spam duplicates.
 */
export async function checkDueSoonTaskNotifications(auth: ServerAuthSession, tasks: TaskDTO[]): Promise<void> {
  const now = Date.now()
  const soon = now + 24 * 60 * 60 * 1000
  const candidates = tasks.filter((task) => task.priority === 'High' && task.status !== 'Done' && task.dueAt && new Date(task.dueAt).getTime() >= now && new Date(task.dueAt).getTime() <= soon)
  for (const task of candidates) {
    const alreadyNotified = await hasNotificationForTask(auth, 'task_due_soon', task.id)
    if (alreadyNotified) continue
    await createPersonalTaskNotification(auth, 'task_due_soon', 'Task due soon', `"${task.title}" is due ${formatDueSoon(task.dueAt)}.`, task.id)
  }
}

function formatDueSoon(dueAt: string | null): string {
  if (!dueAt) return 'soon'
  const date = new Date(dueAt)
  const hours = Math.round((date.getTime() - Date.now()) / (60 * 60 * 1000))
  if (hours <= 1) return 'within the hour'
  if (hours < 24) return `in about ${hours} hours`
  return 'tomorrow'
}

export async function deleteTask(auth: ServerAuthSession, taskId: string): Promise<void> {
  const response = await supabaseRestFetch(auth.accessToken, `/tasks?id=eq.${encode(taskId)}&user_id=eq.${encode(auth.user.id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
  const rows = await readSupabaseRestJson<TaskRow[]>(response, 'Could not delete task')
  if (rows.length === 0) throw new SupabaseRequestError('Task not found.', 404)
}
