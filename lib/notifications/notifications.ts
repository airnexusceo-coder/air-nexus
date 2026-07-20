import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError } from '@/lib/supabase/server'
import type { ServerAuthSession } from '@/lib/supabase/server'
import type { NotificationDTO, NotificationType } from './types'

function encode(value: string) {
  return encodeURIComponent(value)
}

type NotificationRow = {
  id: string
  type: string
  title: string
  body: string
  room_id: string | null
  task_id: string | null
  personal_task_id: string | null
  read: boolean
  created_at: string
}

function toDTO(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    roomId: row.room_id,
    taskId: row.task_id,
    personalTaskId: row.personal_task_id,
    read: row.read,
    createdAt: row.created_at,
  }
}

export async function listNotifications(auth: ServerAuthSession, limit = 30): Promise<NotificationDTO[]> {
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/notifications?select=id,type,title,body,room_id,task_id,personal_task_id,read,created_at&order=created_at.desc&limit=${limit}`,
  )
  const rows = await readSupabaseRestJson<NotificationRow[]>(response, 'Failed to load notifications')
  return rows.map(toDTO)
}

/**
 * Creates a notification for the CALLER's own account about their own
 * personal task (high priority, due soon) — unlike room-task notifications
 * (lib/rooms/tasks.ts), the actor and recipient are the same user here, so
 * this writes with the user's own token under RLS rather than needing a
 * service-role RPC. Never throws — a missed reminder is not worth failing
 * the task create/update it's attached to.
 */
export async function createPersonalTaskNotification(
  auth: ServerAuthSession,
  type: 'task_high_priority' | 'task_due_soon',
  title: string,
  body: string,
  personalTaskId: string,
): Promise<void> {
  await supabaseRestFetch(auth.accessToken, '/notifications', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: auth.user.id, type, title, body, personal_task_id: personalTaskId }),
  }).catch(() => undefined)
}

export async function hasNotificationForTask(auth: ServerAuthSession, type: 'task_high_priority' | 'task_due_soon', personalTaskId: string): Promise<boolean> {
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/notifications?user_id=eq.${encode(auth.user.id)}&type=eq.${encode(type)}&personal_task_id=eq.${encode(personalTaskId)}&select=id&limit=1`,
  )
  if (!response.ok) return false
  const rows = await readSupabaseRestJson<Array<{ id: string }>>(response, 'Could not check existing notifications').catch(() => [])
  return rows.length > 0
}

export async function markNotificationRead(auth: ServerAuthSession, notificationId: string, read: boolean): Promise<void> {
  if (typeof notificationId !== 'string' || !notificationId) throw new SupabaseRequestError('Notification id required.', 400)
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/notifications?id=eq.${encode(notificationId)}&user_id=eq.${encode(auth.user.id)}`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ read: Boolean(read) }) },
  )
  const rows = await readSupabaseRestJson<unknown[]>(response, 'Could not update notification')
  if (rows.length === 0) throw new SupabaseRequestError('Notification not found.', 404)
}

export async function markAllNotificationsRead(auth: ServerAuthSession): Promise<void> {
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/notifications?user_id=eq.${encode(auth.user.id)}&read=eq.false`,
    { method: 'PATCH', body: JSON.stringify({ read: true }) },
  )
  if (!response.ok) await readSupabaseRestJson(response, 'Could not update notifications')
}
