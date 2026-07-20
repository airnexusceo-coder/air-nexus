import 'server-only'

import { readSupabaseRestJson, supabaseRestFetch, SupabaseRequestError, type ServerAuthSession } from '@/lib/supabase/server'
import type { VceCourse, VceCourseChapter, VceCourseLevel } from '@/lib/courses/vce-catalog'
import { createAiAreaLessonPack } from '@/lib/courses/ai-lesson-pack'
import { createAiAreaQuiz } from '@/lib/courses/ai-area-quiz'
import { toAreaQuizPreview, type AreaQuiz } from '@/lib/courses/area-quiz-types'
import type { AiLessonSlide } from '@/lib/courses/lesson-pack-types'
import type { AreaProgressSummary, AreaQuizGradeResult, CourseAreaSessionDTO } from '@/lib/courses/area-session-types'

/**
 * Real mastery-gated Area of Study study loop — backed by migration 0022.
 * One AI-generated slide deck (with diagrams) + one multiple-choice quiz
 * per user/course/unit/area/calendar day. Passing (100%) marks the area
 * mastered; failing keeps the same area active and the next day's session
 * is generated adaptively from the questions the student got wrong. All
 * progress is derived by querying course_area_sessions — there is no
 * separate progress table to keep in sync.
 */

function encode(value: string) {
  return encodeURIComponent(value)
}

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

type SessionRow = {
  id: string
  course_id: string
  unit: 1 | 2 | 3 | 4
  area_id: string
  session_date: string
  slides: AiLessonSlide[]
  quiz: AreaQuiz
  quiz_attempted: boolean
  quiz_score: number | null
  quiz_total: number | null
  quiz_passed: boolean
  quiz_answers: number[] | null
  generated_by: 'ai' | 'fallback'
}

type ProgressRow = Pick<SessionRow, 'area_id' | 'session_date' | 'quiz_attempted' | 'quiz_passed' | 'quiz_score' | 'quiz_total'>

function toDTO(row: SessionRow): CourseAreaSessionDTO {
  return {
    id: row.id,
    courseId: row.course_id,
    unit: row.unit,
    areaId: row.area_id,
    sessionDate: row.session_date,
    slides: row.slides,
    quiz: row.quiz_attempted ? row.quiz : toAreaQuizPreview(row.quiz),
    quizAttempted: row.quiz_attempted,
    quizScore: row.quiz_score,
    quizTotal: row.quiz_total,
    quizPassed: row.quiz_passed,
    quizAnswers: row.quiz_answers,
    generatedBy: row.generated_by,
  }
}

async function findSession(auth: ServerAuthSession, courseId: string, unit: number, areaId: string, sessionDate: string): Promise<SessionRow | null> {
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/course_area_sessions?user_id=eq.${encode(auth.user.id)}&course_id=eq.${encode(courseId)}&unit=eq.${unit}&area_id=eq.${encode(areaId)}&session_date=eq.${sessionDate}&select=*`,
  )
  const rows = await readSupabaseRestJson<SessionRow[]>(response, 'Could not load study session')
  return rows[0] ?? null
}

async function mostRecentSessionBefore(auth: ServerAuthSession, courseId: string, unit: number, areaId: string, beforeDate: string): Promise<SessionRow | null> {
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/course_area_sessions?user_id=eq.${encode(auth.user.id)}&course_id=eq.${encode(courseId)}&unit=eq.${unit}&area_id=eq.${encode(areaId)}&session_date=lt.${beforeDate}&select=*&order=session_date.desc&limit=1`,
  )
  const rows = await readSupabaseRestJson<SessionRow[]>(response, 'Could not load previous study session')
  return rows[0] ?? null
}

function extractPreviousMistakes(previous: SessionRow | null): string[] {
  if (!previous || !previous.quiz_attempted || previous.quiz_passed || !previous.quiz_answers) return []
  return previous.quiz.questions
    .filter((question, index) => previous.quiz_answers?.[index] !== question.correctIndex)
    .map((question) => question.question)
    .slice(0, 8)
}

