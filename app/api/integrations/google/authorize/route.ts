import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getServerAuthSession } from '@/lib/supabase/server'
import { buildGoogleAuthUrl, isGoogleDriveConfigured } from '@/lib/integrations/google-drive'

export const runtime = 'nodejs'

const STATE_COOKIE = 'airnexus-google-oauth-state'

function redirectToIntegrations(origin: string, status: 'error', message: string) {
  const url = new URL('/', origin)
  url.searchParams.set('section', 'Integrations')
  url.searchParams.set('google', status)
  url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin

  if (!isGoogleDriveConfigured()) {
    return redirectToIntegrations(origin, 'error', 'Google Drive is not configured on the server yet.')
  }

  const auth = await getServerAuthSession()
  if (!auth) return redirectToIntegrations(origin, 'error', 'Sign in first, then connect Google Drive.')

  const state = randomBytes(24).toString('hex')
  const redirectUri = `${origin}/api/integrations/google/callback`
  const response = NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state))
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })
  return response
}
