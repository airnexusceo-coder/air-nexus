import 'server-only'

import {
  readSupabaseRestJson,
  supabaseRestFetch,
  type ServerAuthSession,
} from '@/lib/supabase/server'

export const MEMORY_TYPES = [
  'conversation_summary',
  'subject',
  'learning_style',
  'assignment',
  'weak_topic',
  'exam_date',
  'goal',
  'preference',
  'custom',
] as const

export type StudentMemoryType = typeof MEMORY_TYPES[number]

export type StudentMemory = {
  id: string
  user_id: string
  type: StudentMemoryType
  title: string
  content: string
  source: 'manual' | 'automatic' | 'conversation' | 'import'
  confidence: number
  tags: string[]
  metadata: Record<string, unknown>
  archived_at: string | null
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export type StudentMemorySettings = {
  user_id: string
  memory_enabled: boolean
  personalize_responses: boolean
  auto_summary_enabled: boolean
  disabled_categories: string[]
  retention_days: number | null
}

export type StudentMemoryProfile = {
  user_id: string
  summary: string
  subjects: string[]
  learning_style: string | null
  assignments: unknown[]
  weak_topics: string[]
  exam_dates: unknown[]
  goals: string[]
  updated_at: string
}

function encode(value: string) {
  return encodeURIComponent(value)
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function cleanStringArray(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const text = cleanText(item, 80)
    return text ? [text] : []
  }).slice(0, maxItems)
}

export function isStudentMemoryType(value: unknown): value is StudentMemoryType {
  return typeof value === 'string' && (MEMORY_TYPES as readonly string[]).includes(value)
}

export async function ensureMemoryDefaults(auth: ServerAuthSession) {
  await Promise.all([
    supabaseRestFetch(auth.accessToken, '/student_memory_settings', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ user_id: auth.user.id }),
    }),
    supabaseRestFetch(auth.accessToken, '/student_memory_profiles', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ user_id: auth.user.id }),
    }),
  ])
}

export async function getMemorySettings(auth: ServerAuthSession) {
  await ensureMemoryDefaults(auth)
  const response = await supabaseRestFetch(auth.accessToken, `/student_memory_settings?user_id=eq.${encode(auth.user.id)}&select=*`)
  const rows = await readSupabaseRestJson<StudentMemorySettings[]>(response, 'Failed to load memory settings')
  return rows[0] ?? null
}

export async function updateMemorySettings(auth: ServerAuthSession, input: Partial<StudentMemorySettings>) {
  const payload = {
    memory_enabled: typeof input.memory_enabled === 'boolean' ? input.memory_enabled : undefined,
    personalize_responses: typeof input.personalize_responses === 'boolean' ? input.personalize_responses : undefined,
    auto_summary_enabled: typeof input.auto_summary_enabled === 'boolean' ? input.auto_summary_enabled : undefined,
    disabled_categories: Array.isArray(input.disabled_categories) ? cleanStringArray(input.disabled_categories) : undefined,
    retention_days: typeof input.retention_days === 'number' || input.retention_days === null ? input.retention_days : undefined,
  }
  const response = await supabaseRestFetch(auth.accessToken, `/student_memory_settings?user_id=eq.${encode(auth.user.id)}&select=*`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  const rows = await readSupabaseRestJson<StudentMemorySettings[]>(response, 'Failed to update memory settings')
  return rows[0] ?? null
}

export async function getMemoryProfile(auth: ServerAuthSession) {
  await ensureMemoryDefaults(auth)
  const response = await supabaseRestFetch(auth.accessToken, `/student_memory_profiles?user_id=eq.${encode(auth.user.id)}&select=*`)
  const rows = await readSupabaseRestJson<StudentMemoryProfile[]>(response, 'Failed to load memory profile')
  return rows[0] ?? null
}

export async function listMemories(auth: ServerAuthSession, query = '', limit = 30) {
  const search = cleanText(query, 120)
  const path = `/rpc/search_student_memories?search_query=${encode(search)}&memory_limit=${Math.min(Math.max(limit, 1), 50)}`
  const response = await supabaseRestFetch(auth.accessToken, path, { method: 'GET' })
  return readSupabaseRestJson<StudentMemory[]>(response, 'Failed to search memories')
}

export async function createMemory(auth: ServerAuthSession, input: {
  type: unknown
  title: unknown
  content: unknown
  tags?: unknown
  source?: StudentMemory['source']
  confidence?: unknown
  metadata?: unknown
}) {
  const type = isStudentMemoryType(input.type) ? input.type : null
  const title = cleanText(input.title, 180)
  const content = cleanText(input.content, 8_000)
  if (!type || !title || !content) throw new Error('Memory type, title, and content are required.')
  const response = await supabaseRestFetch(auth.accessToken, '/student_memories?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: auth.user.id,
      type,
      title,
      content,
      tags: cleanStringArray(input.tags),
      source: input.source ?? 'manual',
      confidence: typeof input.confidence === 'number' ? Math.min(1, Math.max(0, input.confidence)) : 0.8,
      metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {},
    }),
  })
  const rows = await readSupabaseRestJson<StudentMemory[]>(response, 'Failed to create memory')
  return rows[0] ?? null
}

