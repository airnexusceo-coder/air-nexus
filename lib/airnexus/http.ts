import 'server-only'

import { NextResponse } from 'next/server'
import {
  getServerAuthSession,
  readSupabaseRestJson,
  supabaseServiceFetch,
  SupabaseConfigurationError,
  SupabaseRequestError,
  type ServerAuthSession,
} from '@/lib/supabase/server'

type ModerationRow = { banned_at: string | null; deleted_at: string | null; suspended_until: string | null; suspended_reason: string | null }

/**
 * On top of a valid Supabase session, rejects banned/deleted/currently-suspended
 * accounts — enforced once, centrally, for every existing route. Suspension is
 * time-boxed (suspended_until); it stops blocking once that time passes.
 */
export async function requireAuth(): Promise<ServerAuthSession> {
  const auth = await getServerAuthSession()
  if (!auth) throw new SupabaseRequestError('Authentication required.', 401)

  const response = await supabaseServiceFetch(
    `/profiles?user_id=eq.${encodeURIComponent(auth.user.id)}&select=banned_at,deleted_at,suspended_until,suspended_reason`,
  )
  const rows = await readSupabaseRestJson<ModerationRow[]>(response, 'Failed to verify account status')
  const profile = rows[0]
  if (profile?.banned_at) throw new SupabaseRequestError('This account has been banned.', 403)
  if (profile?.deleted_at) throw new SupabaseRequestError('This account has been deleted.', 403)
  if (profile?.suspended_until && new Date(profile.suspended_until).getTime() > Date.now()) {
    throw new SupabaseRequestError(profile.suspended_reason ? `This account is suspended: ${profile.suspended_reason}` : 'This account is temporarily suspended.', 403)
  }

  return auth
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json()
    return isRecord(value) ? value : {}
  } catch {
    return {}
  }
}

/** Maps Supabase/config errors to HTTP responses. 503 signals "backend not configured". */
export function handleAirnexusError(error: unknown) {
  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json(
      { error: 'AirNexus backend is not configured. Add Supabase env keys and apply supabase/migrations.' },
      { status: 503 },
    )
  }
  if (error instanceof SupabaseRequestError) {
    const status = error.status === 401 ? 401 : error.status >= 400 && error.status < 500 ? error.status : 502
    return NextResponse.json({ error: error.message }, { status })
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ error: 'Request failed.' }, { status: 500 })
}
