'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { completeGoogleOAuth } from '@/lib/auth/session'
import { NexusLogo } from '@/components/brand/nexus-mark'

function safeNextPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/airgpt'
}

/**
 * Supabase's hosted Google OAuth flow hands the finished session back as
 * `#access_token=...&refresh_token=...` in the URL fragment — fragments
 * never reach the server, so this has to run client-side. It reads the
 * fragment once, exchanges it for our own httpOnly session cookies, then
 * moves on to wherever the user was originally headed.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const next = safeNextPath(new URLSearchParams(window.location.search).get('next'))
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

    const oauthError = hash.get('error_description') || hash.get('error')
    if (oauthError) {
      router.replace('/login?error=' + encodeURIComponent(oauthError))
      return
    }

    const accessToken = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    const expiresIn = hash.get('expires_in')

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=' + encodeURIComponent('Google sign-in did not return a valid session.'))
      return
    }

    let cancelled = false
    void completeGoogleOAuth({ accessToken, refreshToken, expiresIn: expiresIn ? Number(expiresIn) : undefined })
      .then(() => {
        if (!cancelled) router.replace(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Sign-in failed.')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-5 text-center text-white">
      <NexusLogo className="size-12" />
      {error ? (
        <div>
          <p className="text-sm text-red-300">{error}</p>
          <Link href="/login" className="mt-3 inline-block text-sm text-zinc-400 underline underline-offset-4 hover:text-white">Back to sign in</Link>
        </div>
      ) : (
        <p className="flex items-center gap-3 text-sm text-zinc-400"><span className="size-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />Completing sign-in…</p>
      )}
    </div>
  )
}