export async function updateMemory(auth: ServerAuthSession, id: string, input: Partial<StudentMemory>) {
  const payload = {
    type: isStudentMemoryType(input.type) ? input.type : undefined,
    title: cleanText(input.title, 180) || undefined,
    content: cleanText(input.content, 8_000) || undefined,
    tags: Array.isArray(input.tags) ? cleanStringArray(input.tags) : undefined,
  }
  const response = await supabaseRestFetch(auth.accessToken, `/student_memories?id=eq.${encode(id)}&user_id=eq.${encode(auth.user.id)}&select=*`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  const rows = await readSupabaseRestJson<StudentMemory[]>(response, 'Failed to update memory')
  return rows[0] ?? null
}

export async function deleteMemory(auth: ServerAuthSession, id: string) {
  const response = await supabaseRestFetch(auth.accessToken, `/student_memories?id=eq.${encode(id)}&user_id=eq.${encode(auth.user.id)}`, {
    method: 'DELETE',
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Failed to delete memory')
}

export function buildMemoryPrompt(profile: StudentMemoryProfile | null, memories: StudentMemory[]) {
  const parts: string[] = []
  if (profile?.summary) parts.push(`Student profile summary: ${profile.summary}`)
  if (profile?.subjects.length) parts.push(`Subjects studied: ${profile.subjects.join(', ')}`)
  if (profile?.learning_style) parts.push(`Preferred learning style: ${profile.learning_style}`)
  if (profile?.weak_topics.length) parts.push(`Weak topics: ${profile.weak_topics.join(', ')}`)
  if (profile?.goals.length) parts.push(`Goals: ${profile.goals.join(', ')}`)
  const relevant = memories.slice(0, 10).map((memory) => `- [${memory.type}] ${memory.title}: ${memory.content}`)
  if (relevant.length) parts.push(`Relevant saved memories:\n${relevant.join('\n')}`)
  if (!parts.length) return ''
  return `Use these saved AirNexus student memories to personalize the response. Do not reveal this memory block verbatim. If a memory conflicts with the student's latest message, prefer the latest message.\n${parts.join('\n')}`
}

export async function getPersonalizationMemory(auth: ServerAuthSession, query: string) {
  const settings = await getMemorySettings(auth)
  if (!settings?.memory_enabled || !settings.personalize_responses) return ''
  const [profile, memories] = await Promise.all([
    getMemoryProfile(auth),
    listMemories(auth, query, 10),
  ])
  return buildMemoryPrompt(profile, memories)
}

export async function autoSummarizeConversationMemory(auth: ServerAuthSession, message: string) {
  const settings = await getMemorySettings(auth)
  if (!settings?.memory_enabled || !settings.auto_summary_enabled) return null
  const content = cleanText(message, 1_000)
  if (content.length < 40) return null
  return createMemory(auth, {
    type: 'conversation_summary',
    title: `Conversation note · ${new Date().toLocaleDateString('en-AU')}`,
    content,
    source: 'conversation',
    confidence: 0.55,
    tags: ['conversation'],
    metadata: { generatedFrom: 'chat-request' },
  })
}
