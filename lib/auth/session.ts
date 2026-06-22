export type AuthProvider = 'google' | 'admin' | 'local'

export type AuthSession = {
  id: string
  name: string
  email: string
  role: 'user' | 'owner'
  provider: AuthProvider
  signedInAt: string
}

const PERSISTENT_SESSION_KEY = 'air-nexus-auth-session'
const TEMPORARY_SESSION_KEY = 'air-nexus-auth-session-temporary'

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<AuthSession>
  return typeof session.id === 'string' && typeof session.name === 'string' &&
    typeof session.email === 'string' && (session.role === 'user' || session.role === 'owner') &&
    (session.provider === 'google' || session.provider === 'admin' || session.provider === 'local') &&
    typeof session.signedInAt === 'string'
}

function parseSession(value: string | null) {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return isAuthSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function getAuthSession() {
  if (typeof window === 'undefined') return null
  return parseSession(window.localStorage.getItem(PERSISTENT_SESSION_KEY)) ??
    parseSession(window.sessionStorage.getItem(TEMPORARY_SESSION_KEY))
}

export function saveAuthSession(session: AuthSession, remember: boolean) {
  clearAuthSession()
  const storage = remember ? window.localStorage : window.sessionStorage
  storage.setItem(remember ? PERSISTENT_SESSION_KEY : TEMPORARY_SESSION_KEY, JSON.stringify(session))
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PERSISTENT_SESSION_KEY)
  window.sessionStorage.removeItem(TEMPORARY_SESSION_KEY)
}

export function createUserSession(input: Omit<AuthSession, 'signedInAt'>): AuthSession {
  return { ...input, signedInAt: new Date().toISOString() }
}
