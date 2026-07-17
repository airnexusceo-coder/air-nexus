export type ToolHistoryEntry = {
  id: string
  input: string
  option: string
  reply: string
  provider?: string
  createdAt: string
}

const HISTORY_STORAGE_KEY = 'airnexus-ai-tools-history-v1'
const MAX_ENTRIES_PER_TOOL = 12
const MAX_INPUT_LENGTH = 1200
const MAX_REPLY_LENGTH = 6000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parseStoredEntry(candidate: unknown): ToolHistoryEntry | null {
  if (!isRecord(candidate)) return null
  const reply = cleanText(candidate.reply, MAX_REPLY_LENGTH)
  if (!reply || typeof candidate.id !== 'string' || typeof candidate.createdAt !== 'string') return null
  return {
    id: candidate.id,
    input: cleanText(candidate.input, MAX_INPUT_LENGTH),
    option: cleanText(candidate.option, 80),
    reply,
    provider: typeof candidate.provider === 'string' ? candidate.provider.slice(0, 80) : undefined,
    createdAt: candidate.createdAt,
  }
}

function readStore(): Record<string, ToolHistoryEntry[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return {}
    const store: Record<string, ToolHistoryEntry[]> = {}
    for (const [slug, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue
      const entries = value
        .map(parseStoredEntry)
        .filter((entry): entry is ToolHistoryEntry => entry !== null)
        .slice(0, MAX_ENTRIES_PER_TOOL)
      if (entries.length > 0) store[slug] = entries
    }
    return store
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, ToolHistoryEntry[]>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Storage full or unavailable — history is a convenience, never block the tool itself on it.
  }
}

/** Most recent first. */
export function loadToolHistory(slug: string): ToolHistoryEntry[] {
  return readStore()[slug] ?? []
}

export function saveToolHistoryEntry(slug: string, entry: { input: string; option: string; reply: string; provider?: string }): ToolHistoryEntry[] {
  const reply = cleanText(entry.reply, MAX_REPLY_LENGTH)
  if (!reply) return loadToolHistory(slug)
  const store = readStore()
  const next: ToolHistoryEntry = {
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    input: cleanText(entry.input, MAX_INPUT_LENGTH),
    option: cleanText(entry.option, 80),
    reply,
    provider: entry.provider?.slice(0, 80),
    createdAt: new Date().toISOString(),
  }
  const updated = [next, ...(store[slug] ?? [])].slice(0, MAX_ENTRIES_PER_TOOL)
  store[slug] = updated
  writeStore(store)
  return updated
}

export function deleteToolHistoryEntry(slug: string, id: string): ToolHistoryEntry[] {
  const store = readStore()
  const updated = (store[slug] ?? []).filter((entry) => entry.id !== id)
  if (updated.length > 0) store[slug] = updated
  else delete store[slug]
  writeStore(store)
  return updated
}

export function clearToolHistory(slug: string): void {
  const store = readStore()
  delete store[slug]
  writeStore(store)
}
