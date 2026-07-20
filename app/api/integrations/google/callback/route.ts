import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerAuthSession } from '@/lib/supabase/server'
import { exchangeCodeForTokens, saveGoogleConnection, GoogleConfigurationError, GoogleDriveError } from '@/lib/integrations/google-drive'

export const runtime = 'nodejs'

const STATE_COOKIE = 'airnexus-google-oauth-state'

function redirectWithResult(origin: string, status: 'connected' | 'error', message?: string) {
  const url = new URL('/', origin)
  url.searchParams.set('section', 'Integrations')
  url.searchParams.set('google', status)
  if (message) url.searchParams.set('message', message)
  const response = NextResponse.redirect(url)
  response.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) return redirectWithResult(origin, 'error', 'Google sign-in was cancelled.')

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? null
  if (!code || !stateParam || !expectedState || stateParam !== expectedState) {
    return redirectWithResult(origin, 'error', 'This connection request could not be verified. Try connecting again.')
  }

  const auth = await getServerAuthSession()
  if (!auth) return redirectWithResult(origin, 'error', 'Sign in first, then connect Google Drive.')

  try {
    const redirectUri = `${origin}/api/integrations/google/callback`
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    await saveGoogleConnection(auth, tokens)
    return redirectWithResult(origin, 'connected')
  } catch (error) {
    const message =
      error instanceof GoogleConfigurationError ? 'Google Drive is not configured on the server yet.'
      : error instanceof GoogleDriveError ? error.message
      : 'Could not connect Google Drive.'
    return redirectWithResult(origin, 'error', message)
  }
}
