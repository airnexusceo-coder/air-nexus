import assert from 'node:assert/strict'
import { ACTIVE_SUBSCRIPTION_STATUSES, isPaidPlan, resolveEffectivePlan } from '../lib/billing/plans'

// --- isPaidPlan --------------------------------------------------------

assert.equal(isPaidPlan('Plus'), true, 'Plus is a paid plan')
assert.equal(isPaidPlan('Premium'), true, 'Premium is a paid plan')
assert.equal(isPaidPlan('Free'), false, 'Free is not a paid plan — it has no Stripe price')
assert.equal(isPaidPlan(undefined), false, 'undefined is not a paid plan')
assert.equal(isPaidPlan('plus'), false, 'plan names are case-sensitive — a lowercase value from a malformed webhook payload is rejected')

// --- resolveEffectivePlan -----------------------------------------------
// The single place a Stripe subscription (metadata.plan, status) turns into
// what profiles.plan should hold. Must fail closed to Free on anything that
// isn't a currently-collectible subscription.

for (const status of Array.from(ACTIVE_SUBSCRIPTION_STATUSES)) {
  assert.equal(resolveEffectivePlan('Plus', status), 'Plus', `status "${status}" keeps a Plus subscription active`)
  assert.equal(resolveEffectivePlan('Premium', status), 'Premium', `status "${status}" keeps a Premium subscription active`)
}

for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'paused', 'unpaid']) {
  assert.equal(resolveEffectivePlan('Plus', status), 'Free', `status "${status}" reverts to Free even though metadata still says Plus`)
}

assert.equal(resolveEffectivePlan(undefined, 'active'), 'Free', 'a subscription with no plan metadata (e.g. created outside this app) never grants a paid plan')
assert.equal(resolveEffectivePlan('Enterprise', 'active'), 'Free', 'an unrecognized plan name in metadata is rejected, not passed through')

console.log('Billing pure-logic tests passed')
