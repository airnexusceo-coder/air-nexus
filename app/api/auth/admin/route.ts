import { scryptSync, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { AuthSession } from '@/lib/auth/session'

export const runtime = 'nodejs'

function verifyPassword(password: string, storedValue: string) {
  const [salt, expectedHex] = storedValue.split(':')
  if (!salt || !expectedHex || !/^[a-f\d]+$/i.test(expectedHex)) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function POST(request: Request) {
  const expectedUsername = process.env.AIRGPT_ADMIN_USERNAME
  const passwordHash = process.env.AIRGPT_ADMIN_PASSWORD_HASH
  if (!expectedUsername || !passwordHash) {
    return NextResponse.json({ error: 'Administrator login is not configured.' }, { status: 503 })
  }

  let body: { username?: unknown; password?: unknown }
  try {
    body = await request.json() as { username?: unknown; password?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const usernameMatches = username.localeCompare(expectedUsername, undefined, { sensitivity: 'accent' }) === 0
  if (!usernameMatches || !verifyPassword(password, passwordHash)) {
    return NextResponse.json({ error: 'Incorrect administrator username or password.' }, { status: 401 })
  }

  const session: AuthSession = {
    id: 'owner-parth-nair',
    name: 'Parth Nair',
    email: 'owner@airnexus.local',
    role: 'owner',
    provider: 'admin',
    signedInAt: new Date().toISOString(),
  }
  return NextResponse.json({ session })
}
