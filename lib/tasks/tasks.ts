import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'

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
  return toDTO(row)
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
  return toDTO(row)
}

export async function deleteTask(auth: ServerAuthSession, taskId: string): Promise<void> {
  const response = await supabaseRestFetch(auth.accessToken, `/tasks?id=eq.${encode(taskId)}&user_id=eq.${encode(auth.user.id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
  const rows = await readSupabaseRestJson<TaskRow[]>(response, 'Could not delete task')
  if (rows.length === 0) throw new SupabaseRequestError('Task not found.', 404)
}
