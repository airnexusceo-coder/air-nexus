import { compileExpression } from '../math/expression'

/**
 * Structured, interactive study content the AI can produce instead of plain
 * chat text — quizzes, flashcard decks, and function graphs. Each type is
 * requested via a dedicated action (lib/ai/prompts.ts) that forces the model
 * to return raw JSON, then parsed here with the same defensive
 * strip-fences/find-braces/JSON.parse/validate-every-field pattern already
 * used for flashcards and assignment plans elsewhere in this codebase.
 */

export const FLASHCARD_DECK_STORAGE_KEY = 'airnexus-flashcard-deck-v1'

export type FlashcardDifficulty = 'beginner' | 'intermediate' | 'advanced'

export type Flashcard = {
  id: string
  front: string
  back: string
  hint: string
  difficulty: FlashcardDifficulty
}

export type FlashcardDeck = {
  title: string
  cards: Flashcard[]
  createdAt: string
}

export type QuizQuestionType = 'multiple-choice' | 'short-answer'

export type QuizQuestion = {
  id: string
  question: string
  type: QuizQuestionType
  options: string[]
  correctAnswer: string
  explanation: string
}

export type Quiz = {
  title: string
  questions: QuizQuestion[]
}

export type GraphFunction = {
  expression: string
  label: string
}

export type GraphSpec = {
  title: string
  functions: GraphFunction[]
  xMin?: number
  yMin?: number
  xMax?: number
  yMax?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Shared first step for every artifact parser: strip Markdown fences (the model sometimes adds them despite instructions not to), then isolate the outermost JSON object even if the model wrapped it in stray prose. */
function extractJson(reply: string): unknown | null {
  const normalized = reply.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = normalized.indexOf('{')
  const end = normalized.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(normalized.slice(start, end + 1))
  } catch {
    return null
  }
}

export function parseFlashcardDeck(reply: string): FlashcardDeck | null {
  const value = extractJson(reply)
  if (!isRecord(value) || !Array.isArray(value.cards)) return null
  const cards = value.cards.flatMap((candidate, index): Flashcard[] => {
    if (!isRecord(candidate)) return []
    const front = cleanText(candidate.front, 240)
    const back = cleanText(candidate.back, 500)
    const hint = cleanText(candidate.hint, 220)
    const difficulty: FlashcardDifficulty = candidate.difficulty === 'intermediate' || candidate.difficulty === 'advanced' ? candidate.difficulty : 'beginner'
    if (!front || !back) return []
    return [{ id: `card-${index}-${Math.random().toString(36).slice(2, 7)}`, front, back, hint, difficulty }]
  }).slice(0, 24)
  if (cards.length < 3) return null
  return {
    title: cleanText(value.deckTitle, 100) || 'AirNexus study deck',
    cards,
    createdAt: new Date().toISOString(),
  }
}

export function parseQuiz(reply: string): Quiz | null {
  const value = extractJson(reply)
  if (!isRecord(value) || !Array.isArray(value.questions)) return null
  const questions = value.questions.flatMap((candidate, index): QuizQuestion[] => {
    if (!isRecord(candidate)) return []
    const question = cleanText(candidate.question, 400)
    const correctAnswer = cleanText(candidate.correctAnswer, 240)
    if (!question || !correctAnswer) return []
    const rawOptions = Array.isArray(candidate.options)
      ? candidate.options.flatMap((option) => {
        const text = cleanText(option, 200)
        return text ? [text] : []
      }).slice(0, 6)
      : []
    const type: QuizQuestionType = candidate.type === 'multiple-choice' && rawOptions.length >= 2 ? 'multiple-choice' : 'short-answer'
    // A multiple-choice question's correct answer must actually appear among
    // its own options, or grading could never mark it right.
    if (type === 'multiple-choice' && !rawOptions.includes(correctAnswer)) return []
    return [{
      id: `question-${index}-${Math.random().toString(36).slice(2, 7)}`,
      question,
      type,
      options: type === 'multiple-choice' ? rawOptions : [],
      correctAnswer,
      explanation: cleanText(candidate.explanation, 500),
    }]
  }).slice(0, 10)
  if (questions.length < 3) return null
  return {
    title: cleanText(value.title, 120) || 'Mini quiz',
    questions,
  }
}

export function parseGraphSpec(reply: string): GraphSpec | null {
  const value = extractJson(reply)
  if (!isRecord(value) || !Array.isArray(value.functions)) return null
  const functions = value.functions.flatMap((candidate, index): GraphFunction[] => {
    if (!isRecord(candidate)) return []
    const expression = cleanText(candidate.expression, 200)
    if (!expression) return []
    try {
      // Reject anything the plotter could not evaluate later — cheaper to
      // fail here than to silently draw a blank line in the widget.
      compileExpression(expression)(0)
    } catch {
      return []
    }
    const label = cleanText(candidate.label, 80) || `f${index + 1}(x)`
    return [{ expression, label }]
  }).slice(0, 4)
  if (functions.length === 0) return null

  const xMin = cleanNumber(value.xMin)
  const xMax = cleanNumber(value.xMax)
  const yMin = cleanNumber(value.yMin)
  const yMax = cleanNumber(value.yMax)
  return {
    title: cleanText(value.title, 120) || 'Function graph',
    functions,
    xMin: xMin !== undefined && xMax !== undefined && xMax > xMin ? xMin : undefined,
    xMax: xMin !== undefined && xMax !== undefined && xMax > xMin ? xMax : undefined,
    yMin: yMin !== undefined && yMax !== undefined && yMax > yMin ? yMin : undefined,
    yMax: yMin !== undefined && yMax !== undefined && yMax > yMin ? yMax : undefined,
  }
}

export type StudyIntent = 'quiz' | 'flashcards' | 'graph'

const QUIZ_PATTERN = /\b(quiz(zes)?|test me|mini[\s-]?test|practice test)\b/i
const FLASHCARD_PATTERN = /\bflash[\s-]?cards?\b/i
const GRAPH_PATTERN = /\b(graph|plot)\b/i

/** Lightweight keyword heuristic — routes an AI Chat message to a dedicated structured request instead of the normal streaming reply. False positives just produce a structured artifact about whatever the message was about, which degrades acceptably; false negatives fall back to the AI answering normally in prose, which is never wrong, just less interactive. */
export function detectStudyIntent(message: string): StudyIntent | null {
  if (FLASHCARD_PATTERN.test(message)) return 'flashcards'
  if (QUIZ_PATTERN.test(message)) return 'quiz'
  if (GRAPH_PATTERN.test(message)) return 'graph'
  return null
}
