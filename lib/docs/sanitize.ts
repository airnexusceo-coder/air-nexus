import type { ChecklistItemDTO } from './types'

/** Pure validation logic, split out from docs.ts (which is server-only) so it's directly testable. */

const MAX_CHECKLIST_ITEMS = 50
const MAX_TITLE_LENGTH = 200

function isChecklistItem(value: unknown): value is ChecklistItemDTO {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<ChecklistItemDTO>
  return typeof item.id === 'string' && typeof item.text === 'string' && typeof item.done === 'boolean'
}

export function sanitizeTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim().slice(0, MAX_TITLE_LENGTH) : ''
  return title || 'Untitled document'
}

export function sanitizeChecklist(value: unknown): ChecklistItemDTO[] {
  if (!Array.isArray(value)) return []
  return value.filter(isChecklistItem).slice(0, MAX_CHECKLIST_ITEMS).map((item) => ({
    id: item.id.slice(0, 60),
    text: item.text.trim().slice(0, 300),
    done: item.done,
  }))
}
