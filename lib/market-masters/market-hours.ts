import { MARKET_CLOSE_HOUR, MARKET_OPEN_HOUR } from '@/lib/market-masters/types'

/**
 * The market follows real local trading hours, exactly like a real exchange:
 * 9:00 AM to 5:00 PM, Monday to Friday, in whatever timezone the player's
 * device is set to. There is no player-selectable "speed" — this is the one
 * clock everyone plays by.
 */
export function isMarketOpenAt(date: Date): boolean {
  const weekday = date.getDay() // 0 = Sunday, 6 = Saturday
  if (weekday === 0 || weekday === 6) return false
  const minutesSinceMidnight = date.getHours() * 60 + date.getMinutes()
  return minutesSinceMidnight >= MARKET_OPEN_HOUR * 60 && minutesSinceMidnight < MARKET_CLOSE_HOUR * 60
}

function atLocalTime(date: Date, hour: number, minute = 0): Date {
  const next = new Date(date)
  next.setHours(hour, minute, 0, 0)
  return next
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** The next moment the market opens — later today if it's a weekday before 9am, otherwise the next weekday at 9am. */
export function nextMarketOpen(from: Date): Date {
  let candidate = atLocalTime(from, MARKET_OPEN_HOUR)
  if (candidate <= from) candidate = addDays(candidate, 1)
  while (candidate.getDay() === 0 || candidate.getDay() === 6) {
    candidate = addDays(candidate, 1)
  }
  return atLocalTime(candidate, MARKET_OPEN_HOUR)
}

/** Today's close time (5pm) — only meaningful to call while the market is open. */
export function todayMarketClose(from: Date): Date {
  return atLocalTime(from, MARKET_CLOSE_HOUR)
}

/** Local calendar-date key (YYYY-MM-DD) in the player's own timezone — not UTC, so "today" matches what the player's clock says. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** A friendly real date for display — e.g. "Tuesday, 14 January". */
export function formatMarketDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatMarketTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
