import { NextResponse } from 'next/server'
import { getServerAuthSession, SupabaseConfigurationError, SupabaseRequestError } from '@/lib/supabase/server'
import { getValidAccessToken, listDriveFiles, GoogleConfigurationError, GoogleDriveError } from '@/lib/integrations/google-drive'

export const runtime = 'nodejs'

function handleError(error: unknown) {
  if (error instanceof GoogleConfigurationError) return NextResponse.json({ error: 'Google Drive is not configured on the server yet.' }, { status: 503 })
  if (error instanceof GoogleDriveError) return NextResponse.json({ error: error.message }, { status: error.status >= 400 && error.status < 500 ? error.status : 502 })
  if (error instanceof SupabaseConfigurationError) return NextResponse.json({ error: 'AirGPT backend is not configured.' }, { status: 503 })
  if (error instanceof SupabaseRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
  return NextResponse.json({ error: 'Could not load Google Drive files.' }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const auth = await getServerAuthSession()
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const accessToken = await getValidAccessToken(auth)
    if (!accessToken) return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 409 })

    const search = new URL(request.url).searchParams.get('q')?.slice(0, 200) ?? undefined
    const files = await listDriveFiles(accessToken, search)
    return NextResponse.json({ files })
  } catch (error) {
    return handleError(error)
  }
}
