export type DocRole = 'owner' | 'editor' | 'viewer'

export type ChecklistItemDTO = { id: string; text: string; done: boolean }

export type DocSummary = {
  id: string
  title: string
  role: DocRole
  updatedAt: string
  createdAt: string
}

export type DocCollaboratorDTO = {
  userId: string
  displayName: string
  role: 'editor' | 'viewer'
  addedAt: string
}

export type DocDetail = {
  id: string
  title: string
  body: string
  checklist: ChecklistItemDTO[]
  role: DocRole
  ownerId: string
  updatedAt: string
  createdAt: string
  /** Only populated for the owner — RLS returns an empty list for everyone else. */
  collaborators: DocCollaboratorDTO[]
}
