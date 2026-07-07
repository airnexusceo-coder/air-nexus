import { NextResponse } from 'next/server'
import {
  createMemory,
  deleteMemory,
  getMemoryProfile,
  getMemorySettings,
  listMemories,
  updateMemory,
  updateMemorySettings,
} from '@/lib/memory/server'
import {
  getServerAuthSession,
  SupabaseConfigurationError,
  SupabaseRequestError,
} from '@/lib/supabase/server'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function requireAuth() {
  const auth = await getServerAuthSession()
  if (!auth) throw new SupabaseRequestError('Authentication required.', 401)
  return auth
}

function handleError(error: unknown) {
  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json({ error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.' }, { status: 503 })
  }
  if (error instanceof SupabaseRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status === 401 ? 401 : error.status >= 500 ? 502 : error.status })
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ error: 'Memory request failed.' }, { status: 500 })
}

async function readBody(request: Request) {
  try {
    const value: unknown = await request.json()
    return isRecord(value) ? value : {}
  } catch {
    return {}
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    const url = new URL(request.url)
    const query = url.searchParams.get('q') ?? ''
    const limit = Number(url.searchParams.get('limit') ?? 30)
    const [settings, profile, memories] = await Promise.all([
      getMemorySettings(auth),
      getMemoryProfile(auth),
      listMemories(auth, query, Number.isFinite(limit) ? limit : 30),
    ])
    return NextResponse.json({ settings, profile, memories })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const memory = await createMemory(auth, body as { type: unknown; title: unknown; content: unknown; tags?: unknown; source?: 'manual' | 'automatic' | 'conversation' | 'import'; confidence?: unknown; metadata?: unknown })
    return NextResponse.json({ memory }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    if (body.kind === 'settings') {
      const settings = await updateMemorySettings(auth, body)
      return NextResponse.json({ settings })
    }
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Memory id is required.' }, { status: 400 })
    const memory = await updateMemory(auth, id, body)
    return NextResponse.json({ memory })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth()
    const url = new URL(request.url)
    const id = url.searchParams.get('id') ?? ''
    if (!id) return NextResponse.json({ error: 'Memory id is required.' }, { status: 400 })
    await deleteMemory(auth, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}
