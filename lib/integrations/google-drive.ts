import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'
import { extensionOf, extractTextFromBuffer, normalizeExtractedText } from '@/lib/documents/extract-server'

/**
 * Real Google Drive OAuth + file access — backed by migration 0021. Tokens
 * are stored per-user via the caller's own Supabase token (RLS owner-only),
 * same trust model as calendar.ts/docs.ts. Never returned to the client.
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3'
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly']

export class GoogleConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleConfigurationError'
  }
}

export class GoogleDriveError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'GoogleDriveError'
    this.status = status
  }
}

function getClientId() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim()
  if (!value) throw new GoogleConfigurationError('Missing GOOGLE_DRIVE_CLIENT_ID')
  return value
}

function getClientSecret() {
  const value = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim()
  if (!value) throw new GoogleConfigurationError('Missing GOOGLE_DRIVE_CLIENT_SECRET')
  return value
}

export function isGoogleDriveConfigured() {
  return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() && process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim())
}

export function buildGoogleAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

async function readGoogleTokenJson(response: Response): Promise<GoogleTokenResponse> {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as GoogleTokenResponse
  } catch {
    return {}
  }
}

type StoredTokens = { accessToken: string; refreshToken: string; expiresAt: string; scope: string }

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<StoredTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await readGoogleTokenJson(response)
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new GoogleDriveError(
      data.error_description || data.error || 'Google did not return a complete connection. Try again and approve all requested access.',
      response.status || 502,
    )
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    scope: data.scope ?? GOOGLE_SCOPES.join(' '),
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'refresh_token',
    }),
  })
  const data = await readGoogleTokenJson(response)
  if (!response.ok || !data.access_token) {
    throw new GoogleDriveError(data.error_description || data.error || 'Could not refresh the Google connection. Reconnect Google Drive.', response.status || 502)
  }
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString() }
}

type ConnectionRow = { user_id: string; access_token: string; refresh_token: string; expires_at: string; scope: string }

export async function saveGoogleConnection(auth: ServerAuthSession, tokens: StoredTokens): Promise<void> {
  const response = await supabaseRestFetch(auth.accessToken, '/google_oauth_connections?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: auth.user.id,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      scope: tokens.scope,
    }),
  })
  if (!response.ok) throw new SupabaseRequestError('Could not save the Google connection.', response.status)
}

export async function isGoogleConnected(auth: ServerAuthSession): Promise<boolean> {
  const response = await supabaseRestFetch(auth.accessToken, `/google_oauth_connections?user_id=eq.${encodeURIComponent(auth.user.id)}&select=user_id`)
  const rows = await readSupabaseRestJson<Array<{ user_id: string }>>(response, 'Could not check the Google connection')
  return rows.length > 0
}

async function getConnectionRow(auth: ServerAuthSession): Promise<ConnectionRow | null> {
  const response = await supabaseRestFetch(auth.accessToken, `/google_oauth_connections?user_id=eq.${encodeURIComponent(auth.user.id)}&select=*`)
  const rows = await readSupabaseRestJson<ConnectionRow[]>(response, 'Could not load the Google connection')
  return rows[0] ?? null
}

/** Returns a valid (refreshed if needed) Drive access token, or null if the user hasn't connected Google. */
export async function getValidAccessToken(auth: ServerAuthSession): Promise<string | null> {
  const connection = await getConnectionRow(auth)
  if (!connection) return null

  const expiresAt = new Date(connection.expires_at).getTime()
  const needsRefresh = !Number.isFinite(expiresAt) || expiresAt - Date.now() < 60_000
  if (!needsRefresh) return connection.access_token

  const refreshed = await refreshAccessToken(connection.refresh_token)
  const response = await supabaseRestFetch(auth.accessToken, `/google_oauth_connections?user_id=eq.${encodeURIComponent(auth.user.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ access_token: refreshed.accessToken, expires_at: refreshed.expiresAt }),
  })
  if (!response.ok) throw new SupabaseRequestError('Could not refresh the Google connection.', response.status)
  return refreshed.accessToken
}

export async function disconnectGoogle(auth: ServerAuthSession): Promise<void> {
  const connection = await getConnectionRow(auth)
  if (connection) {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(connection.refresh_token)}`, { method: 'POST' }).catch(() => null)
  }
  const response = await supabaseRestFetch(auth.accessToken, `/google_oauth_connections?user_id=eq.${encodeURIComponent(auth.user.id)}`, { method: 'DELETE' })
  if (!response.ok) throw new SupabaseRequestError('Could not disconnect Google Drive.', response.status)
}

export type DriveFileDTO = {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size: string | null
  importable: boolean
}

const GOOGLE_NATIVE_EXPORTS: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
}

const IMPORTABLE_BINARY_EXTENSIONS = new Set(['pdf', 'docx', 'pptx', 'txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml'])

function isImportable(name: string, mimeType: string) {
  if (mimeType in GOOGLE_NATIVE_EXPORTS) return true
  if (mimeType.startsWith('application/vnd.google-apps')) return false
  return IMPORTABLE_BINARY_EXTENSIONS.has(extensionOf(name))
}

type DriveFileRow = { id: string; name: string; mimeType: string; modifiedTime: string; size?: string }
type DriveListResponse = { files?: DriveFileRow[]; error?: { message?: string } }

export async function listDriveFiles(accessToken: string, search?: string): Promise<DriveFileDTO[]> {
  const queryParts = ["trashed = false", "'me' in owners"]
  const trimmedSearch = search?.trim()
  if (trimmedSearch) queryParts.push(`name contains '${trimmedSearch.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)

  const params = new URLSearchParams({
    q: queryParts.join(' and '),
    fields: 'files(id,name,mimeType,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '50',
  })
  const response = await fetch(`${DRIVE_API_URL}/files?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await response.json().catch(() => ({})) as DriveListResponse
  if (!response.ok) throw new GoogleDriveError(data.error?.message || 'Could not list Google Drive files.', response.status)

  return (data.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    size: file.size ?? null,
    importable: isImportable(file.name, file.mimeType),
  }))
}

export async function fetchDriveFileText(accessToken: string, fileId: string, fileName: string, mimeType: string): Promise<string> {
  const exportMime = GOOGLE_NATIVE_EXPORTS[mimeType]
  if (exportMime) {
    const response = await fetch(`${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMime)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) throw new GoogleDriveError('Could not export this Google file.', response.status)
    return normalizeExtractedText(await response.text())
  }

  if (mimeType.startsWith('application/vnd.google-apps')) {
    throw new GoogleDriveError('This Drive item type is not supported yet (folders, forms, and drawings cannot be imported).', 415)
  }

  const response = await fetch(`${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw new GoogleDriveError('Could not download this file from Google Drive.', response.status)
  const buffer = Buffer.from(await response.arrayBuffer())
  return normalizeExtractedText(await extractTextFromBuffer(fileName, buffer))
}
