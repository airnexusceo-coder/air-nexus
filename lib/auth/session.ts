import { apiUrl } from '@/lib/api-client'

export type AuthProvider = 'supabase'

export type AuthSession = {
  id: string
  name: string
  email: string
  role: 'user' | 'owner'
  provider: AuthProvider
  signedInAt: string
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<AuthSession>
  return typeof session.id === 'string' && typeof session.name === 'string' &&
    typeof session.email === 'string' && (session.role === 'user' || session.role === 'owner') &&
    session.provider === 'supabase' &&
    typeof session.signedInAt === 'string'
}

async function readAuthResponse(response: Response) {
  const body = await response.json().catch(() => ({})) as { session?: unknown; error?: string; message?: string; pendingVerification?: boolean }
  if (!response.ok) {
    throw new Error(body.error ?? body.message ?? 'Authentication failed.')
  }
  return body
}

export async function getAuthSession() {
  if (typeof window === 'undefined') return null
  const response = await fetch(apiUrl('/api/auth/session'), { cache: 'no-store', credentials: 'include' })
  if (response.status === 401) return null
  const body = await readAuthResponse(response)
  return isAuthSession(body.session) ? body.session : null
}

export async function signInWithPassword(input: { email: string; password: string; remember: boolean }) {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  const body = await readAuthResponse(response)
  if (!isAuthSession(body.session)) throw new Error('The server did not return a valid session.')
  return body.session
}

export async function signUpWithPassword(input: { name: string; email: string; password: string; remember: boolean }) {
  const response = await fetch(apiUrl('/api/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  const body = await readAuthResponse(response)
  if (body.pendingVerification) throw new Error(body.message ?? 'Check your email to confirm your account, then sign in.')
  if (!isAuthSession(body.session)) throw new Error('The server did not return a valid session.')
  return body.session
}

export async function clearAuthSession() {
  if (typeof window === 'undefined') return
  await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' }).catch(() => null)
}
