import { GroqApiError, GroqConfigurationError } from '@/lib/ai/groq'
import { createTutorReplyWithFallback } from '@/lib/ai/text-fallback'
import { ProviderApiError, ProviderConfigurationError } from '@/lib/ai/providers/types'
import type { AreaQuiz, AreaQuizQuestion } from '@/lib/courses/area-quiz-types'
import type { VceCourse, VceCourseChapter, VceCourseLevel, VceKeyKnowledgePoint } from '@/lib/courses/vce-catalog'
import { VCE_STUDY_DESIGN_SOURCE } from '@/lib/courses/vce-catalog'

const TARGET_QUESTIONS = 8
const MIN_QUESTIONS = 4

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function extractJsonObject(value: string) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(value)
  const candidate = fenced?.[1] ?? value
  const first = candidate.indexOf('{')
  const last = candidate.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) throw new Error('AI area quiz did not include JSON')
  return JSON.parse(candidate.slice(first, last + 1)) as unknown
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function normaliseQuestion(value: unknown, index: number): AreaQuizQuestion | null {
  const record = asRecord(value)
  if (!record) return null
  const question = asString(record.question)
  const optionsRaw = Array.isArray(record.options) ? record.options.map((item) => asString(item)).filter(Boolean) : []
  if (!question || optionsRaw.length !== 4) return null
  const correctIndex = typeof record.correctIndex === 'number' && Number.isInteger(record.correctIndex) ? record.correctIndex : -1
  if (correctIndex < 0 || correctIndex > 3) return null
  const explanation = asString(record.explanation, 'Review the correct option above and compare it with your answer.')
  return { id: asString(record.id, `q-${index + 1}`), question, options: optionsRaw, correctIndex, explanation }
}

function normaliseQuiz(value: unknown, chapterTitle: string): AreaQuiz | null {
  const record = asRecord(value)
  if (!record) return null
  const questionsRaw = Array.isArray(record.questions) ? record.questions : []
  const questions = questionsRaw.map((item, index) => normaliseQuestion(item, index)).filter((question): question is AreaQuizQuestion => question !== null).slice(0, TARGET_QUESTIONS)
  if (questions.length < MIN_QUESTIONS) return null
  return { title: asString(record.title, `${chapterTitle} mastery quiz`), questions }
}

function buildQuizPrompt(course: VceCourse, level: VceCourseLevel, chapter: VceCourseChapter, previousMistakes: string[]) {
  const knowledgeOutline = chapter.lessons.flatMap((lesson) => lesson.keyKnowledge.map((point) => `- ${point.label}: ${point.detail}`)).join('\n')
  const reteachNote = previousMistakes.length > 0
    ? `\n\nThe student got these ideas wrong on their last attempt — make sure at least half of the questions directly test whether they now understand them:\n${previousMistakes.map((mistake) => `- ${mistake}`).join('\n')}`
    : ''

  return `Create a short mastery quiz for ${course.name}, ${level.title}, Area of Study: "${chapter.title}".

This quiz decides whether the student has mastered this one Area of Study — they must answer every question correctly to pass. Every question must be unambiguous, with exactly one clearly correct option.

Area of Study key knowledge:
${knowledgeOutline}${reteachNote}

Return strict JSON only, no markdown, with this shape:
{
  "title": "short quiz title",
  "questions": [
    {
      "id": "q-1",
      "question": "a clear, single-concept question scoped to this Area of Study",
      "options": ["exactly 4 options, one correct"],
      "correctIndex": 0,
      "explanation": "one or two sentences a student reads after answering, explaining why the correct option is right"
    }
  ]
}

Rules:
- Create exactly ${TARGET_QUESTIONS} questions, all scoped to "${chapter.title}" only.
- Every question needs exactly 4 options and exactly one correct option (correctIndex 0-3).
- Distractor options must be plausible (drawn from real misconceptions or nearby ideas in this Area of Study), never silly or obviously wrong.
- Cover a spread of the key knowledge above rather than repeating the same idea.
- Keep each question and option concise — this is a quick daily check, not an essay task.
- Do not use "all of the above" or "none of the above" as an option.`
}

function fallbackQuestionPool(chapter: VceCourseChapter): VceKeyKnowledgePoint[] {
  const seen = new Set<string>()
  return chapter.lessons.flatMap((lesson) => lesson.keyKnowledge)
    .filter((point) => {
      const key = point.label.toLowerCase()
      if (!point.label || !point.explanation || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** Deterministic (non-AI) "match the term to its explanation" quiz — genuinely gradable without AI, since the distractors are just other real points' explanations. */
function buildFallbackQuiz(chapter: VceCourseChapter): AreaQuiz {
  const pool = fallbackQuestionPool(chapter)
  const questionCount = Math.max(MIN_QUESTIONS, Math.min(TARGET_QUESTIONS, pool.length))
  const chosen = shuffle(pool).slice(0, questionCount)

  const questions: AreaQuizQuestion[] = chosen.map((point, index) => {
    const distractorPool = pool.filter((candidate) => candidate.label !== point.label)
    const distractors = shuffle(distractorPool).slice(0, 3).map((candidate) => candidate.explanation)
    while (distractors.length < 3) distractors.push('This does not match the term being tested.')
    const options = shuffle([point.explanation, ...distractors])
    return {
      id: `fallback-q-${index + 1}`,
      question: `Which statement best explains "${point.label}"?`,
      options,
      correctIndex: options.indexOf(point.explanation),
      explanation: point.explanation,
    }
  })

  return { title: `${chapter.title} mastery quiz`, questions }
}

export async function createAiAreaQuiz(course: VceCourse, level: VceCourseLevel, chapter: VceCourseChapter, previousMistakes: string[] = [], signal?: AbortSignal): Promise<AreaQuiz> {
  const fallback = buildFallbackQuiz(chapter)

  try {
    const result = await createTutorReplyWithFallback({
      message: buildQuizPrompt(course, level, chapter, previousMistakes),
      documents: [{ name: VCE_STUDY_DESIGN_SOURCE.label, text: chapter.lessons.flatMap((lesson) => lesson.keyKnowledge.map((point) => `${point.label}: ${point.detail}\n${point.explanation}`)).join('\n\n') }],
      history: [],
      mode: 'advanced',
      action: 'study-coach',
      purpose: 'study-generation',
      tier: 'plus',
      signal,
    })
    const parsed = extractJsonObject(result.reply)
    return normaliseQuiz(parsed, chapter.title) ?? fallback
  } catch (error) {
    if (error instanceof GroqConfigurationError || error instanceof ProviderConfigurationError || error instanceof GroqApiError || error instanceof ProviderApiError || error instanceof TypeError || error instanceof SyntaxError) {
      return fallback
    }
    throw error
  }
}
