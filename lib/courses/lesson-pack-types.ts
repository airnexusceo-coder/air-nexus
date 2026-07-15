export type AiLessonSlideKind = 'teach' | 'example' | 'activity' | 'question' | 'answer' | 'checkpoint'

export type AiLessonCommandTerm = {
  term: string
  meaning: string
  responseMove: string
  source?: string
}

export type AiLessonSlide = {
  id: string
  kind: AiLessonSlideKind
  title: string
  minutes: number
  body: string
  paragraphs: string[]
  bullets: string[]
  commandTerm?: AiLessonCommandTerm
  activity?: string
  question?: string
  answerGuide?: string
}

export type AiUnitLessonPack = {
  id: string
  courseId: string
  courseName: string
  unit: 1 | 2 | 3 | 4
  unitTitle: string
  /** Present only for a chapter-scoped (Area of Study) deep-dive pack, absent for a whole-unit pack. */
  chapterId?: string
  sourceTitle: string
  sourceUrl: string
  sourcePageUrl?: string
  sourceDocumentUrl?: string
  generatedBy: 'ai' | 'fallback'
  commandTerms: AiLessonCommandTerm[]
  slides: AiLessonSlide[]
}