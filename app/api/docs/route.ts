import { NextResponse } from 'next/server'
import { createDoc, listMyDocs } from '@/lib/docs/docs'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireAuth()
    const docs = await listMyDocs(auth)
    return NextResponse.json({ docs })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    const doc = await createDoc(auth, typeof body.title === 'string' ? body.title : undefined)
    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
