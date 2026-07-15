import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'
import type { LearningSupport } from '@/lib/market-masters/types'

function encode(value: string) {
  return encodeURIComponent(value)
}

export type MarketMastersProgressInput = {
  day: number
  portfolioValue: number
  returnPercent: number
  lessonsCompleted: number
  lessonsTotal: number
  missionsCompleted: number
  missionsTotal: number
  achievementsUnlocked: number
  diversificationScore: number
  decisionQualityRate: number | null
  misleadingNewsIdentified: number
  reflections: { day: number; text: string }[]
  mode: LearningSupport
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

/** Self-reported summary snapshot — same trust model as lifetime_points and course_selections elsewhere in this app. Clamped defensively so a tampered client can't write nonsense into a row a teacher will read. */
function sanitize(input: MarketMastersProgressInput) {
  const mode: LearningSupport = input.mode === 'occasional' || input.mode === 'minimal' || input.mode === 'sandbox' ? input.mode : 'full'
  return {
    day: clampInt(input.day, 0, 100_000),
    portfolio_value: clampNumber(input.portfolioValue, 0, 100_000_000),
    return_percent: clampNumber(input.returnPercent, -100, 1_000_000),
    lessons_completed: clampInt(input.lessonsCompleted, 0, 1000),
    lessons_total: clampInt(input.lessonsTotal, 0, 1000),
    missions_completed: clampInt(input.missionsCompleted, 0, 1000),
    missions_total: clampInt(input.missionsTotal, 0, 1000),
    achievements_unlocked: clampInt(input.achievementsUnlocked, 0, 1000),
    diversification_score: clampInt(input.diversificationScore, 0, 100),
    decision_quality_rate: input.decisionQualityRate == null ? null : clampNumber(input.decisionQualityRate, 0, 100),
    misleading_news_identified: clampInt(input.misleadingNewsIdentified, 0, 1000),
    reflections: Array.isArray(input.reflections)
      ? input.reflections.slice(-10).map((entry) => ({ day: clampInt(entry?.day ?? 0, 0, 100_000), text: String(entry?.text ?? '').slice(0, 2000) }))
      : [],
    mode,
  }
}

export async function syncMarketMastersProgress(auth: ServerAuthSession, input: MarketMastersProgressInput): Promise<void> {
  const payload = sanitize(input)
  const existingResponse = await supabaseRestFetch(auth.accessToken, `/market_masters_progress?user_id=eq.${encode(auth.user.id)}&select=user_id`)
  const existing = await readSupabaseRestJson<{ user_id: string }[]>(existingResponse, 'Could not load Market Masters progress')

  if (existing.length === 0) {
    const response = await supabaseRestFetch(auth.accessToken, '/market_masters_progress', {
      method: 'POST',
      body: JSON.stringify({ user_id: auth.user.id, ...payload }),
    })
    if (!response.ok) await readSupabaseRestJson(response, 'Could not save Market Masters progress')
    return
  }

  const response = await supabaseRestFetch(auth.accessToken, `/market_masters_progress?user_id=eq.${encode(auth.user.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!response.ok) await readSupabaseRestJson(response, 'Could not save Market Masters progress')
}

export function assertValidProgressInput(body: Record<string, unknown>): MarketMastersProgressInput {
  if (typeof body.day !== 'number' || typeof body.portfolioValue !== 'number') {
    throw new SupabaseRequestError('Invalid progress payload.', 400)
  }
  return {
    day: body.day,
    portfolioValue: body.portfolioValue,
    returnPercent: Number(body.returnPercent) || 0,
    lessonsCompleted: Number(body.lessonsCompleted) || 0,
    lessonsTotal: Number(body.lessonsTotal) || 0,
    missionsCompleted: Number(body.missionsCompleted) || 0,
    missionsTotal: Number(body.missionsTotal) || 0,
    achievementsUnlocked: Number(body.achievementsUnlocked) || 0,
    diversificationScore: Number(body.diversificationScore) || 0,
    decisionQualityRate: body.decisionQualityRate == null ? null : Number(body.decisionQualityRate),
    misleadingNewsIdentified: Number(body.misleadingNewsIdentified) || 0,
    reflections: Array.isArray(body.reflections) ? (body.reflections as { day: number; text: string }[]) : [],
    mode: (body.mode as LearningSupport) ?? 'full',
  }
}
