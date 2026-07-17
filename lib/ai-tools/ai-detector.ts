/** Common stock phrases that large language models reach for disproportionately often relative to typical human writing. Literal, case-insensitive substring matches — deliberately simple and inspectable rather than a black box. */
export const AI_TELL_PHRASES: readonly string[] = [
  'delve into', 'boasts', 'tapestry', 'in the realm of', 'realm of', 'landscape of', 'underscores the',
  'moreover,', 'furthermore,', 'in conclusion,', "it's important to note", 'it is important to note',
  'plays a crucial role', 'plays a vital role', "in today's world", "in today's digital age",
  'leverage', 'robust', 'seamlessly', 'unlock the', 'unlocking', 'elevate your', 'embark on',
  'a testament to', 'in summary,', 'overall,', 'additionally,', 'consequently,', 'fostering',
  'holistic', 'multifaceted', 'paramount', 'pivotal', 'intricate', 'nuanced', 'cutting-edge',
  'ever-evolving', 'shed light on', 'sheds light on', 'a myriad of', 'harness the power of',
]

const CONTRACTION_PATTERN = /\b\w+'(t|re|ve|ll|d|s|m)\b/gi
const MIN_WORDS_FOR_SCORE = 40
const MIN_SENTENCES_FOR_BURSTINESS = 4

// Typical human sentence-length variation (coefficient of variation) in essay-style writing commonly
// falls in roughly 0.4-0.8; LLM output tends to cluster lower, around 0.15-0.35, because it favours
// evenly-paced sentences. These bounds map that range onto a 0-100 AI-likelihood contribution — a
// heuristic starting point, not an empirically validated threshold.
const BURSTINESS_AI_TYPICAL_CV = 0.15
const BURSTINESS_HUMAN_TYPICAL_CV = 0.75

// Type-token ratio (unique words / total words) for 150-600 word passages commonly sits around
// 0.45-0.65 for human writing and can dip lower for repetitive AI output. Also heuristic.
const VOCAB_HUMAN_TYPICAL_TTR = 0.62
const VOCAB_AI_TYPICAL_TTR = 0.35

export type StylometricStats = {
  wordCount: number
  sentenceCount: number
  burstiness: number | null
  vocabDiversity: number | null
  aiPhraseHits: string[]
  contractionsPer100Words: number
  /** 0-100 AI-likelihood estimate from these statistics alone, or null when there isn't enough text to trust it. */
  score: number | null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function splitSentences(text: string): string[] {
  return text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/).map((sentence) => sentence.trim()).filter(Boolean)
}

function wordsIn(text: string): string[] {
  return text.match(/[A-Za-z0-9']+/g) ?? []
}

function computeBurstiness(sentences: string[]): number | null {
  const lengths = sentences.map((sentence) => wordsIn(sentence).length).filter((length) => length > 0)
  if (lengths.length < MIN_SENTENCES_FOR_BURSTINESS) return null
  const mean = lengths.reduce((sum, length) => sum + length, 0) / lengths.length
  if (mean === 0) return null
  const variance = lengths.reduce((sum, length) => sum + (length - mean) ** 2, 0) / lengths.length
  return Math.sqrt(variance) / mean
}

function computeVocabDiversity(words: string[]): number | null {
  if (words.length < MIN_WORDS_FOR_SCORE) return null
  const unique = new Set(words.map((word) => word.toLowerCase()))
  return unique.size / words.length
}

export function computeStylometricStats(text: string): StylometricStats {
  const sentences = splitSentences(text)
  const words = wordsIn(text)
  const wordCount = words.length
  const lowerText = text.toLowerCase()

  const burstiness = computeBurstiness(sentences)
  const vocabDiversity = computeVocabDiversity(words)
  const aiPhraseHits = AI_TELL_PHRASES.filter((phrase) => lowerText.includes(phrase))
  const contractionsPer100Words = wordCount > 0 ? ((lowerText.match(CONTRACTION_PATTERN) ?? []).length / wordCount) * 100 : 0

  if (wordCount < MIN_WORDS_FOR_SCORE) {
    return { wordCount, sentenceCount: sentences.length, burstiness, vocabDiversity, aiPhraseHits, contractionsPer100Words, score: null }
  }

  const burstinessScore = burstiness === null
    ? null
    : clamp(Math.round(100 - ((burstiness - BURSTINESS_AI_TYPICAL_CV) / (BURSTINESS_HUMAN_TYPICAL_CV - BURSTINESS_AI_TYPICAL_CV)) * 100), 0, 100)
  const vocabScore = vocabDiversity === null
    ? null
    : clamp(Math.round(((VOCAB_HUMAN_TYPICAL_TTR - vocabDiversity) / (VOCAB_HUMAN_TYPICAL_TTR - VOCAB_AI_TYPICAL_TTR)) * 100), 0, 100)
  const phraseDensityPer100Words = (aiPhraseHits.length / wordCount) * 100
  const phraseScore = clamp(Math.round(phraseDensityPer100Words * 50), 0, 100)
  const contractionScore = clamp(Math.round(100 - contractionsPer100Words * 40), 0, 100)

  const weighted = [
    burstinessScore === null ? null : { score: burstinessScore, weight: 0.4 },
    { score: phraseScore, weight: 0.3 },
    vocabScore === null ? null : { score: vocabScore, weight: 0.2 },
    { score: contractionScore, weight: 0.1 },
  ].filter((item): item is { score: number; weight: number } => item !== null)
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0)
  const score = totalWeight > 0 ? Math.round(weighted.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight) : null

  return { wordCount, sentenceCount: sentences.length, burstiness, vocabDiversity, aiPhraseHits, contractionsPer100Words, score }
}

/** A clearly-delimited block appended to the model's prompt so its qualitative read is grounded in real, reproducible evidence instead of pure impression. */
export function formatStatsForPrompt(stats: StylometricStats): string {
  if (stats.wordCount < MIN_WORDS_FOR_SCORE) {
    return `[Automated text statistics — not part of the passage] The passage is short (${stats.wordCount} words) — not enough for reliable stylometric analysis. Rely on qualitative reading only and say so.`
  }
  const lines = [
    `Word count: ${stats.wordCount} across ${stats.sentenceCount} sentences.`,
    stats.burstiness !== null
      ? `Sentence-length variation (coefficient of variation): ${stats.burstiness.toFixed(2)} — lower usually means a more uniform, AI-typical rhythm; higher usually means more varied, human-typical rhythm.`
      : 'Not enough distinct sentences to measure sentence-length variation.',
    stats.vocabDiversity !== null
      ? `Vocabulary diversity (unique words / total words): ${stats.vocabDiversity.toFixed(2)} — lower can indicate repetitive phrasing.`
      : 'Not enough words to measure vocabulary diversity.',
    stats.aiPhraseHits.length > 0
      ? `Common AI-favoured stock phrases found: ${stats.aiPhraseHits.join(', ')}.`
      : 'No common AI-favoured stock phrases detected.',
    `Contraction rate: ${stats.contractionsPer100Words.toFixed(1)} per 100 words — very low can indicate formal, AI-typical phrasing, but is also normal for formal human writing.`,
    stats.score !== null ? `Computed stylometric AI-likelihood estimate from these statistics alone: ${stats.score}/100 — treat as one input among several, not the final answer.` : '',
  ].filter(Boolean)
  return '[Automated text statistics — not part of the passage, computed independently of you]\n' + lines.map((line) => `- ${line}`).join('\n')
}
