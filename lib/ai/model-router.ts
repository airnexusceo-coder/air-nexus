import type { TutorAction } from '@/lib/ai/tutor-types'

export const GROQ_MODEL_ROLES = {
  conversation: 'openai/gpt-oss-120b',
  documentAnalysis: 'qwen/qwen3.6-27b',
  studyGeneration: 'openai/gpt-oss-20b',
  transcription: 'whisper-large-v3-turbo',
  speech: 'canopylabs/orpheus-v1-english',
} as const

export const GROQ_TEXT_PURPOSES = ['conversation', 'document-analysis', 'tutoring', 'study-generation', 'planning'] as const
export type GroqTextPurpose = (typeof GROQ_TEXT_PURPOSES)[number]

export function isGroqTextPurpose(value: unknown): value is GroqTextPurpose {
  return typeof value === 'string' && GROQ_TEXT_PURPOSES.includes(value as GroqTextPurpose)
}

export function selectGroqTextModel({
  action,
  purpose,
  hasDocuments,
}: {
  action: TutorAction
  purpose: GroqTextPurpose
  hasDocuments: boolean
}) {
  if (purpose === 'document-analysis' || hasDocuments) return GROQ_MODEL_ROLES.documentAnalysis
  if (purpose === 'study-generation' || purpose === 'planning') return GROQ_MODEL_ROLES.studyGeneration
  if (action === 'quiz' || action === 'flashcards' || action === 'graph' || action === 'assignment-plan' || action === 'assignment-review' || action === 'study-coach' || action === 'writing-suggestions' || action === 'notes' || action === 'draft') {
    return GROQ_MODEL_ROLES.studyGeneration
  }
  return GROQ_MODEL_ROLES.conversation
}

export function publicModelName(model: string) {
  if (model === GROQ_MODEL_ROLES.conversation) return 'GPT-OSS 120B'
  if (model === GROQ_MODEL_ROLES.documentAnalysis) return 'Qwen 3.6 27B'
  if (model === GROQ_MODEL_ROLES.studyGeneration) return 'GPT-OSS 20B'
  if (model === GROQ_MODEL_ROLES.transcription) return 'Whisper Large v3 Turbo'
  if (model === GROQ_MODEL_ROLES.speech) return 'Orpheus'
  return model
}
