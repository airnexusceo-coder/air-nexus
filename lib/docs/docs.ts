import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'
import type { DocCollaboratorDTO, DocDetail, DocRole, DocSummary } from './types'
import { sanitizeChecklist, sanitizeTitle } from './sanitize'

/**
 * Real, shareable documents ("Docs") — backed by migration 0009. Replaces
 * the old single-per-user localStorage document. All calls use the caller's
 * own token; RLS (owner OR collaborator) is the only access gate.
 */

function encode(value: string) {
  return encodeURIComponent(value)
}

type DocRow = { id: string; title: string; owner_id: string; updated_at: string; created_at: string }
type CollaboratorRow = { doc_id: string; user_id: string; role: 'editor' | 'viewer'; display_name: string; added_at: string }

async function myCollaboratorRoles(auth: ServerAuthSession): Promise<Map<string, 'editor' | 'viewer'>> {
  const response = await supabaseRestFetch(auth.accessToken, `/doc_collaborators?user_id=eq.${encode(auth.user.id)}&select=doc_id,role`)
  const rows = await readSupabaseRestJson<Array<{ doc_id: string; role: 'editor' | 'viewer' }>>(response, 'Could not read shared documents')
  return new Map(rows.map((row) => [row.doc_id, row.role]))
}

export async function listMyDocs(auth: ServerAuthSession): Promise<DocSummary[]> {
  const [docsResponse, roles] = await Promise.all([
    supabaseRestFetch(auth.accessToken, '/docs?select=id,title,owner_id,updated_at,created_at&order=updated_at.desc'),
    myCollaboratorRoles(auth),
  ])
  const rows = await readSupabaseRestJson<DocRow[]>(docsResponse, 'Could not load documents')
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    role: row.owner_id === auth.user.id ? 'owner' : (roles.get(row.id) ?? 'viewer'),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }))
}

export async function createDoc(auth: ServerAuthSession, title?: string): Promise<DocSummary> {
  const response = await supabaseRestFetch(auth.accessToken, '/docs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ owner_id: auth.user.id, title: sanitizeTitle(title) }),
  })
  const rows = await readSupabaseRestJson<DocRow[]>(response, 'Could not create document')
  const doc = rows[0]
  if (!doc) throw new SupabaseRequestError('Could not create document.', 502)
  return { id: doc.id, title: doc.title, role: 'owner', updatedAt: doc.updated_at, createdAt: doc.created_at }
}

export async function getDoc(auth: ServerAuthSession, docId: string): Promise<DocDetail> {
  const response = await supabaseRestFetch(auth.accessToken, `/docs?id=eq.${encode(docId)}&select=*`)
  const rows = await readSupabaseRestJson<Array<DocRow & { body: string; checklist: unknown }>>(response, 'Could not load document')
  const doc = rows[0]
  if (!doc) throw new SupabaseRequestError('Document not found.', 404)

  const isOwner = doc.owner_id === auth.user.id
  let role: DocRole = 'viewer'
  let collaborators: DocCollaboratorDTO[] = []
  if (isOwner) {
    role = 'owner'
    const collabResponse = await supabaseRestFetch(auth.accessToken, `/doc_collaborators?doc_id=eq.${encode(docId)}&select=user_id,role,display_name,added_at&order=added_at.asc`)
    const collabRows = await readSupabaseRestJson<CollaboratorRow[]>(collabResponse, 'Could not load collaborators')
    collaborators = collabRows.map((row) => ({ userId: row.user_id, displayName: row.display_name, role: row.role, addedAt: row.added_at }))
  } else {
    const roles = await myCollaboratorRoles(auth)
    role = roles.get(doc.id) ?? 'viewer'
  }

  return {
    id: doc.id,
    title: doc.title,
    body: doc.body,
    checklist: sanitizeChecklist(doc.checklist),
    role,
    ownerId: doc.owner_id,
    updatedAt: doc.updated_at,
    createdAt: doc.created_at,
    collaborators,
  }
}

export async function updateDoc(
  auth: ServerAuthSession,
  docId: string,
  patch: { title?: string; body?: string; checklist?: unknown },
): Promise<DocSummary> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = sanitizeTitle(patch.title)
  if (patch.body !== undefined) body.body = typeof patch.body === 'string' ? patch.body : ''
  if (patch.checklist !== undefined) body.checklist = sanitizeChecklist(patch.checklist)
  if (Object.keys(body).length === 0) throw new SupabaseRequestError('Nothing to update.', 400)

  const response = await supabaseRestFetch(auth.accessToken, `/docs?id=eq.${encode(docId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  const rows = await readSupabaseRestJson<DocRow[]>(response, 'Could not save document')
  const doc = rows[0]
  // RLS silently returns zero rows for both "not found" and "no write access" —
  // both surface the same way to the caller (viewers get read access only).
  if (!doc) throw new SupabaseRequestError('Document not found, or you do not have edit access.', 403)
  return { id: doc.id, title: doc.title, role: doc.owner_id === auth.user.id ? 'owner' : 'editor', updatedAt: doc.updated_at, createdAt: doc.created_at }
}

export async function deleteDoc(auth: ServerAuthSession, docId: string): Promise<void> {
  const response = await supabaseRestFetch(auth.accessToken, `/docs?id=eq.${encode(docId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
  const rows = await readSupabaseRestJson<DocRow[]>(response, 'Could not delete document')
  if (rows.length === 0) throw new SupabaseRequestError('Document not found, or you are not the owner.', 403)
}

export async function shareDoc(auth: ServerAuthSession, docId: string, targetUserId: string, role: 'editor' | 'viewer'): Promise<void> {
  if (typeof targetUserId !== 'string' || !targetUserId) throw new SupabaseRequestError('A person to share with is required.', 400)
  if (role !== 'editor' && role !== 'viewer') throw new SupabaseRequestError('Role must be editor or viewer.', 400)
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_share_doc', {
    method: 'POST',
    body: JSON.stringify({ p_doc_id: docId, p_target_user_id: targetUserId, p_role: role }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not share document')
}

export async function unshareDoc(auth: ServerAuthSession, docId: string, targetUserId: string): Promise<void> {
  const response = await supabaseRestFetch(auth.accessToken, '/rpc/airnexus_unshare_doc', {
    method: 'POST',
    body: JSON.stringify({ p_doc_id: docId, p_target_user_id: targetUserId }),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not remove collaborator')
}
