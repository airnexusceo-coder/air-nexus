import { NextResponse } from 'next/server'
import { getServerAuthSession, readSupabaseRestJson, supabaseServiceFetch, SupabaseConfigurationError } from '@/lib/supabase/server'
import { describeStripeError, getStripeClient, isStripeConfigured, StripeConfigurationError } from '@/lib/billing/stripe'
import { getBillingStatus } from '@/lib/billing/customer'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isStripeConfigured()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })

  try {
    const auth = await getServerAuthSession()
    if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const status = await getBillingStatus(auth)
    if (!status.hasBillingAccount) {
      return NextResponse.json({ error: 'No billing account yet — subscribe to a paid plan first.' }, { status: 400 })
    }

    const response = await supabaseServiceFetch(`/profiles?user_id=eq.${encodeURIComponent(auth.user.id)}&select=stripe_customer_id`)
    const rows = await readSupabaseRestJson<{ stripe_customer_id: string | null }[]>(response, 'Could not read billing profile')
    const customerId = rows[0]?.stripe_customer_id
    if (!customerId) return NextResponse.json({ error: 'No billing account yet — subscribe to a paid plan first.' }, { status: 400 })

    const stripe = getStripeClient()
    const origin = new URL(request.url).origin
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    })
    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    if (error instanceof StripeConfigurationError || error instanceof SupabaseConfigurationError) {
      console.error('Billing configuration error:', error.message)
      return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 })
    }
    const message = describeStripeError(error, 'Could not open the billing portal.')
    console.error('Billing portal error:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
