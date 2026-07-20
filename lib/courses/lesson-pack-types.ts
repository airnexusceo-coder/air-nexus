export type AiLessonSlideKind = 'teach' | 'example' | 'activity' | 'question' | 'answer' | 'checkpoint'

export type AiLessonCommandTerm = {
  term: string
  meaning: string
  responseMove: string
  source?: string
}

/** A general-purpose labelled diagram — covers cycle/flow/hierarchy/timeline/comparison teaching diagrams across every VCE subject without needing image generation. */
export type DiagramLayout = 'flow' | 'cycle' | 'hierarchy' | 'timeline' | 'comparison'

export type AiLessonDiagramNode = {
  id: string
  label: string
  detail?: string
}

export type AiLessonDiagramEdge = {
  from: string
  to: string
  label?: string
}

export type AiLessonDiagram = {
  title: string
  layout: DiagramLayout
  nodes: AiLessonDiagramNode[]
  edges: AiLessonDiagramEdge[]
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
  diagram?: AiLessonDiagram
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