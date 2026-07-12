import { NextResponse } from 'next/server'
import { createAchievement, listAchievements } from '@/lib/admin/achievements'
import { requireAdminSession, requirePermission } from '@/lib/admin/session'
import { handleAirnexusError, readBody } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'achievements.view')
    const achievements = await listAchievements()
    return NextResponse.json({ achievements })
  } catch (error) {
    return handleAirnexusError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminSession()
    requirePermission(admin, 'achievements.create')
    const body = await readBody(request)
    const achievement = await createAchievement(
      admin,
      typeof body.slug === 'string' ? body.slug : '',
      typeof body.name === 'string' ? body.name : '',
      typeof body.description === 'string' ? body.description : '',
    )
    return NextResponse.json(achievement, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}
