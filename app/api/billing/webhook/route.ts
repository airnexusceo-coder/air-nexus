import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeClient, getStripeWebhookSecret, isStripeConfigured, StripeConfigurationError } from '@/lib/billing/stripe'
import { syncProfileFromSubscription } from '@/lib/billing/customer'

export const runtime = 'nodejs'

const SUBSCRIPTION_EVENTS = new Set(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'])

/**
 * Stripe calls this directly — no user session, no CSRF token. The Stripe
 * signature header (verified against the raw, unparsed body) is the only
 * authentication. This is the sole writer of profiles.plan/plan_expires_at/
 * subscription_status; nothing else in the app is allowed to set them.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })

  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    const stripe = getStripeClient()
    event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret())
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      console.error('Billing configuration error:', error.message)
      return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 })
    }
    console.error('Stripe webhook signature verification failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      await syncProfileFromSubscription(event.data.object as Stripe.Subscription)
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook processing error:', event.type, error instanceof Error ? error.message : 'Unknown error')
    // Non-2xx so Stripe retries with its own backoff — a dropped webhook
    // event here means a real subscription/plan mismatch, worth retrying.
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
