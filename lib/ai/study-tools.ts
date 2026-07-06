import { calculateGrade } from '@/lib/calculator-results'

export const STUDY_TOOL_LABELS = {
  generate_flashcards: 'Flashcard Generator',
  generate_quiz: 'Quiz Generator',
  create_exam_plan: 'Exam Planner',
  create_notes: 'Notes',
  calculate: 'Calculator',
  create_study_plan: 'Study Planner',
  calculate_grade: 'Grade Calculator',
  analyze_files: 'File Analysis',
  generate_diagram: 'Diagram Generator',
} as const

export type StudyToolName = keyof typeof STUDY_TOOL_LABELS
export type GroqToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
export type StudyToolExecution = { id: string; name: StudyToolName; label: string; content: string }

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false })
const textSchema = (description: string, values?: string[]) => ({ type: 'string', description, ...(values ? { enum: values } : {}) })
const numberSchema = (description: string, minimum?: number, maximum?: number) => ({ type: 'number', description, ...(minimum === undefined ? {} : { minimum }), ...(maximum === undefined ? {} : { maximum }) })
const prioritiesSchema = { type: 'array', items: { type: 'string' }, description: 'Subjects or tasks explicitly mentioned by the student' }

export const studyToolDefinitions = [
  { type: 'function', function: { name: 'generate_flashcards', description: 'Create active-recall flashcards when a student asks to memorise, revise, or turn material into cards.', parameters: objectSchema({ topic: textSchema('Topic or source material'), count: numberSchema('Number of cards', 3, 20), difficulty: textSchema('Student level', ['beginner', 'intermediate', 'advanced']) }, ['topic']) } },
  { type: 'function', function: { name: 'generate_quiz', description: 'Create a practice quiz when a student wants to test knowledge.', parameters: objectSchema({ topic: textSchema('Topic to test'), question_count: numberSchema('Number of questions', 1, 10), difficulty: textSchema('Quiz difficulty', ['beginner', 'intermediate', 'advanced']) }, ['topic']) } },
  { type: 'function', function: { name: 'create_exam_plan', description: 'Build revision steps for a named exam with a supplied date or timeframe.', parameters: objectSchema({ exam: textSchema('Exam name or subject'), exam_date: textSchema('Date exactly as provided, or empty'), topics: prioritiesSchema }, ['exam']) } },
  { type: 'function', function: { name: 'create_notes', description: 'Transform supplied material into structured study notes.', parameters: objectSchema({ topic: textSchema('Topic or material'), format: textSchema('Note format', ['outline', 'cornell', 'summary', 'cheat-sheet']) }, ['topic']) } },
  { type: 'function', function: { name: 'calculate', description: 'Evaluate arithmetic accurately instead of estimating it.', parameters: objectSchema({ expression: textSchema('Expression using numbers, +, -, *, /, %, ^, parentheses, sqrt, abs, round, floor, or ceil') }, ['expression']) } },
  { type: 'function', function: { name: 'create_study_plan', description: 'Create a bounded schedule from stated priorities and available time.', parameters: objectSchema({ timeframe: textSchema('Timeframe exactly as provided'), available_minutes: numberSchema('Minutes available per study day', 10, 720), priorities: prioritiesSchema }, ['priorities']) } },
  { type: 'function', function: { name: 'calculate_grade', description: 'Calculate a weighted grade from actual assessment scores.', parameters: objectSchema({ assessments: { type: 'array', minItems: 1, maxItems: 30, items: objectSchema({ name: textSchema('Assessment name'), score: numberSchema('Score received', 0), total: numberSchema('Total possible marks', 0.000001), weight: numberSchema('Percentage weight', 0.000001, 100) }, ['name', 'score', 'total', 'weight']) } }, ['assessments']) } },
  { type: 'function', function: { name: 'analyze_files', description: 'Inspect uploaded documents. Call only when a real file is attached.', parameters: objectSchema({ query: textSchema('What to find, compare, explain, or summarise') }, ['query']) } },
  { type: 'function', function: { name: 'generate_diagram', description: 'Create a text-renderable diagram when relationships or processes are clearer visually.', parameters: objectSchema({ topic: textSchema('Concept or process'), style: textSchema('Diagram structure', ['flowchart', 'mind-map', 'timeline', 'comparison']) }, ['topic', 'style']) } },
] as const

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function asText(value: unknown, fallback = '') { return typeof value === 'string' ? value.trim().slice(0, 2_000) : fallback }
function asNumber(value: unknown, fallback: number, min: number, max: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback }

