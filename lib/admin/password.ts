import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// No 'server-only' marker needed: node:crypto has no browser build, so Next's
// bundler already refuses to include this in a client bundle on its own.
const KEY_LENGTH = 64

/** scrypt "salt:hash" hex — matches the convention already documented for the legacy admin login. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuffer = Buffer.from(hash, 'hex')
  const candidate = scryptSync(password, salt, hashBuffer.length)
  if (candidate.length !== hashBuffer.length) return false
  return timingSafeEqual(candidate, hashBuffer)
}
