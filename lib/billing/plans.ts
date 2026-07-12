import type { NexusPlan } from '../plans'

export type PaidPlan = 'Plus' | 'Premium'

/** Cents-based mirror of lib/plans.ts's PLAN_DETAILS prices — Stripe wants integer minor units, not display strings. Checkout builds prices inline (price_data) from this, so no Product/Price objects need to be pre-created in the Stripe Dashboard. */
export const BILLING_PLAN_CONFIG: Record<PaidPlan, { productName: string; unitAmountCents: number; interval: 'month' }> = {
  Plus: { productName: 'AirNexus Plus', unitAmountCents: 199, interval: 'month' },
  Premium: { productName: 'AirNexus Premium', unitAmountCents: 500, interval: 'month' },
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'Plus' || value === 'Premium'
}

/** Subscription statuses that keep a customer's paid access active — includes past_due so a single failed renewal charge doesn't instantly lock a paying user out while Stripe's dunning retries run. */
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due'])

/**
 * The single place that turns a Stripe subscription's (metadata, status)
 * pair into the plan profiles.plan should hold. Used by the webhook handler
 * so the effective plan always degrades to Free the moment Stripe stops
 * considering the subscription active/collectible — never trusts a stale
 * "plan" value on its own.
 */
export function resolveEffectivePlan(metadataPlan: unknown, status: string): NexusPlan {
  if (!isPaidPlan(metadataPlan)) return 'Free'
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status) ? metadataPlan : 'Free'
}
