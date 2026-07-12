import 'server-only'

import type Stripe from 'stripe'
import { readSupabaseRestJson, supabaseServiceFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'
import { getOrCreatePlanProductId, getStripeClient } from '@/lib/billing/stripe'
import { ACTIVE_SUBSCRIPTION_STATUSES, BILLING_PLAN_CONFIG, resolveEffectivePlan, type PaidPlan } from '@/lib/billing/plans'
import type { NexusPlan } from '@/lib/plans'

function encode(value: string) {
  return encodeURIComponent(value)
}

type CustomerIdRow = { stripe_customer_id: string | null }

type BillingRow = {
  plan: string
  plan_expires_at: string | null
  subscription_status: string | null
  stripe_customer_id: string | null
}

export type BillingStatus = {
  plan: NexusPlan
  planExpiresAt: string | null
  subscriptionStatus: string | null
  hasBillingAccount: boolean
  hasActiveSubscription: boolean
}

/** Curated, client-safe billing snapshot — never includes raw Stripe IDs. */
export async function getBillingStatus(auth: ServerAuthSession): Promise<BillingStatus> {
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(auth.user.id)}&select=plan,plan_expires_at,subscription_status,stripe_customer_id`)
  const rows = await readSupabaseRestJson<BillingRow[]>(response, 'Could not read billing status')
  const row = rows[0]
  const plan: NexusPlan = row?.plan === 'Plus' || row?.plan === 'Premium' ? row.plan : 'Free'
  const subscriptionStatus = row?.subscription_status ?? null
  return {
    plan,
    planExpiresAt: row?.plan_expires_at ?? null,
    subscriptionStatus,
    hasBillingAccount: Boolean(row?.stripe_customer_id),
    hasActiveSubscription: subscriptionStatus !== null && ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus),
  }
}

/** Looks up the caller's Stripe customer, creating one on first purchase. Persisted immediately (before any Checkout Session exists) so the webhook can always resolve a subscription back to a profile by stripe_customer_id alone. */
export async function getOrCreateStripeCustomerId(auth: ServerAuthSession): Promise<string> {
  const existingResponse = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(auth.user.id)}&select=stripe_customer_id`)
  const existingRows = await readSupabaseRestJson<CustomerIdRow[]>(existingResponse, 'Could not read billing profile')
  const existing = existingRows[0]?.stripe_customer_id
  if (existing) return existing

  const stripe = getStripeClient()
  const customer = await stripe.customers.create({
    email: auth.user.email,
    name: auth.user.name,
    metadata: { supabase_user_id: auth.user.id },
  })

  // Conditional write (only if still null) rather than a blind PATCH: two
  // concurrent calls here (e.g. a double-clicked "Upgrade" button firing two
  // checkout requests) would otherwise both create a Stripe customer and
  // both unconditionally overwrite the same profile row — whichever PATCH
  // lands last silently orphans the other request's customer. If that lost
  // customer is the one the browser actually completes Checkout against,
  // the webhook's later `stripe_customer_id=eq.<that id>` lookup matches no
  // profile row and a real paying subscription is never synced. The `is.null`
  // filter makes this a compare-and-swap: only the first writer's PATCH
  // matches a row, so every concurrent caller converges on one real customer.
  const claimResponse = await supabaseServiceFetch(
    `/profiles?user_id=eq.${encode(auth.user.id)}&stripe_customer_id=is.null`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ stripe_customer_id: customer.id }) },
  )
  const claimed = await readSupabaseRestJson<CustomerIdRow[]>(claimResponse, 'Could not save billing profile')
  if (claimed.length > 0) return customer.id

  // Lost the race — another concurrent call already claimed the profile.
  // Use its (real, persisted) customer id instead of the one we just
  // created, which is now orphaned but harmless (an empty Stripe customer).
  const refetchResponse = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(auth.user.id)}&select=stripe_customer_id`)
  const refetchRows = await readSupabaseRestJson<CustomerIdRow[]>(refetchResponse, 'Could not read billing profile')
  return refetchRows[0]?.stripe_customer_id ?? customer.id
}

/** Server-authoritative sync: the only place profiles.plan/plan_expires_at/subscription_status get written, always driven by a real Stripe subscription (from the webhook). Scoped by stripe_customer_id, not by subscription metadata, so it's robust even if a subscription is later modified outside this app's own checkout flow (e.g. from the Stripe Dashboard). */
export async function syncProfileFromSubscription(eventSubscription: Stripe.Subscription): Promise<void> {
  // Stripe does not guarantee webhook delivery order. Re-fetching at
  // processing time means a late-arriving stale event for THIS subscription
  // still syncs current truth, not the stale payload. A retrieve failure
  // throws, the webhook returns non-2xx, and Stripe retries the event.
  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(eventSubscription.id)

  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const item = subscription.items.data[0]
  const plan = resolveEffectivePlan(subscription.metadata?.plan, subscription.status)
  const planExpiresAt = item ? new Date(item.current_period_end * 1000).toISOString() : null
  const priceId = item?.price.id ?? null

  // Cancel-then-resubscribe race: the old subscription's terminal event can
  // arrive after the new subscription's active event. A downgrade is only
  // valid if it's for the subscription the profile currently tracks.
  if (plan === 'Free') {
    const currentResponse = await supabaseServiceFetch(`/profiles?stripe_customer_id=eq.${encode(customerId)}&select=stripe_subscription_id`)
    const currentRows = await readSupabaseRestJson<{ stripe_subscription_id: string | null }[]>(currentResponse, 'Could not read billing profile')
    const trackedSubscriptionId = currentRows[0]?.stripe_subscription_id
    if (trackedSubscriptionId && trackedSubscriptionId !== subscription.id) {
      console.warn('Stripe webhook: ignoring terminal event for non-current subscription', subscription.id, '- profile tracks', trackedSubscriptionId)
      return
    }
  }

  const response = await supabaseServiceFetch(`/profiles?stripe_customer_id=eq.${encode(customerId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      plan,
      plan_expires_at: planExpiresAt,
      subscription_status: subscription.status,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
    }),
  })
  const updated = await readSupabaseRestJson<unknown[]>(response, 'Could not sync subscription to profile')
  if (updated.length === 0) {
    console.error('Stripe webhook: no profile found for customer', customerId, '- subscription', subscription.id, 'was not synced')
  }
}