class MathParser {
  private position = 0
  constructor(private readonly input: string) {}
  parse() { const result = this.expression(); this.space(); if (this.position !== this.input.length || !Number.isFinite(result)) throw new Error('Invalid arithmetic expression'); return result }
  private space() { while (/\s/.test(this.input[this.position] ?? '')) this.position += 1 }
  private take(value: string) { this.space(); if (this.input.slice(this.position, this.position + value.length) !== value) return false; this.position += value.length; return true }
  private expression() { let value = this.term(); while (true) { if (this.take('+')) value += this.term(); else if (this.take('-')) value -= this.term(); else return value } }
  private term() { let value = this.power(); while (true) { if (this.take('*')) value *= this.power(); else if (this.take('/')) { const divisor = this.power(); if (divisor === 0) throw new Error('Division by zero'); value /= divisor } else if (this.take('%')) value %= this.power(); else return value } }
  private power() { let value = this.unary(); if (this.take('^')) value **= this.power(); return value }
  private unary(): number { if (this.take('+')) return this.unary(); if (this.take('-')) return -this.unary(); return this.primary() }
  private primary(): number {
    if (this.take('(')) { const value = this.expression(); if (!this.take(')')) throw new Error('Missing closing parenthesis'); return value }
    this.space()
    const functionMatch = this.input.slice(this.position).match(/^(sqrt|abs|round|floor|ceil)\b/)
    if (functionMatch) {
      this.position += functionMatch[0].length
      if (!this.take('(')) throw new Error('Function requires parentheses')
      const value = this.expression()
      if (!this.take(')')) throw new Error('Missing closing parenthesis')
      return Math[functionMatch[1] as 'sqrt' | 'abs' | 'round' | 'floor' | 'ceil'](value)
    }
    const match = this.input.slice(this.position).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)
    if (!match) throw new Error('Expected a number')
    this.position += match[0].length
    return Number(match[0])
  }
}

function calculateExpression(expression: string) {
  if (!expression || expression.length > 200 || /[^\d\s+\-*/%^().a-z]/i.test(expression)) throw new Error('Unsupported arithmetic expression')
  return new MathParser(expression).parse()
}

function extractFileEvidence(query: string, documents: Array<{ name: string; text: string }>) {
  if (documents.length === 0) return { status: 'needs_file', message: 'No uploaded document is available. Ask the student to attach a TXT, Markdown, PDF, or DOCX file.' }
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 3).slice(0, 8)
  return { status: 'ready', query, files: documents.map((document) => {
    const ranked = document.text.split(/\n\s*\n/).filter(Boolean).map((chunk) => ({ chunk, score: terms.reduce((total, term) => total + Number(chunk.toLowerCase().includes(term)), 0) })).sort((a, b) => b.score - a.score)
    return { name: document.name, relevant_excerpts: ranked.slice(0, 5).map(({ chunk }) => chunk.slice(0, 1_800)) }
  }) }
}

export function executeStudyTool(call: GroqToolCall, documents: Array<{ name: string; text: string }>): StudyToolExecution {
  if (!(call.function.name in STUDY_TOOL_LABELS)) throw new Error(`Unsupported tool: ${call.function.name}`)
  const name = call.function.name as StudyToolName
  let args: Record<string, unknown>
  try { args = asRecord(JSON.parse(call.function.arguments)) } catch { args = {} }
  let result: unknown
  if (name === 'calculate') {
    const expression = asText(args.expression)
    try { result = { status: 'ready', expression, result: calculateExpression(expression) } } catch (error) { result = { status: 'error', message: error instanceof Error ? error.message : 'Calculation failed' } }
  } else if (name === 'calculate_grade') {
    const assessments = Array.isArray(args.assessments) ? args.assessments.map(asRecord).slice(0, 30).map((item) => ({ name: asText(item.name, 'Assessment'), score: asNumber(item.score, -1, -1, 1_000_000), total: asNumber(item.total, -1, -1, 1_000_000), weight: asNumber(item.weight, -1, -1, 100) })).filter((item) => item.score >= 0 && item.total > 0 && item.score <= item.total && item.weight > 0) : []
    const grade = calculateGrade(assessments, Number.NaN)
    result = assessments.length ? { status: 'ready', assessments, current_percent: grade.current, weighted_percent: grade.weighted, total_weight_used: grade.usedWeight } : { status: 'error', message: 'No valid assessment scores and weights were supplied.' }
  } else if (name === 'analyze_files') {
    result = extractFileEvidence(asText(args.query, 'Summarise the uploaded material'), documents)
  } else {
    result = { status: 'ready', workflow: name, inputs: args, instruction: 'Produce the requested student artifact now. Use only supplied facts and identify missing details instead of inventing them.' }
  }
  return { id: call.id, name, label: STUDY_TOOL_LABELS[name], content: JSON.stringify(result) }
}
