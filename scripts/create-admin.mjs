#!/usr/bin/env node
// Bootstraps the first super_admin account for the Admin Console.
// Run locally: node scripts/create-admin.mjs
// Your username/password are never sent anywhere except (optionally) your
// own Supabase project — nothing is printed to any log service, nothing
// leaves this terminal except that one request.

import { randomBytes, scryptSync } from 'node:crypto'
import { createInterface } from 'node:readline'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

function loadDotEnvLocal() {
  const file = path.join(process.cwd(), '.env.local')
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer) }))
}

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    stdin.setRawMode?.(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let value = ''
    const onData = (char) => {
      if (char === '\r' || char === '\n') {
        stdin.setRawMode?.(wasRaw ?? false)
        stdin.pause()
        stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(value)
        return
      }
      if (char === '') process.exit(1) // Ctrl+C
      if (char === '') { value = value.slice(0, -1); return } // backspace
      value += char
    }
    stdin.on('data', onData)
  })
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  loadDotEnvLocal()

  const username = (await ask('Admin username: ')).trim()
  if (username.length < 3) {
    console.error('Username must be at least 3 characters.')
    process.exit(1)
  }
  const password = await askHidden('Admin password (hidden): ')
  if (password.length < 12) {
    console.error('Use a password of at least 12 characters — this account has All Permissions.')
    process.exit(1)
  }
  const confirm = await askHidden('Confirm password (hidden): ')
  if (confirm !== password) {
    console.error('Passwords did not match.')
    process.exit(1)
  }

  const passwordHash = hashPassword(password)
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (supabaseUrl && serviceKey) {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/admin_users`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ username, password_hash: passwordHash, role: 'super_admin', permissions: [], is_active: true }),
    })
    if (response.ok) {
      console.log(`\nCreated super_admin "${username}". Sign in at /admin/login.`)
      return
    }
    const text = await response.text()
    console.error(`\nCould not insert directly (${response.status}): ${text}`)
    console.error('Falling back to printing SQL you can run in the Supabase SQL Editor instead:\n')
  } else {
    console.log('\nSUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in .env.local — printing SQL to run in the Supabase SQL Editor instead:\n')
  }

  const escapedUsername = username.replace(/'/g, "''")
  console.log(
    `insert into public.admin_users (username, password_hash, role, permissions, is_active)\nvalues ('${escapedUsername}', '${passwordHash}', 'super_admin', '{}', true);`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
