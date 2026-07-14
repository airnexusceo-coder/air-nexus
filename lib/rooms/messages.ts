import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError } from '@/lib/supabase/server'
import type { ServerAuthSession } from '@/lib/supabase/server'
import { encode, requireRoomMembership, resolveDisplayNames } from './rooms'
import type { RoomMessageDTO } from './types'

type MessageRow = { id: string; room_id: string; channel_id: string | null; sender_id: string; body: string; created_at: string }

/**
 * Polled by the client (no realtime layer exists in this app). `sinceIso`
 * scopes the query to only new rows on repeat ticks. The initial (no-since)
 * load fetches the NEWEST 200 — queried descending then reversed, because
 * an ascending LIMIT would return the oldest 200 and an active room's
 * recent conversation would never appear on open. `channelId` scopes to one
 * sub-channel; omitted entirely for rooms with no channels.
 *
 * Display names are resolved from the message senders themselves, not just
 * the room's member list — open "system" rooms have no room_members rows at
 * all, so relying on membership alone would show every sender as a generic
 * fallback name.
 */
export async function listRoomMessages(auth: ServerAuthSession, roomId: string, sinceIso?: string | null, channelId?: string | null): Promise<RoomMessageDTO[]> {
  const memberRows = await requireRoomMembership(auth, roomId)
  const query =
    (sinceIso
      ? `&order=created_at.asc&limit=200&created_at=gt.${encode(sinceIso)}`
      : '&order=created_at.desc&limit=200')
    + (channelId ? `&channel_id=eq.${encode(channelId)}` : '')
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/room_messages?room_id=eq.${encode(roomId)}&select=id,room_id,channel_id,sender_id,body,created_at${query}`,
  )
  const rows = await readSupabaseRestJson<MessageRow[]>(response, 'Failed to load messages')
  if (!sinceIso) rows.reverse()
  const names = await resolveDisplayNames([...memberRows.map((m) => m.user_id), ...rows.map((row) => row.sender_id)])
  return rows.map((row) => toDTO(row, names, auth.user.id))
}

export async function sendRoomMessage(auth: ServerAuthSession, roomId: string, body: string, channelId?: string | null): Promise<RoomMessageDTO> {
  const trimmed = typeof body === 'string' ? body.trim() : ''
  if (!trimmed) throw new SupabaseRequestError('Enter a message.', 400)
  if (trimmed.length > 4000) throw new SupabaseRequestError('Message is too long.', 400)
  await requireRoomMembership(auth, roomId)

  const response = await supabaseRestFetch(auth.accessToken, '/room_messages', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ room_id: roomId, channel_id: channelId ?? null, sender_id: auth.user.id, body: trimmed }),
  })
  const rows = await readSupabaseRestJson<MessageRow[]>(response, 'Could not send message')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Could not send message.', 502)

  const names = await resolveDisplayNames([auth.user.id])
  return toDTO(row, names, auth.user.id)
}

function toDTO(row: MessageRow, names: Map<string, string>, selfId: string): RoomMessageDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    channelId: row.channel_id,
    senderId: row.sender_id,
    senderName: names.get(row.sender_id) ?? 'AirNexus student',
    body: row.body,
    createdAt: row.created_at,
    self: row.sender_id === selfId,
  }
}
