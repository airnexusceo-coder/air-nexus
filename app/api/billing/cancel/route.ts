import { NextResponse } from 'next/server'
import { getServerAuthSession, SupabaseConfigurationError, SupabaseRequestError } from '@/lib/supabase/server'
import { describeStripeError, isStripeConfigured, StripeConfigurationError } from '@/lib/billing/stripe'
import { cancelSubscriptionPlan } from '@/lib/billing/customer'

export const runtime = 'nodejs'

export async function POST() {
  if (!isStripeConfigured()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })

  try {
    const auth = await getServerAuthSession()
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const status = await cancelSubscriptionPlan(auth)
    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof StripeConfigurationError || error instanceof SupabaseConfigurationError) {
      console.error('Billing configuration error:', error.message)
      return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 })
    }
    if (error instanceof SupabaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = describeStripeError(error, 'Could not cancel your subscription.')
    console.error('Cancel subscription error:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
