import { NextResponse } from 'next/server'
import { getServerAuthSession, SupabaseConfigurationError } from '@/lib/supabase/server'
import { getBillingStatus } from '@/lib/billing/customer'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await getServerAuthSession()
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const status = await getBillingStatus(auth)
    return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      console.error('Billing configuration error:', error.message)
      return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 })
    }
    console.error('Billing status error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not read billing status.' }, { status: 502 })
  }
}
