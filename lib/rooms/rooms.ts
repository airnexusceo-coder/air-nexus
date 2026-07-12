import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import type { ServerAuthSession } from '@/lib/supabase/server'
import type { RoomDetail, RoomRole, RoomSummary } from './types'

/**
 * Real Collaboration Rooms — replaces the hardcoded fake rooms/collaborators
 * previously scattered across lib/data.ts, workspace.tsx, and
 * context-panel.tsx. Backed by migration 0005 (rooms/room_members).
 */

export function encode(value: string) {
  return encodeURIComponent(value)
}

type RoomMemberRow = { user_id: string; role: string; joined_at: string }

/**
 * Confirms the caller is a member of the room and returns the full member
 * list. RLS ("read fellow room members") means a non-member's query returns
 * zero rows rather than an error — that's exactly the membership check.
 */
export async function requireRoomMembership(auth: ServerAuthSession, roomId: string): Promise<RoomMemberRow[]> {
  if (typeof roomId !== 'string' || !roomId) throw new SupabaseRequestError('Room id required.', 400)
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/room_members?room_id=eq.${encode(roomId)}&select=user_id,role,joined_at&order=joined_at.asc`,
  )
  const rows = await readSupabaseRestJson<RoomMemberRow[]>(response, 'Failed to load room')
  if (rows.length === 0) throw new SupabaseRequestError('Room not found.', 404)
  return rows
}

/**
 * Resolves display names via the service role, since `profiles` RLS only
 * allows reading your own profile + accepted friends' — fellow room members
 * who aren't friends would otherwise return silently-missing rows.
 */
export async function resolveDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds))
  if (unique.length === 0) return new Map()
  const response = await supabaseServiceFetch(`/profiles?user_id=in.(${unique.map(encode).join(',')})&select=user_id,display_name`)
  const rows = await readSupabaseRestJson<{ user_id: string; display_name: string }[]>(response, 'Failed to load member names')
  return new Map(rows.map((row) => [row.user_id, row.display_name]))
}

export async function getRoomName(roomId: string): Promise<string> {
  const response = await supabaseServiceFetch(`/rooms?id=eq.${encode(roomId)}&select=name`)
  const rows = await readSupabaseRestJson<{ name: string }[]>(response, 'Failed to load room')
  return rows[0]?.name ?? 'a room'
}

type RoomRow = { id: string; name: string; created_at: string; room_members: { user_id: string; role: string }[] }

export async function listMyRooms(auth: ServerAuthSession): Promise<RoomSummary[]> {
  const response = await supabaseRestFetch(
    auth.accessToken,
    '/rooms?select=id,name,created_at,room_members(user_id,role)&order=created_at.desc',
  )
  const rows = await readSupabaseRestJson<RoomRow[]>(response, 'Failed to load rooms')
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: (row.room_members.find((m) => m.user_id === auth.user.id)?.role as RoomRole | undefined) ?? 'member',
    memberCount: row.room_members.length,
    createdAt: row.created_at,
  }))
}

export async function createRoom(auth: ServerAuthSession, name: string): Promise<RoomSummary> {
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_create_room', {
    method: 'POST',
    body: JSON.stringify({ p_name: name }),
  })
  const value = await readSupabaseRestJson<{ id: string; name: string; created_at: string } | { id: string; name: string; created_at: string }[]>(
    response,
    'Could not create room',
  )
  const room = Array.isArray(value) ? value[0] : value
  if (!room) throw new SupabaseRequestError('Could not create room.', 502)
  return { id: room.id, name: room.name, role: 'owner', memberCount: 1, createdAt: room.created_at }
}

export async function getRoomDetail(auth: ServerAuthSession, roomId: string): Promise<RoomDetail> {
  const memberRows = await requireRoomMembership(auth, roomId)
  const roomResponse = await supabaseRestFetch(auth.accessToken, `/rooms?id=eq.${encode(roomId)}&select=id,name`)
  const roomRows = await readSupabaseRestJson<{ id: string; name: string }[]>(roomResponse, 'Failed to load room')
  const room = roomRows[0]
  if (!room) throw new SupabaseRequestError('Room not found.', 404)

  const names = await resolveDisplayNames(memberRows.map((m) => m.user_id))
  return {
    id: room.id,
    name: room.name,
    members: memberRows.map((m) => ({
      userId: m.user_id,
      displayName: names.get(m.user_id) ?? 'AirNexus student',
      role: m.role as RoomRole,
      joinedAt: m.joined_at,
    })),
  }
}

export async function addRoomMember(auth: ServerAuthSession, roomId: string, targetUserId: string): Promise<void> {
  if (typeof targetUserId !== 'string' || !targetUserId) throw new SupabaseRequestError('A member is required.', 400)
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_add_room_member', {
    method: 'POST',
    body: JSON.stringify({ p_room_id: roomId, p_target_user_id: targetUserId }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not add member')
}
