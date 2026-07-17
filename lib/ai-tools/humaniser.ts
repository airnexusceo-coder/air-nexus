import { computeStylometricStats, type StylometricStats } from './ai-detector'

export const HUMANISER_STRENGTHS = ['Easy', 'Medium', 'Aggressive'] as const

export type HumaniserStrength = (typeof HUMANISER_STRENGTHS)[number]

export type HumaniserAnalysis = {
  before: StylometricStats
  after: StylometricStats
  riskChange: number | null
  removedAiPhraseHits: string[]
  remainingAiPhraseHits: string[]
  mode: HumaniserStrength
}

function normaliseStrength(value: string | undefined): HumaniserStrength {
  const match = HUMANISER_STRENGTHS.find((strength) => strength.toLowerCase() === value?.trim().toLowerCase())
  return match ?? 'Medium'
}

function formatScore(score: number | null) {
  return score === null ? 'not enough text for a stable score' : `${score}/100`
}

export function humaniserStrengthInstructions(option: string | undefined) {
  const strength = normaliseStrength(option)
  if (strength === 'Easy') {
    return 'Easy mode: keep the structure close to the original, mainly trimming filler, softening stiff wording, and adding natural rhythm where it does not change meaning.'
  }
  if (strength === 'Aggressive') {
    return 'Aggressive mode: substantially reshape sentence flow and paragraph rhythm while preserving every claim. Break up uniform sections, replace stock transitions, vary sentence openings, and make the prose sound like a thoughtful person wrote it from their own draft.'
  }
  return 'Medium mode: rewrite for a natural human voice with moderate restructuring. Keep the argument and facts intact, but vary cadence, reduce robotic phrasing, and make transitions feel less templated.'
}

export function formatHumaniserStatsForPrompt(stats: StylometricStats) {
  const lines = [
    'Writing pattern diagnostics — private guidance, not part of the passage:',
    `- Word count: ${stats.wordCount} across ${stats.sentenceCount} sentences.`,
    `- Robotic-pattern risk estimate: ${formatScore(stats.score)}.`,
    stats.burstiness !== null
      ? `- Sentence rhythm variation: ${stats.burstiness.toFixed(2)}. Lower values usually mean a more uniform rhythm; aim for more natural variation where appropriate.`
      : '- Sentence rhythm variation: not enough sentences to measure reliably.',
    stats.vocabDiversity !== null
      ? `- Vocabulary diversity: ${stats.vocabDiversity.toFixed(2)}. Avoid repetitive phrasing and repeated sentence openings.`
      : '- Vocabulary diversity: not enough words to measure reliably.',
    stats.aiPhraseHits.length > 0
      ? `- Stock phrases to replace if possible: ${stats.aiPhraseHits.join(', ')}.`
      : '- No common stock phrases from the local phrase list were found.',
    `- Contractions: ${stats.contractionsPer100Words.toFixed(1)} per 100 words. Use contractions only where they fit the tone and language.`,
  ]
  return lines.join('\n')
}

export function buildHumaniserAugmentedInput(input: string, option: string | undefined) {
  const stats = computeStylometricStats(input)
  return {
    stats,
    augmentedInput: [
      input.trim(),
      formatHumaniserStatsForPrompt(stats),
      humaniserStrengthInstructions(option),
      'Return the rewritten passage first with no heading. Then add exactly "What changed:" with 3-5 bullets naming the concrete edits and the robotic writing habits reduced. Do not add new facts, evidence, examples, or claims.',
    ].filter(Boolean).join('\n\n'),
  }
}

/** Split the rewritten passage from the notes the Humaniser is instructed to append. */
export function splitHumaniserReply(reply: string): { rewritten: string; changes: string } {
  const markerPattern = /\n{1,2}(?:#{1,3}\s*)?\*{0,2}What changed\*{0,2}:?\s*\n/i
  const match = reply.match(markerPattern)
  if (match && match.index !== undefined && match.index > 10) {
    return { rewritten: reply.slice(0, match.index).trim(), changes: reply.slice(match.index).trim() }
  }
  return { rewritten: reply.trim(), changes: '' }
}

export function buildHumaniserAnalysis(before: StylometricStats, rewritten: string, option: string | undefined): HumaniserAnalysis {
  const after = computeStylometricStats(rewritten)
  const beforeSet = new Set(before.aiPhraseHits)
  const afterSet = new Set(after.aiPhraseHits)
  return {
    before,
    after,
    riskChange: before.score === null || after.score === null ? null : before.score - after.score,
    removedAiPhraseHits: [...beforeSet].filter((phrase) => !afterSet.has(phrase)),
    remainingAiPhraseHits: [...afterSet],
    mode: normaliseStrength(option),
  }
}
