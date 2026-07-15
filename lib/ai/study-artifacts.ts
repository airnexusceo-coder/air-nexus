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
  id: string
  title: string
  cards: Flashcard[]
  createdAt: string
}

/** Most decks a user can keep around at once — oldest is dropped once a new one pushes past this. */
const MAX_STORED_DECKS = 5

/** Largest deck the app supports end to end — generation, storage, and import all cap here. */
const MAX_FLASHCARDS_PER_DECK = 50

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

export type GraphPoint = {
  x: number
  y: number
}

export type GraphSeries = {
  label: string
  points: GraphPoint[]
  /** 'line' connects points in order (a trend over time/x); 'scatter' plots unconnected markers (unordered data). Defaults to 'line'. */
  style: 'line' | 'scatter'
}

export type GraphSpec = {
  title: string
  functions: GraphFunction[]
  series: GraphSeries[]
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
  }).slice(0, MAX_FLASHCARDS_PER_DECK)
  if (cards.length < 3) return null
  return {
    id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

function parseGraphSeries(value: unknown): GraphSeries[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((candidate, index): GraphSeries[] => {
    if (!isRecord(candidate) || !Array.isArray(candidate.points)) return []
    const points = candidate.points.flatMap((point): GraphPoint[] => {
      if (!isRecord(point)) return []
      const x = cleanNumber(point.x)
      const y = cleanNumber(point.y)
      return x !== undefined && y !== undefined ? [{ x, y }] : []
    }).slice(0, 200)
    if (points.length < 2) return []
    const label = cleanText(candidate.label, 80) || `Series ${index + 1}`
    const style: GraphSeries['style'] = candidate.style === 'scatter' ? 'scatter' : 'line'
    return [{ label, points, style }]
  }).slice(0, 6)
}

export function parseGraphSpec(reply: string): GraphSpec | null {
  const value = extractJson(reply)
  if (!isRecord(value)) return null
  const rawFunctions = Array.isArray(value.functions) ? value.functions : []
  const functions = rawFunctions.flatMap((candidate, index): GraphFunction[] => {
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

  const series = parseGraphSeries(value.series)
  if (functions.length === 0 && series.length === 0) return null

  const xMin = cleanNumber(value.xMin)
  const xMax = cleanNumber(value.xMax)
  const yMin = cleanNumber(value.yMin)
  const yMax = cleanNumber(value.yMax)
  return {
    title: cleanText(value.title, 120) || 'Graph',
    functions,
    series,
    xMin: xMin !== undefined && xMax !== undefined && xMax > xMin ? xMin : undefined,
    xMax: xMin !== undefined && xMax !== undefined && xMax > xMin ? xMax : undefined,
    yMin: yMin !== undefined && yMax !== undefined && yMax > yMin ? yMin : undefined,
    yMax: yMin !== undefined && yMax !== undefined && yMax > yMin ? yMax : undefined,
  }
}

/** Validates and normalizes one deck from untrusted JSON (storage, or an imported export file). `fallbackId` covers data saved before decks had an id of their own. */
export function parseStoredFlashcardDeck(candidate: unknown, fallbackId: string): FlashcardDeck | null {
  if (!isRecord(candidate) || !Array.isArray(candidate.cards)) return null
  const cards = candidate.cards.flatMap((cardCandidate): Flashcard[] => {
    if (!isRecord(cardCandidate)) return []
    const front = cleanText(cardCandidate.front, 240)
    const back = cleanText(cardCandidate.back, 500)
    if (!front || !back || typeof cardCandidate.id !== 'string') return []
    return [{
      id: cardCandidate.id,
      front,
      back,
      hint: cleanText(cardCandidate.hint, 220),
      difficulty: cardCandidate.difficulty === 'intermediate' || cardCandidate.difficulty === 'advanced' ? cardCandidate.difficulty : 'beginner',
    }]
  }).slice(0, MAX_FLASHCARDS_PER_DECK)
  if (cards.length === 0) return null
  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString()
  const id = typeof candidate.id === 'string' ? candidate.id : fallbackId
  return { id, title: cleanText(candidate.title, 100) || 'AirNexus study deck', cards, createdAt }
}

/**
 * Deck history, most recent first. Storage holds up to MAX_STORED_DECKS
 * decks (not just one) so generating a new deck — in chat or the Tutor page
 * — never silently destroys an earlier one; the reader also accepts the old
 * single-deck-object shape from before this was a list, migrating it in
 * place on next read.
 */
export function loadFlashcardDecks(): FlashcardDeck[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(FLASHCARD_DECK_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const candidates = Array.isArray(parsed) ? parsed : [parsed]
    return candidates
      .map((candidate, index) => parseStoredFlashcardDeck(candidate, `deck-legacy-${index}-${Date.now()}`))
      .filter((deck): deck is FlashcardDeck => deck !== null)
      .slice(0, MAX_STORED_DECKS)
  } catch {
    return []
  }
}

/** Adds/replaces a deck at the front of the history (by id) and persists the result. Returns the updated list so a caller can update its own state in one step. */
export function saveFlashcardDeck(deck: FlashcardDeck): FlashcardDeck[] {
  const next = [deck, ...loadFlashcardDecks().filter((item) => item.id !== deck.id)].slice(0, MAX_STORED_DECKS)
  if (typeof window !== 'undefined') window.localStorage.setItem(FLASHCARD_DECK_STORAGE_KEY, JSON.stringify(next))
  return next
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
