import { NextResponse } from 'next/server'

import { createTutorReplyWithFallback } from '@/lib/ai/text-fallback'
import { VCE_COURSES, type VceCourse } from '@/lib/courses/vce-catalog'
import { getServerAuthSession, SupabaseConfigurationError } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 45

const REQUEST_TIMEOUT_MS = 35_000
const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'answer',
  'because',
  'before',
  'being',
  'between',
  'could',
  'course',
  'design',
  'explain',
  'from',
  'have',
  'into',
  'should',
  'study',
  'that',
  'their',
  'there',
  'this',
  'unit',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
])

type AnswerVerdict = 'correct' | 'partial' | 'incorrect'

type AnswerFeedback = {
  verdict: AnswerVerdict
  feedback: string
  correction: string
  nextStep: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function trimText(value: string, max = 900) {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trim()}...` : trimmed
}

async function readBody(req: Request) {
  try {
    const value: unknown = await req.json()
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

function createTimeoutSignal() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return { controller, timeoutId }
}

function extractJsonObject(value: string) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(value)
  const candidate = fenced?.[1] ?? value
  const first = candidate.indexOf('{')
  const last = candidate.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  try {
    const parsed: unknown = JSON.parse(candidate.slice(first, last + 1))
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function normaliseVerdict(value: unknown): AnswerVerdict {
  return value === 'correct' || value === 'incorrect' || value === 'partial' ? value : 'partial'
}

function normaliseFeedback(value: unknown, fallback: AnswerFeedback): AnswerFeedback {
  const record = isRecord(value) ? value : null
  if (!record) return fallback

  return {
    verdict: normaliseVerdict(record.verdict),
    feedback: trimText(asString(record.feedback, fallback.feedback), 500),
    correction: trimText(asString(record.correction, fallback.correction), 500),
    nextStep: trimText(asString(record.nextStep, fallback.nextStep), 300),
  }
}

function keywords(value: string) {
  const seen = new Set<string>()
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 5 && !STOP_WORDS.has(word))
    .filter((word) => {
      if (seen.has(word)) return false
      seen.add(word)
      return true
    })
    .slice(0, 12)
}

function findAnswerCourseLevel(course: VceCourse, unit: unknown) {
  const unitNumber = typeof unit === 'number' ? unit : typeof unit === 'string' ? Number(unit) : NaN
  if (unitNumber !== 1 && unitNumber !== 2 && unitNumber !== 3 && unitNumber !== 4) return null
  return course.levels.find((level) => level.unit === unitNumber) ?? null
}

function fallbackFeedback(question: string, answer: string, answerGuide: string, commandTerm: string): AnswerFeedback {
  const cleanAnswer = answer.replace(/\s+/g, ' ').trim()
  const expectedKeywords = keywords(`${question} ${answerGuide}`)
  const lowerAnswer = cleanAnswer.toLowerCase()
  const matchedKeywords = expectedKeywords.filter((word) => lowerAnswer.includes(word)).length
  const hasReasoning = /\b(because|therefore|this means|as a result|leads to|so that|for example|evidence|shows|suggests)\b/i.test(cleanAnswer)

  if (cleanAnswer.length < 30) {
    return {
      verdict: 'incorrect',
      feedback: 'Your answer is too short to show the examiner what you know yet.',
      correction: `Use the command term${commandTerm ? ` ${commandTerm}` : ''}, name the key idea, then explain how it answers the question.`,
      nextStep: 'Add two full sentences: one for the key knowledge and one for the reason or evidence.',
    }
  }

  if (matchedKeywords >= 4 && hasReasoning) {
    return {
      verdict: 'correct',
      feedback: 'This has the shape of a strong VCE answer because it includes relevant study-design language and gives a reasoned explanation.',
      correction: 'Keep sharpening the final sentence so it directly answers the command term.',
      nextStep: 'Compare your response with the answer guide and add one precise subject-specific term if it is missing.',
    }
  }

  return {
    verdict: 'partial',
    feedback: 'You have started the answer, but it needs a clearer link to the expected key knowledge or reasoning.',
    correction: `Bring in the main idea from the answer guide, then show how it works in this question rather than only naming it.`,
    nextStep: 'Rewrite the answer using: key idea, explanation, evidence or example, command-term finish.',
  }
}

function buildPrompt(input: { courseName: string; unitTitle: string; question: string; answer: string; answerGuide: string; commandTerm: string }) {
  return `You are a VCE tutor checking a student's typed answer inside AirNexus Courses.

Course: ${input.courseName}
Unit: ${input.unitTitle}
Command term: ${input.commandTerm || 'not supplied'}
Question: ${input.question}
Answer guide: ${input.answerGuide || 'No answer guide supplied.'}
Student answer: ${input.answer}

Return strict JSON only:
{
  "verdict": "correct|partial|incorrect",
  "feedback": "one or two student-friendly sentences explaining what is right or missing",
  "correction": "one concise correction aligned to the VCE command term and key knowledge",
  "nextStep": "one concrete action the student should do next"
}

Mark leniently but accurately. Do not require exact wording. A correct answer must address the question, follow the command term and explain the relevant key knowledge. A partial answer has some correct knowledge but misses the reasoning, evidence, key detail or command-term demand. An incorrect answer is off topic, too vague or contains a clear misconception.`
}

export async function POST(req: Request) {
  let auth: Awaited<ReturnType<typeof getServerAuthSession>>
  try {
    auth = await getServerAuthSession()
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return NextResponse.json({ error: 'Supabase authentication is not configured' }, { status: 500 })
    }
    throw error
  }

  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await readBody(req)
  const courseId = asString(body?.courseId)
  const course = VCE_COURSES.find((item) => item.id === courseId)
  if (!course) return NextResponse.json({ error: 'Unknown VCE course' }, { status: 400 })

  const level = findAnswerCourseLevel(course, body?.unit)
  if (!level) return NextResponse.json({ error: 'Unknown VCE unit' }, { status: 400 })

  const question = trimText(asString(body?.question), 1200)
  const answer = trimText(asString(body?.answer), 3000)
  const answerGuide = trimText(asString(body?.answerGuide), 1600)
  const commandTerm = trimText(asString(body?.commandTerm), 80)

  if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  if (!answer) return NextResponse.json({ error: 'Answer is required' }, { status: 400 })

  const fallback = fallbackFeedback(question, answer, answerGuide, commandTerm)
  const { controller, timeoutId } = createTimeoutSignal()

  try {
    const result = await createTutorReplyWithFallback({
      message: buildPrompt({ courseName: course.name, unitTitle: level.title, question, answer, answerGuide, commandTerm }),
      history: [],
      mode: 'advanced',
      action: 'study-coach',
      purpose: 'study-generation',
      tier: 'plus',
      signal: controller.signal,
    })
    const parsed = extractJsonObject(result.reply)
    return NextResponse.json({ feedback: normaliseFeedback(parsed, fallback), provider: result.provider })
  } catch (error) {
    console.warn('Courses answer check fallback:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ feedback: fallback, provider: 'fallback' })
  } finally {
    clearTimeout(timeoutId)
  }
}