import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import type { ServerAuthSession } from '@/lib/supabase/server'
import { encode, getRoomName, requireRoomMembership, resolveDisplayNames } from './rooms'
import { decideAssignmentNotify, decideCompletionNotify } from './notify-decisions'
import type { RoomTaskDTO, RoomTaskStatus } from './types'

type TaskRow = {
  id: string
  room_id: string
  title: string
  status: RoomTaskStatus
  assignee_id: string | null
  created_by: string
  completed_by: string | null
  completed_at: string | null
  created_at: string
}

async function toDTOs(rows: TaskRow[]): Promise<RoomTaskDTO[]> {
  const assigneeIds = rows.map((row) => row.assignee_id).filter((id): id is string => id != null)
  const names = await resolveDisplayNames(assigneeIds)
  return rows.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    title: row.title,
    status: row.status,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_id ? (names.get(row.assignee_id) ?? 'AirNexus student') : null,
    createdBy: row.created_by,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }))
}

/** Best-effort — a failed notification insert should never fail the task mutation itself. */
async function notify(userId: string, type: 'task_assigned' | 'task_completed', title: string, body: string, roomId: string, taskId: string) {
  await supabaseServiceFetch('/rpc/airnexus_notify', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId, p_type: type, p_title: title, p_body: body, p_room_id: roomId, p_task_id: taskId }),
  }).catch(() => undefined)
}

export async function listRoomTasks(auth: ServerAuthSession, roomId: string): Promise<RoomTaskDTO[]> {
  await requireRoomMembership(auth, roomId)
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/room_tasks?room_id=eq.${encode(roomId)}&select=id,room_id,title,status,assignee_id,created_by,completed_by,completed_at,created_at&order=created_at.asc`,
  )
  const rows = await readSupabaseRestJson<TaskRow[]>(response, 'Failed to load tasks')
  return toDTOs(rows)
}

export async function createRoomTask(auth: ServerAuthSession, roomId: string, title: string, assigneeId?: string | null): Promise<RoomTaskDTO> {
  const trimmed = typeof title === 'string' ? title.trim() : ''
  if (!trimmed) throw new SupabaseRequestError('Enter a task title.', 400)
  if (trimmed.length > 200) throw new SupabaseRequestError('Task title is too long.', 400)

  const memberRows = await requireRoomMembership(auth, roomId)
  if (assigneeId && !memberRows.some((m) => m.user_id === assigneeId)) {
    throw new SupabaseRequestError('You can only assign tasks to room members.', 400)
  }

  const response = await supabaseRestFetch(auth.accessToken, '/room_tasks', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ room_id: roomId, title: trimmed, created_by: auth.user.id, assignee_id: assigneeId || null }),
  })
  const rows = await readSupabaseRestJson<TaskRow[]>(response, 'Could not create task')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Could not create task.', 502)

  const assignmentDecision = decideAssignmentNotify(null, assigneeId ?? null, auth.user.id)
  if (assignmentDecision) {
    const roomName = await getRoomName(roomId)
    await notify(assignmentDecision.userId, assignmentDecision.type, `New task in ${roomName}`, trimmed, roomId, row.id)
  }

  const [dto] = await toDTOs([row])
  return dto
}

export type RoomTaskPatch = { title?: string; status?: RoomTaskStatus; assigneeId?: string | null }

export async function updateRoomTask(auth: ServerAuthSession, roomId: string, taskId: string, patch: RoomTaskPatch): Promise<RoomTaskDTO> {
  const memberRows = await requireRoomMembership(auth, roomId)

  const existingResponse = await supabaseRestFetch(
    auth.accessToken,
    `/room_tasks?id=eq.${encode(taskId)}&room_id=eq.${encode(roomId)}&select=id,room_id,title,status,assignee_id,created_by,completed_by,completed_at,created_at`,
  )
  const existingRows = await readSupabaseRestJson<TaskRow[]>(existingResponse, 'Task not found')
  const existing = existingRows[0]
  if (!existing) throw new SupabaseRequestError('Task not found.', 404)

  const update: Record<string, unknown> = {}
  if (typeof patch.title === 'string') {
    const trimmed = patch.title.trim()
    if (!trimmed) throw new SupabaseRequestError('Enter a task title.', 400)
    if (trimmed.length > 200) throw new SupabaseRequestError('Task title is too long.', 400)
    update.title = trimmed
  }
  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId && !memberRows.some((m) => m.user_id === patch.assigneeId)) {
      throw new SupabaseRequestError('You can only assign tasks to room members.', 400)
    }
    update.assignee_id = patch.assigneeId
  }
  if (patch.status) {
    update.status = patch.status
    if (patch.status === 'done' && existing.status !== 'done') {
      update.completed_by = auth.user.id
      update.completed_at = new Date().toISOString()
    } else if (patch.status !== 'done') {
      update.completed_by = null
      update.completed_at = null
    }
  }

  const response = await supabaseRestFetch(auth.accessToken, `/room_tasks?id=eq.${encode(taskId)}&room_id=eq.${encode(roomId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(update),
  })
  const rows = await readSupabaseRestJson<TaskRow[]>(response, 'Could not update task')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Task not found.', 404)

  let roomName: string | null = null
  const newAssignee = update.assignee_id !== undefined ? (update.assignee_id as string | null) : existing.assignee_id
  const assignmentDecision = update.assignee_id !== undefined
    ? decideAssignmentNotify(existing.assignee_id, newAssignee, auth.user.id)
    : null
  if (assignmentDecision) {
    roomName = roomName ?? (await getRoomName(roomId))
    await notify(assignmentDecision.userId, assignmentDecision.type, `New task in ${roomName}`, row.title, roomId, row.id)
  }
  const completionDecision = decideCompletionNotify(existing.status, row.status, row.assignee_id, auth.user.id)
  if (completionDecision) {
    roomName = roomName ?? (await getRoomName(roomId))
    await notify(completionDecision.userId, completionDecision.type, `Task completed in ${roomName}`, row.title, roomId, row.id)
  }

  const [dto] = await toDTOs([row])
  return dto
}

export async function deleteRoomTask(auth: ServerAuthSession, roomId: string, taskId: string): Promise<void> {
  await requireRoomMembership(auth, roomId)
  const response = await supabaseRestFetch(auth.accessToken, `/room_tasks?id=eq.${encode(taskId)}&room_id=eq.${encode(roomId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
  const rows = await readSupabaseRestJson<unknown[]>(response, 'Could not delete task')
  if (rows.length === 0) throw new SupabaseRequestError('Task not found.', 404)
}
