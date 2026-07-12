import { NextResponse } from 'next/server'
import {
  activateDefence,
  deactivateDefence,
  installTechnology,
  reorderDefences,
  setEnergyPriority,
  uninstallTechnology,
} from '@/lib/apex/vault/vault'
import { handleApexError } from '@/lib/apex/vault/errors'
import { readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

/**
 * Every Manage Vault defence action (install / uninstall / activate /
 * deactivate / reorder / set energy priority) in one route, discriminated by
 * `action` - these are all "manage my installed defence chain" operations on
 * the same resource, so one endpoint avoids a proliferation of near-identical
 * route files for each verb.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const action = body.action

    if (action === 'install') {
      const overview = await installTechnology(auth, String(body.technologySlug ?? ''))
      return NextResponse.json(overview, { status: 201 })
    }
    if (action === 'uninstall') {
      const overview = await uninstallTechnology(auth, String(body.defenceId ?? ''))
      return NextResponse.json(overview)
    }
    if (action === 'activate') {
      const overview = await activateDefence(auth, String(body.defenceId ?? ''))
      return NextResponse.json(overview)
    }
    if (action === 'deactivate') {
      const overview = await deactivateDefence(auth, String(body.defenceId ?? ''))
      return NextResponse.json(overview)
    }
    if (action === 'reorder') {
      const overview = await reorderDefences(auth, Array.isArray(body.orderedDefenceIds) ? body.orderedDefenceIds.map(String) : [])
      return NextResponse.json(overview)
    }
    if (action === 'set_priority') {
      const overview = await setEnergyPriority(auth, Array.isArray(body.orderedDefenceIds) ? body.orderedDefenceIds.map(String) : [])
      return NextResponse.json(overview)
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    return handleApexError(error)
  }
}