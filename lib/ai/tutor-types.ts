export const TUTOR_MODES = ['auto', 'beginner', 'intermediate', 'advanced'] as const
export type TutorMode = (typeof TUTOR_MODES)[number]

export const TUTOR_ACTIONS = ['teach', 'hint', 'practice', 'quiz', 'feedback', 'flashcards', 'graph', 'assignment-plan', 'assignment-review', 'study-coach', 'writing-suggestions', 'notes'] as const
export type TutorAction = (typeof TUTOR_ACTIONS)[number]

export type TutorHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function isTutorMode(value: unknown): value is TutorMode {
  return typeof value === 'string' && TUTOR_MODES.includes(value as TutorMode)
}

export function isTutorAction(value: unknown): value is TutorAction {
  return typeof value === 'string' && TUTOR_ACTIONS.includes(value as TutorAction)
}
