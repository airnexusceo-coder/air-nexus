import type { AiLessonSlide } from '@/lib/courses/lesson-pack-types'
import type { AreaQuiz, AreaQuizPreview } from '@/lib/courses/area-quiz-types'

/** One calendar day's study session for one Area of Study. Quiz is a full AreaQuiz once attempted (answers safe to reveal), otherwise a preview with no answers. */
export type CourseAreaSessionDTO = {
  id: string
  courseId: string
  unit: 1 | 2 | 3 | 4
  areaId: string
  sessionDate: string
  slides: AiLessonSlide[]
  quiz: AreaQuiz | AreaQuizPreview
  quizAttempted: boolean
  quizScore: number | null
  quizTotal: number | null
  quizPassed: boolean
  quizAnswers: number[] | null
  generatedBy: 'ai' | 'fallback'
}

export type AreaQuizGradeResult = {
  score: number
  total: number
  passed: boolean
  quiz: AreaQuiz
  answers: number[]
}

export type AreaProgressSummary = {
  areaId: string
  mastered: boolean
  masteredAt: string | null
  lastStudiedDate: string | null
  bestScore: number | null
  bestTotal: number | null
  attemptsCount: number
  studiedToday: boolean
  attemptedToday: boolean
}

export type CourseQuizAnalytics = {
  courseId: string
  areasStudied: number
  areasMastered: number
  quizAttempts: number
  averageScorePercent: number | null
}

/** Cross-course rollup for the Analytics page — real numbers derived from course_area_sessions, never invented. */
export type StudyAnalyticsSummary = {
  totalAreasStudied: number
  totalAreasMastered: number
  totalQuizAttempts: number
  averageScorePercent: number | null
  byCourse: CourseQuizAnalytics[]
}
