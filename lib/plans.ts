export type NexusPlan = 'Free' | 'Plus' | 'Premium'

export const PLAN_DETAILS: Record<NexusPlan, { price: string; points: number; summary: string }> = {
  Free: { price: 'FREE', points: 0, summary: 'Core study tools and basic AI' },
  Plus: { price: '$1.99/month', points: 1000, summary: 'Unlimited AI and smarter planning' },
  Premium: { price: '$5/month', points: 2500, summary: 'Personal tutoring and every premium tool' },
}

export const FREE_GATED_SECTIONS = new Set(['Analytics', 'Integrations'])

export function formatPlanExpiry(expiry: string | null) {
  if (!expiry) return 'No expiry'
  const date = new Date(expiry)
  if (Number.isNaN(date.getTime())) return 'No expiry'
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}