/**
 * Victorian government school term dates. Used only to compute "access
 * lasts until the holidays" for a purchased course. These are approximate
 * — VIC DET publishes exact dates each year at
 * https://www.vic.gov.au/school-term-dates-and-holidays-victoria — update
 * this table at the start of each school year rather than trusting it
 * blindly for anything date-sensitive beyond a course-access expiry.
 */

type TermWindow = { start: string; end: string }

const VIC_SCHOOL_TERMS: TermWindow[] = [
  { start: '2026-01-28', end: '2026-03-27' },
  { start: '2026-04-13', end: '2026-06-26' },
  { start: '2026-07-13', end: '2026-09-18' },
  { start: '2026-10-05', end: '2026-12-18' },
  // 2027 term 1, so a purchase made in December 2026 still resolves to a real date.
  { start: '2027-01-27', end: '2027-03-26' },
]

/** The end date of the school term containing (or next following) `from` — i.e. "the next holidays". */
export function nextHolidayEndDate(from = new Date()): Date {
  const fromTime = from.getTime()
  for (const term of VIC_SCHOOL_TERMS) {
    const end = new Date(`${term.end}T23:59:59`)
    if (end.getTime() >= fromTime) return end
  }
  // Fallback if the table runs out: 90 days out, rather than an undefined expiry.
  return new Date(fromTime + 90 * 24 * 60 * 60 * 1000)
}
