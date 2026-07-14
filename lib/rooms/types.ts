export type RoomRole = 'owner' | 'member'

export type RoomSummary = {
  id: string
  name: string
  role: RoomRole
  memberCount: number
  createdAt: string
  isSystem: boolean
}

export type RoomMemberDTO = {
  userId: string
  displayName: string
  role: RoomRole
  joinedAt: string
}

export type RoomChannelDTO = {
  id: string
  name: string
  position: number
}

export type RoomDetail = {
  id: string
  name: string
  isSystem: boolean
  members: RoomMemberDTO[]
  channels: RoomChannelDTO[]
}

export type RoomMessageDTO = {
  id: string
  roomId: string
  channelId: string | null
  senderId: string
  senderName: string
  body: string
  createdAt: string
  self: boolean
}

export type RoomTaskStatus = 'todo' | 'in_progress' | 'done'

export type RoomTaskDTO = {
  id: string
  roomId: string
  title: string
  status: RoomTaskStatus
  assigneeId: string | null
  assigneeName: string | null
  createdBy: string
  completedBy: string | null
  completedAt: string | null
  createdAt: string
}
