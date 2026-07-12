import { NextResponse } from 'next/server'
import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError } from '@/lib/supabase/server'
import { verifyPassword } from '@/lib/admin/password'
import { createAdminSession, setAdminSessionCookie } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

type AdminUserRow = { id: string; username: string; password_hash: string; is_active: boolean }

/** Generic "Invalid credentials" on every failure path — never reveals whether a username exists. */
export async function POST(request: Request) {
  try {
    const body = await readBody(request)
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!username || !password) throw new SupabaseRequestError('Invalid credentials.', 401)

    const response = await supabaseServiceFetch(`/admin_users?username=eq.${encodeURIComponent(username)}&select=id,username,password_hash,is_active`)
    const rows = await readSupabaseRestJson<AdminUserRow[]>(response, 'Failed to verify credentials')
    const row = rows[0]
    if (!row || !row.is_active || !verifyPassword(password, row.password_hash)) {
      throw new SupabaseRequestError('Invalid credentials.', 401)
    }

    const { token, expiresAt } = await createAdminSession(row.id)
    await supabaseServiceFetch(`/admin_users?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_login_at: new Date().toISOString() }),
    }).catch(() => undefined)

    const nextResponse = NextResponse.json({ ok: true })
    setAdminSessionCookie(nextResponse, token, expiresAt)
    return nextResponse
  } catch (error) {
    return handleAirnexusError(error)
  }
}
