import { NextResponse } from 'next/server'
import { getServerAuthSession, SupabaseConfigurationError, SupabaseRequestError } from '@/lib/supabase/server'
import { describeStripeError, isStripeConfigured, StripeConfigurationError } from '@/lib/billing/stripe'
import { changeSubscriptionPlan } from '@/lib/billing/customer'
import { isPaidPlan } from '@/lib/billing/plans'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const plan = isRecord(body) ? body.plan : undefined
  if (!isPaidPlan(plan)) return NextResponse.json({ error: 'plan must be "Plus" or "Premium"' }, { status: 400 })

  try {
    const auth = await getServerAuthSession()
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const status = await changeSubscriptionPlan(auth, plan)
    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof StripeConfigurationError || error instanceof SupabaseConfigurationError) {
      console.error('Billing configuration error:', error.message)
      return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 })
    }
    if (error instanceof SupabaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = describeStripeError(error, 'Could not change your plan.')
    console.error('Change plan error:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
