import { NextResponse } from 'next/server'
import { getServerAuthSession, SupabaseConfigurationError, SupabaseRequestError } from '@/lib/supabase/server'
import { getValidAccessToken, fetchDriveFileText, GoogleConfigurationError, GoogleDriveError } from '@/lib/integrations/google-drive'
import { createDoc, updateDoc } from '@/lib/docs/docs'
import { formatAiTextForDocument } from '@/lib/documents/format-ai-text'
import { readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_IMPORTED_CHARACTERS = 40_000

function handleError(error: unknown) {
  if (error instanceof GoogleConfigurationError) return NextResponse.json({ error: 'Google Drive is not configured on the server yet.' }, { status: 503 })
  if (error instanceof GoogleDriveError) return NextResponse.json({ error: error.message }, { status: error.status >= 400 && error.status < 500 ? error.status : 502 })
  if (error instanceof SupabaseConfigurationError) return NextResponse.json({ error: 'AirGPT backend is not configured.' }, { status: 503 })
  if (error instanceof SupabaseRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
  if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 422 })
  return NextResponse.json({ error: 'Import failed.' }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    const auth = await getServerAuthSession()
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await readBody(request)
    const fileId = typeof body.fileId === 'string' ? body.fileId.trim() : ''
    const fileName = typeof body.fileName === 'string' && body.fileName.trim() ? body.fileName.trim().slice(0, 200) : 'Imported from Google Drive'
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
    if (!fileId || !mimeType) return NextResponse.json({ error: 'fileId and mimeType are required.' }, { status: 400 })

    const accessToken = await getValidAccessToken(auth)
    if (!accessToken) return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 409 })

    const text = await fetchDriveFileText(accessToken, fileId, fileName, mimeType)
    if (!text) return NextResponse.json({ error: 'No readable text was found in this file.' }, { status: 422 })
    const truncated = text.length > MAX_IMPORTED_CHARACTERS
    const importedText = truncated ? text.slice(0, MAX_IMPORTED_CHARACTERS) : text

    const created = await createDoc(auth, fileName)
    await updateDoc(auth, created.id, { body: formatAiTextForDocument(importedText) })

    return NextResponse.json({ docId: created.id, title: created.title, characters: importedText.length, truncated })
  } catch (error) {
    return handleError(error)
  }
}
