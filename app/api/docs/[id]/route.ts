import { NextResponse } from 'next/server'
import { deleteDoc, getDoc, updateDoc } from '@/lib/docs/docs'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const doc = await getDoc(auth, id)
    return NextResponse.json(doc)
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    const body = await readBody(request)
    const doc = await updateDoc(auth, id, {
      title: typeof body.title === 'string' ? body.title : undefined,
      body: typeof body.body === 'string' ? body.body : undefined,
      checklist: body.checklist,
    })
    return NextResponse.json(doc)
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const { id } = await params
    await deleteDoc(auth, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