/**
 * Switches an existing active subscription to a different paid plan in
 * place — updates the subscription's price AND its metadata.plan (the
 * source of truth resolveEffectivePlan reads), so the change is correct
 * immediately, not just after a webhook. Stripe's own Customer Portal
 * can't do this for us: its plan-switcher only offers Products configured
 * in the Dashboard ahead of time, and this app's prices are generated
 * inline (price_data) at checkout, so there is nothing there to pick from.
 */
export async function changeSubscriptionPlan(auth: ServerAuthSession, nextPlan: PaidPlan): Promise<BillingStatus> {
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(auth.user.id)}&select=stripe_subscription_id`)
  const rows = await readSupabaseRestJson<{ stripe_subscription_id: string | null }[]>(response, 'Could not read billing profile')
  const subscriptionId = rows[0]?.stripe_subscription_id
  if (!subscriptionId) throw new SupabaseRequestError('You do not have an active subscription to change. Choose a plan to subscribe instead.', 400)

  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    throw new SupabaseRequestError('Your subscription is not active. Choose a plan to subscribe instead.', 400)
  }
  const item = subscription.items.data[0]
  if (!item) throw new SupabaseRequestError('Could not find a billable item on your subscription.', 502)
  if (subscription.metadata?.plan === nextPlan) {
    return getBillingStatus(auth)
  }

  const config = BILLING_PLAN_CONFIG[nextPlan]
  // Unlike Checkout Sessions, a subscription item's price_data has no inline
  // product_data — it needs a real Product id, so resolve/create one first.
  const productId = await getOrCreatePlanProductId(stripe, nextPlan)
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: item.id,
        price_data: {
          currency: 'usd',
          unit_amount: config.unitAmountCents,
          recurring: { interval: config.interval },
          product: productId,
        },
      },
    ],
    metadata: { ...subscription.metadata, supabase_user_id: auth.user.id, plan: nextPlan },
    // Bill/credit the prorated difference right away rather than silently
    // deferring it to the next renewal — matches what a student clicking
    // "switch to Premium now" expects to happen.
    proration_behavior: 'always_invoice',
  })

  // Sync immediately for instant UI feedback; the webhook will also fire
  // for the same subscription.updated event and re-sync redundantly but
  // harmlessly (syncProfileFromSubscription always re-reads current truth).
  await syncProfileFromSubscription(updated)
  return getBillingStatus(auth)
}

/**
 * Ends a paid subscription immediately, dropping the caller to Free. Needed
 * because the client's "switch to Free" UI previously only flipped local
 * React state — it never touched Stripe, so a real subscriber kept being
 * billed and the change silently reverted the next time billing status was
 * re-fetched (a real Stripe subscription always overrides the local plan).
 * A no-op if the caller has no tracked subscription (e.g. Free already, or
 * on a Nexus-Points-purchased plan, which this function has no reach into).
 */
export async function cancelSubscriptionPlan(auth: ServerAuthSession): Promise<BillingStatus> {
  const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encode(auth.user.id)}&select=stripe_subscription_id`)
  const rows = await readSupabaseRestJson<{ stripe_subscription_id: string | null }[]>(response, 'Could not read billing profile')
  const subscriptionId = rows[0]?.stripe_subscription_id
  if (!subscriptionId) return getBillingStatus(auth)

  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) return getBillingStatus(auth)

  const canceled = await stripe.subscriptions.cancel(subscriptionId)
  await syncProfileFromSubscription(canceled)
  return getBillingStatus(auth)
}
