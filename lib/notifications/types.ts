export type NotificationType = 'room_invite' | 'task_assigned' | 'task_completed'

export type NotificationDTO = {
  id: string
  type: NotificationType
  title: string
  body: string
  roomId: string | null
  taskId: string | null
  read: boolean
  createdAt: string
}