/** Idempotent: returns the existing session for today if one exists, otherwise generates and persists a new one. Adapts to yesterday's mistakes if the area wasn't mastered last time. */
export async function getOrCreateTodaySession(
  auth: ServerAuthSession,
  course: VceCourse,
  level: VceCourseLevel,
  chapter: VceCourseChapter,
  signal?: AbortSignal,
): Promise<CourseAreaSessionDTO> {
  const today = todayDateKey()
  const existing = await findSession(auth, course.id, level.unit, chapter.id, today)
  if (existing) return toDTO(existing)

  const previous = await mostRecentSessionBefore(auth, course.id, level.unit, chapter.id, today)
  const previousMistakes = extractPreviousMistakes(previous)

  const [pack, quiz] = await Promise.all([
    createAiAreaLessonPack(course, level, chapter, previousMistakes, signal),
    createAiAreaQuiz(course, level, chapter, previousMistakes, signal),
  ])

  const response = await supabaseRestFetch(auth.accessToken, '/course_area_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: auth.user.id,
      course_id: course.id,
      unit: level.unit,
      area_id: chapter.id,
      session_date: today,
      slides: pack.slides,
      quiz,
      generated_by: pack.generatedBy,
    }),
  })

  if (!response.ok) {
    // Most likely a concurrent create raced us and hit the unique constraint — the row now exists, so use it instead of failing.
    const raced = await findSession(auth, course.id, level.unit, chapter.id, today)
    if (raced) return toDTO(raced)
  }

  const rows = await readSupabaseRestJson<SessionRow[]>(response, 'Could not create study session')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Could not create study session.', 502)
  return toDTO(row)
}

export async function submitAreaQuizAttempt(auth: ServerAuthSession, sessionId: string, answers: unknown): Promise<AreaQuizGradeResult> {
  const response = await supabaseRestFetch(auth.accessToken, `/course_area_sessions?id=eq.${encode(sessionId)}&user_id=eq.${encode(auth.user.id)}&select=*`)
  const rows = await readSupabaseRestJson<SessionRow[]>(response, 'Could not load study session')
  const row = rows[0]
  if (!row) throw new SupabaseRequestError('Study session not found.', 404)
  if (row.session_date !== todayDateKey()) throw new SupabaseRequestError("This session is no longer today's — open the Area of Study again to start a fresh session.", 409)
  if (row.quiz_attempted) throw new SupabaseRequestError("You've already attempted today's quiz for this Area of Study. Come back tomorrow for a new one.", 409)

  const questions = row.quiz.questions
  if (!Array.isArray(answers) || answers.length !== questions.length) throw new SupabaseRequestError('Answer every question before submitting.', 400)

  const normalisedAnswers = questions.map((_, index) => {
    const value = answers[index]
    return typeof value === 'number' && Number.isInteger(value) ? value : -1
  })
  const total = questions.length
  const score = normalisedAnswers.filter((answer, index) => answer === questions[index].correctIndex).length
  const passed = score === total

  const patchResponse = await supabaseRestFetch(auth.accessToken, `/course_area_sessions?id=eq.${encode(sessionId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ quiz_attempted: true, quiz_score: score, quiz_total: total, quiz_passed: passed, quiz_answers: normalisedAnswers }),
  })
  if (!patchResponse.ok) throw new SupabaseRequestError('Could not save your quiz result.', patchResponse.status)

  return { score, total, passed, quiz: row.quiz, answers: normalisedAnswers }
}

export async function listAreaProgress(auth: ServerAuthSession, courseId: string, unit: number): Promise<AreaProgressSummary[]> {
  const response = await supabaseRestFetch(
    auth.accessToken,
    `/course_area_sessions?user_id=eq.${encode(auth.user.id)}&course_id=eq.${encode(courseId)}&unit=eq.${unit}&select=area_id,session_date,quiz_attempted,quiz_passed,quiz_score,quiz_total&order=session_date.asc`,
  )
  const rows = await readSupabaseRestJson<ProgressRow[]>(response, 'Could not load study progress')

  const today = todayDateKey()
  const byArea = new Map<string, ProgressRow[]>()
  for (const row of rows) {
    const list = byArea.get(row.area_id) ?? []
    list.push(row)
    byArea.set(row.area_id, list)
  }

  return [...byArea.entries()].map(([areaId, sessions]): AreaProgressSummary => {
    const passedSession = sessions.find((session) => session.quiz_passed)
    const attempted = sessions.filter((session) => session.quiz_attempted && session.quiz_score !== null)
    const bestScoringSession = attempted.reduce<ProgressRow | null>(
      (best, session) => (best === null || (session.quiz_score ?? 0) > (best.quiz_score ?? 0) ? session : best),
      null,
    )
    const latest = sessions[sessions.length - 1]
    return {
      areaId,
      mastered: Boolean(passedSession),
      masteredAt: passedSession?.session_date ?? null,
      lastStudiedDate: latest?.session_date ?? null,
      bestScore: bestScoringSession?.quiz_score ?? null,
      bestTotal: bestScoringSession?.quiz_total ?? null,
      attemptsCount: attempted.length,
      studiedToday: latest?.session_date === today,
      attemptedToday: sessions.some((session) => session.session_date === today && session.quiz_attempted),
    }
  })
}
