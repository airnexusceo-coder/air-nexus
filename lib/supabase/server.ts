import 'server-only'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { AuthSession } from '@/lib/auth/session'

export const SUPABASE_ACCESS_COOKIE = 'airnexus-supabase-access'
export const SUPABASE_REFRESH_COOKIE = 'airnexus-supabase-refresh'

type SupabaseUser = {
  id?: unknown
  email?: unknown
  user_metadata?: unknown
  app_metadata?: unknown
}

type SupabaseSessionResponse = {
  access_token?: unknown
  refresh_token?: unknown
  expires_in?: unknown
  user?: SupabaseUser
  error?: unknown
  error_description?: unknown
  msg?: unknown
}

export type ServerAuthSession = {
  user: AuthSession
  accessToken: string
  refreshToken: string | null
}

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupabaseConfigurationError'
  }
}

export class SupabaseRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'SupabaseRequestError'
    this.status = status
  }
}

function getSupabaseUrl() {
  const value = process.env.SUPABASE_URL?.trim()
  if (!value) throw new SupabaseConfigurationError('Missing SUPABASE_URL')
  return value.replace(/\/+$/, '')
}

function getSupabaseAnonKey() {
  const value = process.env.SUPABASE_ANON_KEY?.trim()
  if (!value) throw new SupabaseConfigurationError('Missing SUPABASE_ANON_KEY')
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function authErrorMessage(value: SupabaseSessionResponse, fallback: string) {
  const description = typeof value.error_description === 'string' ? value.error_description : null
  const error = typeof value.error === 'string' ? value.error : null
  const msg = typeof value.msg === 'string' ? value.msg : null
  return description || msg || error || fallback
}

async function readJson(response: Response) {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new SupabaseRequestError('Supabase returned a non-JSON response', response.status)
  }
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('apikey', getSupabaseAnonKey())
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  return fetch(`${getSupabaseUrl()}${path}`, { ...init, headers, cache: 'no-store' })
}

function parseSupabaseSession(value: unknown): SupabaseSessionResponse {
  return isRecord(value) ? value as SupabaseSessionResponse : {}
}

function userNameFromMetadata(user: SupabaseUser) {
  const metadata = isRecord(user.user_metadata) ? user.user_metadata : {}
  const username = typeof metadata.username === 'string' ? metadata.username.trim() : ''
  // full_name/name are read only for accounts created before the username-based
  // signup change — new signups never set these.
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : ''
  const name = typeof metadata.name === 'string' ? metadata.name.trim() : ''
  const email = typeof user.email === 'string' ? user.email : ''
  return username || fullName || name || email.split('@')[0] || 'AirNexus student'
}

export function sessionFromSupabaseUser(value: unknown): AuthSession | null {
  if (!isRecord(value)) return null
  const user = value as SupabaseUser
  if (typeof user.id !== 'string' || !user.id) return null
  const email = typeof user.email === 'string' ? user.email : ''
  if (!email) return null
  const appMetadata = isRecord(user.app_metadata) ? user.app_metadata : {}
  const role = appMetadata.airnexus_role === 'owner' || appMetadata.role === 'owner' ? 'owner' : 'user'
  return {
    id: user.id,
    name: userNameFromMetadata(user),
    email,
    role,
    provider: 'supabase',
    signedInAt: new Date().toISOString(),
  }
}

export async function signInWithSupabasePassword(email: string, password: string) {
  const response = await supabaseFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const data = parseSupabaseSession(await readJson(response))
  if (!response.ok) throw new SupabaseRequestError(authErrorMessage(data, 'Supabase sign-in failed'), response.status)
  return data
}

export async function signUpWithSupabasePassword(username: string, email: string, password: string) {
  const response = await supabaseFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { username } }),
  })
  const data = parseSupabaseSession(await readJson(response))
  if (!response.ok) throw new SupabaseRequestError(authErrorMessage(data, 'Supabase sign-up failed'), response.status)
  return data
}

