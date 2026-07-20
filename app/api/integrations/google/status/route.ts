import { NextResponse } from 'next/server'
import { getServerAuthSession, SupabaseConfigurationError } from '@/lib/supabase/server'
import { isGoogleConnected, isGoogleDriveConfigured } from '@/lib/integrations/google-drive'

export const runtime = 'nodejs'

export async function GET() {
  if (!isGoogleDriveConfigured()) return NextResponse.json({ configured: false, connected: false })

  try {
    const auth = await getServerAuthSession()
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const connected = await isGoogleConnected(auth)
    return NextResponse.json({ configured: true, connected })
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) return NextResponse.json({ error: 'AirGPT backend is not configured.' }, { status: 503 })
    return NextResponse.json({ error: 'Could not check the Google connection.' }, { status: 500 })
  }
}
