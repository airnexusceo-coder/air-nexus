import { NextResponse } from 'next/server'
import { getServerAuthSession, SupabaseConfigurationError } from '@/lib/supabase/server'
import { describeStripeError, getStripeClient, isStripeConfigured, StripeConfigurationError } from '@/lib/billing/stripe'
import { getBillingStatus, getOrCreateStripeCustomerId } from '@/lib/billing/customer'
import { BILLING_PLAN_CONFIG, isPaidPlan } from '@/lib/billing/plans'

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

    const status = await getBillingStatus(auth)
    if (status.hasActiveSubscription) {
      // Defensive fallback for stale client state — the UI routes an
      // existing subscriber to /api/billing/change-plan instead of here.
      return NextResponse.json(
        { error: `You already have an active ${status.plan} subscription. Refresh the page and use "switch plan" to change it.` },
        { status: 409 },
      )
    }

    const customerId = await getOrCreateStripeCustomerId(auth)
    const stripe = getStripeClient()
    const config = BILLING_PLAN_CONFIG[plan]
    const origin = new URL(request.url).origin

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: config.unitAmountCents,
            recurring: { interval: config.interval },
            product_data: { name: config.productName },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: { supabase_user_id: auth.user.id, plan },
      },
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancel`,
    })

    if (!session.url) return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    if (error instanceof StripeConfigurationError || error instanceof SupabaseConfigurationError) {
      console.error('Billing configuration error:', error.message)
      return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 })
    }
    const message = describeStripeError(error, 'Could not start checkout.')
    console.error('Checkout session error:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
