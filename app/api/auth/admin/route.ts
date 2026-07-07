import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json({ error: 'Legacy administrator login has been disabled. Use Supabase Auth.' }, { status: 410 })
}
