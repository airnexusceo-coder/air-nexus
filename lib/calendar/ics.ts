/**
 * RFC 5545 (iCalendar) build + parse helpers — the real bridge between
 * AirGPT's own calendar_events and Google Calendar / Outlook / Apple
 * Calendar, without needing OAuth credentials from any provider. Times are
 * written as floating (no trailing Z, no TZID), so each calendar app shows
 * them in whatever timezone it's already set to, matching how the events
 * were entered here.
 */

export type IcsSourceEvent = {
  id: string
  title: string
  type: 'Deadline' | 'Exam' | 'Study'
  eventDate: string // YYYY-MM-DD
  time: string // "HH:MM" (24h) or a free-form label like "Any time"
}

export type ParsedIcsEvent = {
  title: string
  eventDate: string
  time: string
}

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

function icsEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function foldLine(line: string): string {
  if (line.length <= 75) return line
  let result = line.slice(0, 75)
  let rest = line.slice(75)
  while (rest.length > 0) {
    result += '\r\n ' + rest.slice(0, 74)
    rest = rest.slice(74)
  }
  return result
}

function parseTimeLabel(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

export function buildIcsCalendar(events: IcsSourceEvent[]): string {
  const now = new Date()
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AirGPT//Calendar Export//EN', 'CALSCALE:GREGORIAN']

  for (const event of events) {
    const [year, month, day] = event.eventDate.split('-').map(Number)
    if (!year || !month || !day) continue
    const clock = parseTimeLabel(event.time)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:airgpt-${event.id}@airgpt.app`)
    lines.push(`DTSTAMP:${dtstamp}`)

    if (clock) {
      const start = new Date(year, month - 1, day, clock.hour, clock.minute)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      const stamp = (date: Date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`
      lines.push(`DTSTART:${stamp(start)}`)
      lines.push(`DTEND:${stamp(end)}`)
    } else {
      const end = new Date(year, month - 1, day + 1)
      lines.push(`DTSTART;VALUE=DATE:${year}${pad(month)}${pad(day)}`)
      lines.push(`DTEND;VALUE=DATE:${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}`)
    }

    lines.push(foldLine(`SUMMARY:${icsEscape(event.title)}`))
    lines.push(`CATEGORIES:${event.type}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function unescapeIcsText(value: string) {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function parseDtstart(raw: string): { date: string; time: string } | null {
  const match = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})?Z?)?$/.exec(raw.trim())
  if (!match) return null
  const [, year, month, day, , hour, minute] = match
  return {
    date: `${year}-${month}-${day}`,
    time: hour && minute ? `${hour}:${minute}` : 'Any time',
  }
}

/** Parses top-level VEVENT blocks (SUMMARY + DTSTART only). Recurring series import as a single occurrence. */
export function parseIcsEvents(icsText: string): ParsedIcsEvent[] {
  const unfolded = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
  const lines = unfolded.split(/\r\n|\n|\r/)

  const events: ParsedIcsEvent[] = []
  let current: { summary?: string; dtstart?: string } | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current?.summary && current?.dtstart) {
        const parsed = parseDtstart(current.dtstart)
        if (parsed) events.push({ title: current.summary, eventDate: parsed.date, time: parsed.time })
      }
      current = null
      continue
    }
    if (!current) continue

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex)
    const value = line.slice(colonIndex + 1)
    const property = key.split(';')[0]?.toUpperCase()

    if (property === 'SUMMARY') current.summary = unescapeIcsText(value)
    if (property === 'DTSTART') current.dtstart = value
  }

  return events
}

export function guessIcsEventType(title: string): IcsSourceEvent['type'] {
  const lower = title.toLowerCase()
  if (/\bexam\b|\btest\b/.test(lower)) return 'Exam'
  if (/\bdeadline\b|\bdue\b|\bsubmission\b/.test(lower)) return 'Deadline'
  return 'Study'
}
