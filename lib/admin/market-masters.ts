import 'server-only'

import { readSupabaseRestJson, supabaseServiceFetch } from '@/lib/supabase/server'

function encode(value: string) {
  return encodeURIComponent(value)
}

type ProgressRow = {
  user_id: string
  day: number
  portfolio_value: number
  return_percent: number
  lessons_completed: number
  lessons_total: number
  missions_completed: number
  missions_total: number
  achievements_unlocked: number
  diversification_score: number
  decision_quality_rate: number | null
  misleading_news_identified: number
  reflections: { day: number; text: string }[]
  mode: string
  updated_at: string
}

type ProfileRow = { user_id: string; display_name: string }

export type StudentProgress = {
  userId: string
  displayName: string
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
  mode: string
  updatedAt: string
  /**
   * Composite 0-100 score weighting learning behaviour over raw returns —
   * lesson/mission completion, decision quality, and diversification, not
   * how much virtual money a student ended up with. Portfolio return is
   * intentionally excluded so the leaderboard cannot be gamed by luck alone.
   */
  learningScore: number
}

function computeLearningScore(row: ProgressRow): number {
  const lessonRate = row.lessons_total > 0 ? row.lessons_completed / row.lessons_total : 0
  const missionRate = row.missions_total > 0 ? row.missions_completed / row.missions_total : 0
  const decisionRate = (row.decision_quality_rate ?? 0) / 100
  const diversification = row.diversification_score / 100
  const score = lessonRate * 35 + missionRate * 30 + decisionRate * 20 + diversification * 15
  return Math.round(Math.max(0, Math.min(100, score)))
}

export async function listStudentProgress(): Promise<StudentProgress[]> {
  const progressResponse = await supabaseServiceFetch('/market_masters_progress?select=*&order=updated_at.desc')
  const progressRows = await readSupabaseRestJson<ProgressRow[]>(progressResponse, 'Failed to load Market Masters progress')
  if (progressRows.length === 0) return []

  const userIds = Array.from(new Set(progressRows.map((row) => row.user_id)))
  const profilesResponse = await supabaseServiceFetch(`/profiles?user_id=in.(${userIds.map(encode).join(',')})&select=user_id,display_name`)
  const profiles = await readSupabaseRestJson<ProfileRow[]>(profilesResponse, 'Failed to load student profiles')
  const nameByUser = new Map(profiles.map((profile) => [profile.user_id, profile.display_name]))

  return progressRows
    .map((row) => ({
      userId: row.user_id,
      displayName: nameByUser.get(row.user_id) ?? 'AirNexus student',
      day: row.day,
      portfolioValue: row.portfolio_value,
      returnPercent: row.return_percent,
      lessonsCompleted: row.lessons_completed,
      lessonsTotal: row.lessons_total,
      missionsCompleted: row.missions_completed,
      missionsTotal: row.missions_total,
      achievementsUnlocked: row.achievements_unlocked,
      diversificationScore: row.diversification_score,
      decisionQualityRate: row.decision_quality_rate,
      misleadingNewsIdentified: row.misleading_news_identified,
      reflections: row.reflections ?? [],
      mode: row.mode,
      updatedAt: row.updated_at,
      learningScore: computeLearningScore(row),
    }))
    .sort((a, b) => b.learningScore - a.learningScore)
}
