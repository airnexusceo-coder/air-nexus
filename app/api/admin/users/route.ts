import { NextResponse } from 'next/server'
import { createUser, listUsers } from '@/lib/admin/users'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'users.view')
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '1') || 1
    const users = await listUsers(page)
    return NextResponse.json({ users })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'users.create')
    const body = await readBody(request)
    const user = await createUser(
      admin,
      typeof body.email === 'string' ? body.email : '',
      typeof body.password === 'string' ? body.password : '',
      typeof body.displayName === 'string' ? body.displayName : undefined,
    )
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
