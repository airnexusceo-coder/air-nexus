import { NextResponse } from 'next/server'
import { acquireTechnology, listTechnologies } from '@/lib/apex/vault/technologies'
import { handleApexError } from '@/lib/apex/vault/errors'
import { readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const technologies = await listTechnologies(auth.user.id)
    return NextResponse.json({ technologies })
  } catch (error) {
    return handleApexError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const technology = await acquireTechnology(auth, String(body.technologySlug ?? ''))
    return NextResponse.json({ technology }, { status: 201 })
  } catch (error) {
    return handleApexError(error)
  }
}