export async function refreshSupabaseSession(refreshToken: string) {
  const response = await supabaseFetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const data = parseSupabaseSession(await readJson(response))
  if (!response.ok) throw new SupabaseRequestError(authErrorMessage(data, 'Supabase session refresh failed'), response.status)
  return data
}

export async function getSupabaseUser(accessToken: string) {
  const response = await supabaseFetch('/auth/v1/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return null
  const data = await readJson(response)
  return sessionFromSupabaseUser(data)
}

export async function getServerAuthSession(): Promise<ServerAuthSession | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(SUPABASE_ACCESS_COOKIE)?.value ?? ''
  const refreshToken = cookieStore.get(SUPABASE_REFRESH_COOKIE)?.value ?? null
  if (!accessToken) return null
  const user = await getSupabaseUser(accessToken)
  return user ? { user, accessToken, refreshToken } : null
}

export function setSupabaseAuthCookies(response: NextResponse, session: SupabaseSessionResponse, remember: boolean) {
  if (typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string') {
    throw new SupabaseRequestError('Supabase did not return a complete session', 502)
  }

  const secure = process.env.NODE_ENV === 'production'
  const base = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' }
  const accessMaxAge = typeof session.expires_in === 'number' ? Math.max(60, Math.floor(session.expires_in)) : 3600
  response.cookies.set(SUPABASE_ACCESS_COOKIE, session.access_token, { ...base, ...(remember ? { maxAge: accessMaxAge } : {}) })
  response.cookies.set(SUPABASE_REFRESH_COOKIE, session.refresh_token, { ...base, ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}) })
}

export function clearSupabaseAuthCookies(response: NextResponse) {
  response.cookies.set(SUPABASE_ACCESS_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
  response.cookies.set(SUPABASE_REFRESH_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
}

export async function supabaseRestFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('apikey', getSupabaseAnonKey())
  headers.set('Authorization', `Bearer ${accessToken}`)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  return fetch(`${getSupabaseUrl()}/rest/v1${path}`, { ...init, headers, cache: 'no-store' })
}

function getSupabaseServiceKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!value) {
    throw new SupabaseConfigurationError('Missing SUPABASE_SERVICE_ROLE_KEY (required for Nexus Clash server authority)')
  }
  return value
}

/**
 * Server-only, service-role PostgREST call. Bypasses RLS — use ONLY inside
 * trusted backend logic (e.g. Apex/AirNexus server authority) that has already
 * validated the caller. Never expose this key or its responses' privileged
 * fields to the client.
 */
export async function supabaseServiceFetch(path: string, init: RequestInit = {}) {
  const key = getSupabaseServiceKey()
  const headers = new Headers(init.headers)
  headers.set('apikey', key)
  headers.set('Authorization', `Bearer ${key}`)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  return fetch(`${getSupabaseUrl()}/rest/v1${path}`, { ...init, headers, cache: 'no-store' })
}

/**
 * Server-only, service-role call to the GoTrue Admin API (`/auth/v1/admin/*`)
 * — a different surface from supabaseServiceFetch's PostgREST calls. Used
 * only by the Admin Console (lib/admin/users.ts) to list/create/ban real
 * AirNexus accounts. Same trust boundary as supabaseServiceFetch: server-only,
 * never exposed to the client, caller must already have validated the request.
 */
export async function supabaseAdminAuthFetch(path: string, init: RequestInit = {}) {
  const key = getSupabaseServiceKey()
  const headers = new Headers(init.headers)
  headers.set('apikey', key)
  headers.set('Authorization', `Bearer ${key}`)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  return fetch(`${getSupabaseUrl()}/auth/v1/admin${path}`, { ...init, headers, cache: 'no-store' })
}

export async function readSupabaseRestJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const value = await readJson(response)
  if (!response.ok) {
    const message = isRecord(value) && typeof value.message === 'string' ? value.message : fallbackMessage
    throw new SupabaseRequestError(message, response.status)
  }
  return value as T
}
