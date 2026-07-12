import 'server-only'

import { NextResponse } from 'next/server'
import { handleAirnexusError } from '@/lib/airnexus/http'

function errorStatus(error: unknown) {
  const value = (error as { status?: unknown } | null)?.status
  return typeof value === 'number' ? value : null
}

export function isApexBackendMissingSchema(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message
  const status = errorStatus(error)
  return (
    message.includes('Missing SUPABASE_SERVICE_ROLE_KEY') ||
    message.includes('schema cache') ||
    message.includes('PGRST205') ||
    message.includes("Could not find the table 'public.profiles'") ||
    message.includes("Could not find the table 'public.friendships'") ||
    message.includes("Could not find the table 'public.apex_") ||
    (message.includes('Failed to verify account status') && status === 404)
  )
}

export function handleApexError(error: unknown) {
  if (isApexBackendMissingSchema(error)) {
    return NextResponse.json(
      {
        error: 'Apex is connected to Supabase, but the Apex database schema is missing. Apply supabase/migrations/0002 through 0004 to enable the real backend.',
        requiredMigrations: [
          '0002_airnexus_social_economy.sql',
          '0003_apex_nexus_vault.sql',
          '0004_apex_breach_resolver.sql',
        ],
      },
      { status: 503 },
    )
  }
  return handleAirnexusError(error)
}