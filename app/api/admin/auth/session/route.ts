import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin/session'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const admin = await requireAdminSession()
    return NextResponse.json({ id: admin.id, username: admin.username, role: admin.role, permissions: admin.permissions })
  } catch {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
}
