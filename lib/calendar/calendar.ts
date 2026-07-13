import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'

/**
 * Real, persisted personal calendar events — backed by migration 0013.
 * Replaces the Calendar page's hardcoded "June 2026" seed array. All calls
 * use the caller's own token; RLS (owner-only) is the only access gate.
 */

export type CalendarEventType = 'Deadline' | 'Exam' | 'Study'

export type CalendarEventDTO = {
  id: string
  title: string
  type: CalendarEventType
  eventDate: string
  time: string
  taskId: string | null
  createdAt: string
  updatedAt: string
}

function encode(value: string) {
  return encodeURIComponent(value)
}

type CalendarEventRow = {
  id: string
  title: string
  event_type: string
  event_date: string
  time_label: string
  task_id: string | null
  created_at: string
  updated_at: string
}

function toType(value: string): CalendarEventType {
  return value === 'Deadline' || value === 'Exam' ? value : 'Study'
}

function toDTO(row: CalendarEventRow): CalendarEventDTO {
  return {
    id: row.id,
    title: row.title,
    type: toType(row.event_type),
    eventDate: row.event_date,
    time: row.time_label,
    taskId: row.task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function sanitizeTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim().slice(0, 200) : ''
  if (!title) throw new SupabaseRequestError('An event title is required.', 400)
  return title
}

function sanitizeType(value: unknown): CalendarEventType {
  return value === 'Deadline' || value === 'Exam' ? value : 'Study'
}

function sanitizeEventDate(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(raw).getTime())) {
    throw new SupabaseRequestError('A valid event date is required.', 400)
  }
  return raw
}

function sanitizeTime(value: unknown): string {
  const time = typeof value === 'string' ? value.trim().slice(0, 40) : ''
  return time || 'Any time'
}

function sanitizeTaskId(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

export async function listCalendarEvents(auth: ServerAuthSession): Promise<CalendarEventDTO[]> {
  const response = await supabaseRestFetch(auth.accessToken, `/calendar_events?user_id=eq.${encode(auth.user.id)}&select=*&order=event_date.asc`)
  const rows = await readSupabaseRestJson<CalendarEventRow[]>(response, 'Could not load calendar events')
  return rows.map(toDTO)
}

export async function createCalendarEvent(
  auth: ServerAuthSession,
  input: { title?: unknown; type?: unknown; eventDate?: unknown; time?: unknown; taskId?: unknown },
): Promise<CalendarEventDTO> {
  const response = await supabaseRestFetch(auth.accessToken, '/calendar_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: auth.user.id,
      title: sanitizeTitle(input.title),
      event_type: sanitizeType(input.type),
      event_date: sanitizeEventDate(input.eventDate),
      time_label: sanitizeTime(input.time),
      task_id: sanitizeTaskId(input.taskId),
    }),
  })
  const rows = await readSupabaseRestJson<CalendarEventRow[]>(response, 'Could not create event')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Could not create event.', 502)
  return toDTO(row)
}

export async function deleteCalendarEvent(auth: ServerAuthSession, eventId: string): Promise<void> {
  const response = await supabaseRestFetch(auth.accessToken, `/calendar_events?id=eq.${encode(eventId)}&user_id=eq.${encode(auth.user.id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
  const rows = await readSupabaseRestJson<CalendarEventRow[]>(response, 'Could not delete event')
  if (rows.length === 0) throw new SupabaseRequestError('Event not found.', 404)
}
