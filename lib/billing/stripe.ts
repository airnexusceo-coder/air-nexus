import 'server-only'

import Stripe from 'stripe'
import { BILLING_PLAN_CONFIG, type PaidPlan } from '@/lib/billing/plans'

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeConfigurationError'
  }
}

let cachedClient: Stripe | null = null

/** Lazily constructed so importing this module never throws when STRIPE_SECRET_KEY is unset — matches the rest of the app's "missing key -> 503 at the route, not at import time" convention. */
export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new StripeConfigurationError('Missing STRIPE_SECRET_KEY')
  cachedClient = new Stripe(key, { apiVersion: '2026-06-24.dahlia' })
  return cachedClient
}

export function getStripeWebhookSecret(): string {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!value) throw new StripeConfigurationError('Missing STRIPE_WEBHOOK_SECRET')
  return value
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** Stripe's own error messages are developer-facing account/setup diagnostics (e.g. "no customer portal configuration"), safe to relay as-is rather than flattening into a generic message. */
export function describeStripeError(error: unknown, fallback: string): string {
  if (error instanceof Stripe.errors.StripeError) return error.message || fallback
  return fallback
}

/** Deterministic, fixed Product IDs for the paid plans, distinct per Stripe mode (test vs. live keys are separate accounts, so no collision risk). Unlike Checkout Sessions, `subscriptions.update()`'s price_data requires an existing Product id — it has no inline `product_data` escape hatch — so switching an existing subscription's plan needs a real Product to reference. */
const PLAN_PRODUCT_IDS: Record<PaidPlan, string> = {
  Plus: 'airnexus-plan-plus',
  Premium: 'airnexus-plan-premium',
}

/** Gets (or lazily creates, on first use) the Stripe Product backing a paid plan's subscription-update price_data. Still requires zero manual Stripe Dashboard setup — the Product is created via the API the first time anyone switches plans. */
export async function getOrCreatePlanProductId(stripe: Stripe, plan: PaidPlan): Promise<string> {
  const productId = PLAN_PRODUCT_IDS[plan]
  try {
    const product = await stripe.products.retrieve(productId)
    if (!('deleted' in product && product.deleted)) return product.id
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError) || error.statusCode !== 404) throw error
  }
  const config = BILLING_PLAN_CONFIG[plan]
  const created = await stripe.products.create({ id: productId, name: config.productName })
  return created.id
}
