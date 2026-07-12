import { NextResponse } from 'next/server'
import { getVaultOverview, setAutoRepair, setBreachesEnabled } from '@/lib/apex/vault/vault'
import { handleApexError } from '@/lib/apex/vault/errors'
import { readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const overview = await getVaultOverview(auth.user.id)
    return NextResponse.json(overview)
  } catch (error) {
    return handleApexError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    if (typeof body.autoRepairEnabled === 'boolean' || typeof body.autoRepairReserve === 'number') {
      const overview = await setAutoRepair(auth, Boolean(body.autoRepairEnabled), Number(body.autoRepairReserve) || 0)
      return NextResponse.json(overview)
    }
    if (typeof body.breachesEnabled === 'boolean') {
      const overview = await setBreachesEnabled(auth, body.breachesEnabled)
      return NextResponse.json(overview)
    }
    return NextResponse.json({ error: 'No recognised Vault setting in request body.' }, { status: 400 })
  } catch (error) {
    return handleApexError(error)
  }
}