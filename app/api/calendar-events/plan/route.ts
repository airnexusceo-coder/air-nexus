import { NextResponse } from 'next/server'
import { createCalendarEvent, type CalendarEventDTO } from '@/lib/calendar/calendar'
import { handleAirnexusError, readBody, requireAuth } from '@/lib/airnexus/http'

export const runtime = 'nodejs'

type PlannedEventInput = {
  title: string
  type: 'Study'
  eventDate: string
  time: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00')
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function chooseTime(availability: string, index: number) {
  const normalized = availability.toLowerCase()
  if (/morning|before school|am\b/.test(normalized)) return '8:00 AM'
  if (/lunch|midday|noon/.test(normalized)) return '12:30 PM'
  if (/evening|night|after dinner|pm\b/.test(normalized)) return '7:00 PM'
  if (/weekend|saturday|sunday/.test(normalized)) return index % 2 === 0 ? '10:00 AM' : '2:00 PM'
  if (/after school|afternoon/.test(normalized)) return '4:30 PM'
  return index % 2 === 0 ? '4:30 PM' : '7:00 PM'
}

function buildFallbackPlan(goal: string, deadline: Date, availability: string): PlannedEventInput[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const totalDays = Math.max(1, Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000))
  const sessionCount = Math.min(8, Math.max(3, Math.ceil(totalDays / 2)))
  const cleanGoal = goal.replace(/\s+/g, ' ').slice(0, 72)
  const planned: PlannedEventInput[] = []

  for (let index = 0; index < sessionCount; index += 1) {
    const offset = Math.min(totalDays, Math.max(0, Math.round((index / Math.max(1, sessionCount - 1)) * totalDays)))
    const label = index === 0
      ? 'Map out'
      : index === sessionCount - 1
        ? 'Final review'
        : `Study block ${index + 1}`
    planned.push({
      title: `${label}: ${cleanGoal}`,
      type: 'Study',
      eventDate: dateKey(addDays(today, offset)),
      time: chooseTime(availability, index),
    })
  }

  return planned
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    const body = await readBody(request)
    if (!isRecord(body)) return NextResponse.json({ error: 'Add a goal and deadline.' }, { status: 400 })

    const goal = readText(body.goal, 160)
    const availability = readText(body.availability, 220)
    const deadline = parseDateOnly(readText(body.deadline, 20))
    if (!goal) return NextResponse.json({ error: 'Add a planning goal.' }, { status: 400 })
    if (!deadline) return NextResponse.json({ error: 'Choose a valid deadline.' }, { status: 400 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (deadline.getTime() < today.getTime()) return NextResponse.json({ error: 'Choose a deadline today or later.' }, { status: 400 })

    const planned = buildFallbackPlan(goal, deadline, availability)
    const events: CalendarEventDTO[] = []
    for (const item of planned) {
      events.push(await createCalendarEvent(auth, item))
    }

    return NextResponse.json({ events, provider: 'Calendar planner' }, { status: 201 })
  } catch (error) {
    return handleAirnexusError(error)
  }
}